import { useEffect, useState } from 'react';

export type PythonExecutorMode = 'auto' | 'pyodide' | 'container';

const STORAGE_KEY = 'ide.pythonExecutorMode';
const EVENT_NAME = 'ide-python-executor-mode-changed';

const readMode = (): PythonExecutorMode => {
  if (typeof window === 'undefined') return 'auto';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'pyodide' || saved === 'container' ? saved : 'auto';
};

/**
 * Reactively reads the user's Python executor mode preference.
 * Updates immediately when the setting changes — no reload required.
 */
export const usePythonExecutorMode = (): PythonExecutorMode => {
  const [mode, setMode] = useState<PythonExecutorMode>(readMode);

  useEffect(() => {
    const handler = () => setMode(readMode());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return mode;
};
