import { useCallback, useEffect, useState } from 'react';

type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PyodideState {
  status: PyodideStatus;
  error: string | null;
}

interface PyRunResult {
  stdout: string[];
  stderr: string[];
  exitCode: number;
}

// Module-level singleton so all components share one interpreter.
const listeners = new Set<(s: PyodideState) => void>();
let pyodideInstance: any = null;
let loadPromise: Promise<any> | null = null;
let state: PyodideState = { status: 'idle', error: null };

const PYODIDE_VERSION = '0.29.3';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const setState = (next: PyodideState) => {
  state = next;
  listeners.forEach((l) => l(state));
};

// Packages that require system-level deps or aren't compiled for WASM.
// If user code imports these, fall back to the cloud container.
const UNSUPPORTED_IMPORTS = new Set([
  'subprocess', 'os.system', 'multiprocessing', 'socket', 'requests', 'urllib3',
  'psycopg2', 'pyodbc', 'mysqlclient', 'tkinter', 'turtle', 'cv2', 'tensorflow',
  'torch', 'pyaudio', 'pygame', 'wxpython', 'gi',
]);

export const detectUnsupportedPyodideUsage = (code: string): string | null => {
  // Detect pip/uv shell calls — these should go to container, not Pyodide.
  if (/(?:^|\s)!?\s*(pip|pip3|uv)\b/m.test(code)) return 'pip/uv';
  // Detect imports that need system integration.
  const importRe = /^\s*(?:from\s+([\w.]+)|import\s+([\w.]+(?:\s*,\s*[\w.]+)*))/gm;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(code)) !== null) {
    const mods = (match[1] || match[2] || '').split(',').map((s) => s.trim().split('.')[0]);
    for (const m of mods) {
      if (UNSUPPORTED_IMPORTS.has(m)) return m;
    }
  }
  return null;
};

const loadPyodideInternal = async () => {
  if (pyodideInstance) return pyodideInstance;
  if (loadPromise) return loadPromise;

  setState({ status: 'loading', error: null });
  loadPromise = (async () => {
    // Dynamic import keeps Pyodide out of the main bundle.
    const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`);
    const py = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    pyodideInstance = py;
    setState({ status: 'ready', error: null });
    return py;
  })().catch((err) => {
    const message = err instanceof Error ? err.message : 'Failed to load Pyodide.';
    setState({ status: 'error', error: message });
    loadPromise = null;
    throw err;
  });

  return loadPromise;
};

export const usePyodide = () => {
  const [pyState, setPyState] = useState<PyodideState>(state);

  useEffect(() => {
    const handler = (s: PyodideState) => setPyState(s);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const load = useCallback(async () => { await loadPyodideInternal(); }, []);

  const runPython = useCallback(async (code: string, stdin?: string): Promise<PyRunResult> => {
    const py = await loadPyodideInternal();
    const stdout: string[] = [];
    const stderr: string[] = [];

    py.setStdout({ batched: (s: string) => stdout.push(...s.split(/\r?\n/).filter(Boolean)) });
    py.setStderr({ batched: (s: string) => stderr.push(...s.split(/\r?\n/).filter(Boolean)) });
    if (stdin !== undefined) {
      let cursor = 0;
      const lines = stdin.split(/\r?\n/);
      py.setStdin({ stdin: () => (cursor < lines.length ? lines[cursor++] : null) });
    }

    try {
      // Auto-load any imports Pyodide knows about (numpy, pandas, etc.).
      try { await py.loadPackagesFromImports(code); } catch { /* ignore */ }
      const result = await py.runPythonAsync(code);
      if (result !== undefined && result !== null) {
        try { stdout.push(String(result)); } catch { /* ignore */ }
      }
      return { stdout, stderr, exitCode: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stderr.push(msg);
      return { stdout, stderr, exitCode: 1 };
    }
  }, []);

  return { status: pyState.status, error: pyState.error, load, runPython };
};
