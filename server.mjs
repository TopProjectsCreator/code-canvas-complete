import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';

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
  const domain = req.headers['x-forwarded-host'] || req.headers.host || '';
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
// Persistent shell sessions  (Terminal — bash process that keeps state)
// ---------------------------------------------------------------------------

const shellSessions = new Map();
const SESSION_IDLE_MS = 5 * 60 * 1000; // 5 minutes

// Purge idle sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of shellSessions) {
    if (now - session.lastActive > SESSION_IDLE_MS) {
      try { session.proc.kill(); } catch {}
      shellSessions.delete(id);
    }
  }
}, 60_000).unref();

function createBashSession() {
  const proc = spawn('bash', ['--norc', '--noprofile'], {
    env: {
      ...process.env,
      TERM: 'dumb',
      PYTHONUNBUFFERED: '1',
    },
    cwd: process.env.HOME || process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let outputBuf = '';
  let currentResolve = null;
  let currentSentinel = null;
  let currentTimer = null;

  // Only watch stdout; stderr from user commands is merged via 2>&1 below.
  // Bash internal errors go to proc.stderr but we don't surface them separately.
  proc.stdout.on('data', (chunk) => {
    outputBuf += chunk.toString();
    checkSentinel();
  });

  // Append bash's own stderr (e.g. syntax errors) into the same buffer
  proc.stderr.on('data', (chunk) => {
    outputBuf += chunk.toString();
    checkSentinel();
  });

  function checkSentinel() {
    if (!currentResolve || !currentSentinel) return;
    const idx = outputBuf.indexOf(currentSentinel);
    if (idx === -1) return;

    const output = outputBuf.slice(0, idx);
    outputBuf = outputBuf.slice(idx + currentSentinel.length);

    const resolve = currentResolve;
    currentResolve = null;
    currentSentinel = null;
    if (currentTimer) { clearTimeout(currentTimer); currentTimer = null; }

    resolve({ output: output.replace(/\n$/, '') });
  }

  function runCommand(cmd) {
    return new Promise((resolve, reject) => {
      const sentinel = `__CC_${randomUUID().replace(/-/g, '')}__`;
      currentResolve = resolve;
      currentSentinel = sentinel;

      currentTimer = setTimeout(() => {
        currentResolve = null;
        currentSentinel = null;
        currentTimer = null;
        try { proc.stdin.write('\x03'); } catch {} // Ctrl-C
        reject(new Error('⏱️ Command timed out (30 second limit). Press Ctrl+C to cancel.'));
      }, 30000);

      // Run command; merge its stderr into stdout with 2>&1.
      // printf the sentinel to stdout after (not affected by 2>&1).
      proc.stdin.write(`{ ${cmd}; } 2>&1; printf '${sentinel}'\n`);
    });
  }

  // Suppress the default PS1 prompt so it doesn't pollute output
  proc.stdin.write("unset PS1 PS2 PS3 PS4\n");

  proc.on('exit', () => {
    // Reject any pending command if bash dies
    if (currentResolve) {
      if (currentTimer) clearTimeout(currentTimer);
      const reject = currentResolve;
      currentResolve = null;
      currentSentinel = null;
      reject({ output: '', _dead: true });
    }
  });

  return { proc, runCommand, lastActive: Date.now() };
}

// POST /api/replit/shell/start  — create (or reuse) a shell session
app.post('/api/replit/shell/start', (req, res) => {
  const sessionId = randomUUID();
  const session = createBashSession();
  shellSessions.set(sessionId, session);
  res.json({ sessionId });
});

// POST /api/replit/shell/run  — run one command in a persistent session
app.post('/api/replit/shell/run', async (req, res) => {
  const { sessionId, command } = req.body;

  if (!sessionId || !shellSessions.has(sessionId)) {
    return res.status(404).json({
      error: 'Shell session not found or expired. A new session will be created automatically.',
      output: [],
      executedAt: new Date().toISOString(),
    });
  }

  if (!command || !command.trim()) {
    return res.json({ output: [], error: null, executedAt: new Date().toISOString() });
  }

  const session = shellSessions.get(sessionId);
  session.lastActive = Date.now();

  try {
    const { output } = await session.runCommand(command.trim());
    const lines = output.split('\n');

    res.json({
      output: lines.length > 0 && lines[0] !== '' ? lines : (output ? [output] : ['(no output)']),
      error: null,
      executedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      output: [],
      error: err instanceof Error ? err.message : String(err),
      executedAt: new Date().toISOString(),
    });
  }
});

// DELETE /api/replit/shell/session/:id  — kill a session (e.g. on unmount)
app.delete('/api/replit/shell/session/:id', (req, res) => {
  const session = shellSessions.get(req.params.id);
  if (session) {
    try { session.proc.kill(); } catch {}
    shellSessions.delete(req.params.id);
  }
  res.json({ ok: true });
});

// POST /api/replit/shell/reset  — kill old session and create a fresh one
app.post('/api/replit/shell/reset', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    const old = shellSessions.get(sessionId);
    if (old) { try { old.proc.kill(); } catch {} shellSessions.delete(sessionId); }
  }
  const newId = randomUUID();
  shellSessions.set(newId, createBashSession());
  res.json({ sessionId: newId });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Replit server running on port ${PORT}`);
});
