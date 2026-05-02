import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ExternalLink, X } from 'lucide-react';

export interface ProjectFile {
  path: string;
  content: string;
}

interface XTerminalProps {
  projectFiles?: ProjectFile[];
  projectId?: string;
  projectName?: string;
  isActive?: boolean;
}

// Strip ANSI/VT escape sequences from a string so we can regex-scan plain text.
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][AB012]|\x1b[=>]|\x07|\x08|\r/g;

// Patterns that indicate a server is listening.
// Captures the full URL (group 1) and/or port (group 2).
const URL_RE =
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)([^\s"'<>)\]]*)/gi;

function remapToPublic(url: string): string {
  // Replace the host+port portion with the Replit public host + the same port.
  // On Replit, other ports are proxied via hostname:port on the same base domain.
  return url.replace(
    /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/i,
    (_m, port) => `${window.location.protocol}//${window.location.hostname}:${port}`
  );
}

export const XTerminal = ({ projectFiles, projectId, projectName, isActive = true }: XTerminalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Always-current view of props, readable inside async callbacks
  const projectIdRef = useRef(projectId);
  const projectNameRef = useRef(projectName);
  const projectFilesRef = useRef(projectFiles);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { projectNameRef.current = projectName; }, [projectName]);
  useEffect(() => { projectFilesRef.current = projectFiles; }, [projectFiles]);

  // True after the first init message has been sent to the server.
  const initSentRef = useRef(false);

  // Rolling plain-text buffer (last 2 KB) used for URL scanning.
  const textBufRef = useRef('');

  // Detected server URL to display as a clickable link.
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Whenever the IDE file tree changes after init (e.g. after a git clone),
  // push the updated files into the live shell directory via sync-files.
  useEffect(() => {
    if (!initSentRef.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!projectFiles?.length) return;
    ws.send(JSON.stringify({ type: 'sync-files', files: projectFiles }));
  }, [projectFiles]);

  // Refit + refocus when this tab becomes active
  useEffect(() => {
    if (!isActive) return;
    requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit();
        const t = termRef.current;
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN && t) {
          ws.send(JSON.stringify({ type: 'resize', cols: t.cols, rows: t.rows }));
        }
        t?.focus();
      } catch {}
    });
  }, [isActive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      scrollback: 5000,
      convertEol: true,
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(container);
    requestAnimationFrame(() => fitAddon.fit());

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/replit/pty`);
    wsRef.current = ws;

    ws.onopen = () => {
      fitAddon.fit();
      ws.send(JSON.stringify({
        type: 'init',
        projectId: projectIdRef.current ?? null,
        projectName: projectNameRef.current ?? null,
        files: projectFilesRef.current ?? [],
        cols: term.cols,
        rows: term.rows,
      }));
      initSentRef.current = true;
    };

    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      term.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data));

      if (raw) {
        // Append stripped text to rolling buffer (keep last 2 KB)
        textBufRef.current = (textBufRef.current + raw.replace(ANSI_RE, '')).slice(-2048);

        // Scan for any server URL in the buffer
        URL_RE.lastIndex = 0;
        const match = URL_RE.exec(textBufRef.current);
        if (match) {
          const public_url = remapToPublic(match[0]);
          setServerUrl(public_url);
          setDismissed(false);
        }
      }
    };

    ws.onerror = () => {
      term.write('\r\n\x1b[31mFailed to connect to shell\x1b[0m\r\n');
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[33mShell session ended. Click + to open a new one.\x1b[0m\r\n');
      // Clear detected URL when shell closes
      setServerUrl(null);
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    const ro = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {}
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
      fitAddonRef.current = null;
      termRef.current = null;
      wsRef.current = null;
    };
  }, []);

  const showBanner = serverUrl && !dismissed;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Server URL banner */}
      {showBanner && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border-b border-[#30363d] text-xs shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 animate-pulse" />
          <span className="text-[#8b949e]">Server running:</span>
          <a
            href={serverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#58a6ff] hover:text-[#79c0ff] hover:underline transition-colors font-mono truncate max-w-xs"
          >
            {serverUrl}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="ml-auto text-[#6e7681] hover:text-[#b1bac4] transition-colors shrink-0"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ padding: '2px 4px' }}
      />
    </div>
  );
};
