import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createRequire } from 'module';

// node-pty ships as CJS; use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const pty = require('node-pty');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.REPLIT_SERVER_PORT || '3001', 10);

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

app.get('/api/replit/me', (req, res) => {
  const userId = req.headers['x-replit-user-id'];
  const userName = req.headers['x-replit-user-name'];
  const userRoles = req.headers['x-replit-user-roles'];
  if (!userId) return res.json({ user: null });
  res.json({
    user: {
      id: String(userId),
      name: String(userName || ''),
      roles: String(userRoles || '').split(',').filter(Boolean),
    },
  });
});

app.get('/api/replit/auth', (req, res) => {
  // Always use the public Replit dev domain so the auth callback comes back
  // to a URL the browser can actually reach (not localhost:3001).
  const domain =
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.REPLIT_DOMAINS ||
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    '';
  res.redirect(`https://replit.com/auth_with_repl_site?domain=${domain}`);
});

app.get('/api/replit/signout', (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// One-shot code execution  (Run button — fresh process per run, stdin piped)
// ---------------------------------------------------------------------------

const LANG_CONFIG = {
  python:     { cmd: 'python3', ext: 'py' },
  py:         { cmd: 'python3', ext: 'py' },
  javascript: { cmd: 'node',    ext: 'js' },
  js:         { cmd: 'node',    ext: 'js' },
  bash:       { cmd: 'bash',    ext: 'sh' },
  shell:      { cmd: 'bash',    ext: 'sh' },
  sh:         { cmd: 'bash',    ext: 'sh' },
};

app.post('/api/replit/execute', (req, res) => {
  const { code, language = 'python', stdin } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'No code provided', output: [], executedAt: new Date().toISOString() });
  }

  const normalized = language.toLowerCase().trim();
  const config = LANG_CONFIG[normalized];

  if (!config) {
    return res.status(400).json({
      error: `Language '${language}' is not supported by the Replit native runner. Supported: python, javascript, bash.`,
      output: [],
      executedAt: new Date().toISOString(),
    });
  }

  let tmpDir;
  try {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'replit-exec-'));
    const codeFile = path.join(tmpDir, `main.${config.ext}`);
    writeFileSync(codeFile, code, 'utf8');

    let stdoutBuf = '';
    let stderrBuf = '';
    let timedOut = false;

    const proc = spawn(config.cmd, [codeFile], {
      cwd: tmpDir,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, 30000);

    // Pipe stdin so that input() / readline work
    if (stdin) proc.stdin.write(stdin);
    proc.stdin.end();

    proc.stdout.on('data', (d) => { stdoutBuf += d.toString(); });
    proc.stderr.on('data', (d) => { stderrBuf += d.toString(); });

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}

      const lines = stdoutBuf.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

      if (timedOut) {
        return res.json({ output: lines, error: '⏱️ Execution timed out (30 second limit).', executedAt: new Date().toISOString() });
      }

      if (exitCode !== 0) {
        const escapedTmp = tmpDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cleanErr = stderrBuf.replace(new RegExp(escapedTmp + '\\/', 'g'), '').trim();
        return res.json({
          output: lines,
          error: cleanErr || `Process exited with code ${exitCode}`,
          executedAt: new Date().toISOString(),
        });
      }

      return res.json({
        output: lines.length > 0 ? lines : ['(no output)'],
        error: null,
        executedAt: new Date().toISOString(),
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      return res.json({ output: [], error: `Failed to start '${config.cmd}': ${err.message}`, executedAt: new Date().toISOString() });
    });

  } catch (err) {
    if (tmpDir) try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    return res.status(500).json({ output: [], error: err.message, executedAt: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// Static file serving (production build)
// ---------------------------------------------------------------------------

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ---------------------------------------------------------------------------
// HTTP server + WebSocket server (PTY interactive terminal)
// ---------------------------------------------------------------------------

const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/replit/pty') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ---------------------------------------------------------------------------
// Command safety filter
// Checks a fully-typed shell line (before the user hits Enter) against a list
// of patterns that could damage the host environment or other sessions.
// ---------------------------------------------------------------------------
function isBlockedCommand(line) {
  const cmd = line.trim().replace(/\s+/g, ' ');
  if (!cmd) return false;

  const BLOCKED = [
    // kill -9 -1 / kill -KILL -1 / kill -- -1  (kill ALL processes)
    /\bkill\b\s+(?:-[-a-zA-Z0-9]+\s+)*-1(\s|$)/,
    // kill without explicit signal: just `kill -1`
    /\bkill\b\s+-1(\s|$)/,
    // rm -rf /  or  rm -fr /  or  rm --recursive --force /
    /\brm\b\s+(?:-[a-zA-Z]*[rR][a-zA-Z]*\s+|--recursive\s+|--force\s+){1,4}\s*\/[* ]*/,
    /\brm\b\s+(?:-[a-zA-Z]*[fF][a-zA-Z]*\s+|--force\s+){1,4}(?:-[a-zA-Z]*[rR][a-zA-Z]*\s+|--recursive\s+)+\s*\/[* ]*/,
    // fork bomb  :(){ :|:& };:
    /:\s*\(\s*\)\s*\{/,
    // dd writing to a block device
    /\bdd\b.*\bof=\/dev\/(sd|hd|vd|nvme|xvd)/,
    // mkfs — reformats a filesystem
    /\bmkfs\b/,
    // direct redirect to a block device
    />\s*\/dev\/(sd[a-z]|hd[a-z]|vd[a-z]|nvme|xvd)/,
  ];

  return BLOCKED.some((re) => re.test(cmd));
}

wss.on('connection', (ws) => {
  let ptyProcess = null;

  // Per-connection fallback ID — guarantees the shell never starts in the
  // workspace root even if the client sends no projectId.
  const connSessionId = `conn-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Tracks characters typed on the current line so we can inspect the full
  // command before forwarding the Enter key to bash.
  let lineBuffer = '';

  ws.on('message', (msg) => {
    const str = msg.toString();

    // First message must be {type:'init'} — write project files and spawn PTY
    if (ptyProcess === null) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.type !== 'init') return; // drop anything until init

        const { projectId, files = [], cols = 80, rows = 24 } = parsed;

        // Always use a temp dir — never the workspace root.
        // Use the client-supplied projectId if present, else fall back to
        // a per-connection session ID so git clone / ls can't touch IDE source.
        const resolvedId = projectId || connSessionId;
        const projectDir = path.join(tmpdir(), `canvas-${resolvedId}`);
        let cwd = projectDir;
        try {
          fs.mkdirSync(projectDir, { recursive: true });
          for (const { path: filePath, content } of files) {
            if (!filePath || typeof content !== 'string') continue;
            // Sanitise path — strip leading slashes / traversals
            const safe = filePath.replace(/^[./\\]+/, '').replace(/\.\.\//g, '');
            if (!safe) continue;
            const fullPath = path.join(projectDir, safe);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content, 'utf8');
          }

          // Write a .bashrc so bash picks up our prompt when it sources HOME/.bashrc.
          // System /etc/bash.bashrc would override an env-level PS1, so we write
          // it as a file instead. \w expands to ~ when cwd==HOME, ~/sub otherwise.
          // Also installs runtime safety: ulimit caps + kill() override.
          const bashrc = [
            '# CodeCanvas shell',
            '[ -f /etc/bash.bashrc ] && source /etc/bash.bashrc',
            "PS1='\\[\\033[01;36m\\]\\w\\[\\033[00m\\]\\[\\033[01m\\]\\$\\[\\033[00m\\] '",
            '# Resource limits — defence against fork bombs and runaway writes',
            'ulimit -u 200     # max 200 user processes',
            'ulimit -f 204800  # max 200 MB per file write',
            '# Shell-level kill guard (server-side filter is the primary block)',
            'kill() {',
            '  for _arg in "$@"; do',
            '    if [[ "$_arg" == "-1" ]]; then',
            '      echo -e "\\033[31m\u26d4  Blocked: kill -1 (kill all processes) is not permitted.\\033[0m" >&2',
            '      return 1',
            '    fi',
            '  done',
            '  command kill "$@"',
            '}',
            '# Override sudo message — replace "Replit" branding with CodeCanvas',
            'sudo() {',
            '  if [[ ! -f ~/.sudo_motd ]]; then',
            '    echo -e "\\t\\033[93mYou don\'t need sudo in CodeCanvas, all files that\\033[0m" >&2',
            '    echo -e "\\t\\033[93mcan be modified already have the correct permissions.\\033[0m" >&2',
            '    echo -e "" >&2',
            '    touch ~/.sudo_motd',
            '  fi',
            '  command sudo "$@"',
            '}',
          ].join('\n') + '\n';
          fs.writeFileSync(path.join(projectDir, '.bashrc'), bashrc, 'utf8');
        } catch (e) {
          console.error('Failed to write project files:', e.message);
        }

        ptyProcess = pty.spawn('bash', ['--rcfile', path.join(cwd, '.bashrc')], {
          name: 'xterm-256color',
          cols: Math.max(1, cols),
          rows: Math.max(1, rows),
          cwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            PYTHONUNBUFFERED: '1',
            // Make ~ resolve to the project dir so \w in PS1 shows ~/subdir
            HOME: cwd,
          },
        });

        ptyProcess.onData((data) => {
          try { if (ws.readyState === ws.OPEN) ws.send(data); } catch {}
        });

        ptyProcess.onExit(() => {
          try { if (ws.readyState === ws.OPEN) ws.close(); } catch {}
        });

      } catch (e) {
        console.error('PTY init error:', e.message);
      }
      return;
    }

    // PTY is running — handle resize or forward raw input
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        ptyProcess.resize(Math.max(1, parsed.cols), Math.max(1, parsed.rows));
        return;
      }
    } catch {}

    // Feed each character through the safety filter.
    // We buffer the current line so that when Enter arrives we can inspect the
    // full command before deciding whether to forward the keystroke to bash.
    let toWrite = '';
    for (const ch of str) {
      if (ch === '\r' || ch === '\n') {
        if (isBlockedCommand(lineBuffer)) {
          // Flush safe chars typed so far, then cancel the line with Ctrl-C.
          if (toWrite) { try { ptyProcess.write(toWrite); } catch {} toWrite = ''; }
          try { ptyProcess.write('\x03'); } catch {} // ^C clears bash readline
          const cmdName = lineBuffer.trim().split(/\s+/)[0] || 'command';
          setTimeout(() => {
            try {
              ws.send(`\r\n\x1b[31m\u26d4  Blocked: '${cmdName}' is not permitted in this environment.\x1b[0m\r\n`);
            } catch {}
          }, 40);
          lineBuffer = '';
          continue; // do NOT forward the Enter key
        }
        lineBuffer = '';
        toWrite += ch;
      } else if (ch === '\x7f' || ch === '\x08') {
        // Backspace — keep buffer in sync
        lineBuffer = lineBuffer.slice(0, -1);
        toWrite += ch;
      } else if (ch === '\x03') {
        // Ctrl-C — user cancelled the line themselves
        lineBuffer = '';
        toWrite += ch;
      } else {
        lineBuffer += ch;
        toWrite += ch;
      }
    }
    if (toWrite) { try { ptyProcess.write(toWrite); } catch {} }
  });

  ws.on('close', () => {
    try { ptyProcess?.kill(); } catch {}
  });

  ws.on('error', () => {
    try { ptyProcess?.kill(); } catch {}
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Replit server running on port ${PORT}`);
});
