import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface ProjectFile {
  path: string;
  content: string;
}

interface XTerminalProps {
  projectFiles?: ProjectFile[];
  projectId?: string;
  isActive?: boolean;
}

export const XTerminal = ({ projectFiles, projectId, isActive = true }: XTerminalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Keep latest prop values accessible inside async callbacks without stale closures
  const projectIdRef = useRef(projectId);
  const projectFilesRef = useRef(projectFiles);
  // True when ws is open but we're still waiting for projectId
  const pendingInitRef = useRef(false);

  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { projectFilesRef.current = projectFiles; }, [projectFiles]);

  // If projectId arrives after the ws is already open, send init now
  useEffect(() => {
    if (!projectId || !pendingInitRef.current) return;
    const ws = wsRef.current;
    const term = termRef.current;
    if (ws?.readyState !== WebSocket.OPEN || !term) return;
    pendingInitRef.current = false;
    ws.send(JSON.stringify({
      type: 'init',
      projectId,
      files: projectFilesRef.current ?? [],
      cols: term.cols,
      rows: term.rows,
    }));
  }, [projectId]);

  // Refit + refocus when this terminal's tab becomes active
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
      const pid = projectIdRef.current;
      if (pid) {
        // Project already loaded — send init immediately
        ws.send(JSON.stringify({
          type: 'init',
          projectId: pid,
          files: projectFilesRef.current ?? [],
          cols: term.cols,
          rows: term.rows,
        }));
      } else {
        // Project still loading — the projectId useEffect above will send init
        // once projectId becomes available.
        pendingInitRef.current = true;
        // Fallback: send init without a projectId after 5 s so the shell isn't
        // stuck forever if we're in a no-project context (plain editor).
        setTimeout(() => {
          if (!pendingInitRef.current) return;
          pendingInitRef.current = false;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'init',
              projectId: projectIdRef.current ?? null,
              files: projectFilesRef.current ?? [],
              cols: term.cols,
              rows: term.rows,
            }));
          }
        }, 5000);
      }
    };

    ws.onmessage = (event) => {
      term.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data));
    };

    ws.onerror = () => {
      term.write('\r\n\x1b[31mFailed to connect to shell\x1b[0m\r\n');
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[33mShell session ended. Click + to open a new one.\x1b[0m\r\n');
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
      pendingInitRef.current = false;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: '2px 4px' }}
    />
  );
};
