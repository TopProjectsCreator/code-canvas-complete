import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWebContainer } from '@/hooks/useWebContainer';
import { usePyodide, detectUnsupportedPyodideUsage } from '@/hooks/usePyodide';
import { showOfflineDialog } from '@/components/ide/OfflineDialog';
import { detectDeploymentPlatform } from '@/lib/platform';

interface ExecutionResult {
  output: string[];
  error: string | null;
  executedAt: string;
  isPreview?: boolean;
}

/**
 * In-browser JavaScript fallback. Used when WebContainer is unavailable and
 * the user is offline (so the cloud executor isn't reachable either).
 */
async function runJavaScriptInBrowser(code: string): Promise<ExecutionResult> {
  const output: string[] = [];
  const capture = (level: 'log' | 'warn' | 'error') => (...args: unknown[]) => {
    output.push(
      args
        .map((a) => {
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch { return String(a); }
        })
        .join(' '),
    );
    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(...args);
    }
  };
  const sandboxConsole = {
    log: capture('log'),
    info: capture('log'),
    warn: capture('warn'),
    error: capture('error'),
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const fn = new Function('console', `return (async () => { ${code}\n})();`);
    const result = await fn(sandboxConsole);
    if (result !== undefined) output.push(String(result));
    return { output, error: null, executedAt: new Date().toISOString() };
  } catch (err) {
    return {
      output,
      error: err instanceof Error ? err.message : String(err),
      executedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Replit-native execution helpers (call server.mjs directly)
// ---------------------------------------------------------------------------

async function replitExecute(
  code: string,
  language: string,
  stdin?: string,
): Promise<ExecutionResult> {
  try {
    const res = await fetch('/api/replit/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, stdin }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { output: [], error: data.error || `HTTP ${res.status}`, executedAt: new Date().toISOString() };
    }
    return data as ExecutionResult;
  } catch (err) {
    return {
      output: [],
      error: `Replit backend error: ${err instanceof Error ? err.message : String(err)}`,
      executedAt: new Date().toISOString(),
    };
  }
}

async function replitShellRun(
  command: string,
  sessionId: string,
): Promise<{ result: ExecutionResult; sessionId: string }> {
  try {
    const res = await fetch('/api/replit/shell/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, command }),
    });

    if (res.status === 404) {
      // Session expired — caller should start a new one and retry
      return {
        result: { output: [], error: '__SESSION_EXPIRED__', executedAt: new Date().toISOString() },
        sessionId,
      };
    }

    const data = await res.json();
    return { result: data as ExecutionResult, sessionId };
  } catch (err) {
    return {
      result: {
        output: [],
        error: `Replit shell error: ${err instanceof Error ? err.message : String(err)}`,
        executedAt: new Date().toISOString(),
      },
      sessionId,
    };
  }
}

async function replitShellStart(): Promise<string> {
  const res = await fetch('/api/replit/shell/start', { method: 'POST' });
  const data = await res.json();
  return data.sessionId as string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const platform = detectDeploymentPlatform();

export const useCodeExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executorSessions, setExecutorSessions] = useState<Record<string, string>>({});
  const { status: webContainerStatus, boot, spawn } = useWebContainer();
  const { runPython: runPyodide } = usePyodide();

  // Replit persistent shell session — held in a ref to avoid stale closures
  const replitShellSessionRef = useRef<string | null>(null);

  const executeCode = useCallback(async (
    code: string,
    language: string = 'javascript',
    stdin?: string,
  ): Promise<ExecutionResult> => {
    // Preview-based languages render in the preview pane, not executed
    const PREVIEW_LANGUAGES = new Set(['html', 'css', 'md', 'markdown', 'svg']);
    if (PREVIEW_LANGUAGES.has(language.toLowerCase())) {
      return {
        output: [`🖼️ Rendering ${language.toUpperCase()} in preview...`],
        error: null,
        executedAt: new Date().toISOString(),
        isPreview: true,
      };
    }

    // Data/config formats — validate or display inline
    const DATA_LANGUAGES = new Set(['json', 'xml', 'yaml', 'yml', 'toml', 'txt']);
    if (DATA_LANGUAGES.has(language.toLowerCase())) {
      if (language.toLowerCase() === 'json') {
        try {
          const parsed = JSON.parse(code);
          const formatted = JSON.stringify(parsed, null, 2);
          return { output: ['✓ Valid JSON', '', formatted], error: null, executedAt: new Date().toISOString() };
        } catch (e) {
          return {
            output: [],
            error: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`,
            executedAt: new Date().toISOString(),
          };
        }
      }
      return { output: [`📄 ${language.toUpperCase()} content:`, '', code], error: null, executedAt: new Date().toISOString() };
    }

    setIsExecuting(true);
    const normalizedLanguage = language.toLowerCase();

    try {
      // =======================================================================
      // REPLIT: route everything directly to the local backend (server.mjs).
      // Skip Pyodide, WebContainer, and the Supabase edge function entirely.
      // =======================================================================
      if (platform === 'replit') {
        const isShell = ['shell', 'bash', 'sh'].includes(normalizedLanguage);

        if (isShell) {
          // Shell commands use a persistent bash session so that cd, env vars,
          // and installed packages survive between commands.
          let sessionId = replitShellSessionRef.current;

          // Start a new session if we don't have one yet
          if (!sessionId) {
            sessionId = await replitShellStart();
            replitShellSessionRef.current = sessionId;
          }

          const { result } = await replitShellRun(code, sessionId);

          // If the session expired on the server, create a fresh one and retry
          if (result.error === '__SESSION_EXPIRED__') {
            const newSessionId = await replitShellStart();
            replitShellSessionRef.current = newSessionId;
            const retry = await replitShellRun(code, newSessionId);
            return retry.result;
          }

          return result;
        }

        // All other languages (python, javascript, …) — fresh process per run,
        // with stdin piped so input() / readline work.
        return await replitExecute(code, normalizedLanguage, stdin);
      }
      // =======================================================================
      // Non-Replit platforms: existing Pyodide / WebContainer / edge-fn logic
      // =======================================================================

      const isOffline = !navigator.onLine;
      const clientSideLanguages = new Set(['javascript', 'typescript', 'shell', 'bash', 'html', 'css', 'json', 'python']);

      // Python: prefer Pyodide for simple scripts; fall back to container for system code
      if (normalizedLanguage === 'python' || normalizedLanguage === 'py') {
        const pythonExecutorMode = typeof window !== 'undefined'
          ? window.localStorage.getItem('ide.pythonExecutorMode') || 'auto'
          : 'auto';
        const unsupported = detectUnsupportedPyodideUsage(code);
        const preferPyodide =
          pythonExecutorMode === 'pyodide' ||
          (pythonExecutorMode === 'auto' && !unsupported);

        if (preferPyodide || isOffline) {
          if (isOffline && unsupported) {
            return {
              output: [],
              error: `📡 Offline. This Python script uses "${unsupported}" which needs the cloud container. Reconnect to run it.`,
              executedAt: new Date().toISOString(),
            };
          }
          try {
            const result = await runPyodide(code, stdin);
            const banner = isOffline
              ? '🐍 Offline — running in Pyodide (browser Python).'
              : '🐍 Pyodide (browser Python).';
            return {
              output: [banner, ...result.stdout, ...result.stderr],
              error: result.exitCode === 0 ? null : 'Python execution failed',
              executedAt: new Date().toISOString(),
            };
          } catch (err) {
            if (isOffline) {
              return {
                output: [],
                error: `📡 Offline and Pyodide failed to load: ${err instanceof Error ? err.message : String(err)}`,
                executedAt: new Date().toISOString(),
              };
            }
            console.warn('Pyodide failed, falling back to container executor.', err);
            // fall through
          }
        }
      }

      const canFallbackToBrowserJs = ['javascript', 'typescript'].includes(normalizedLanguage);
      if (isOffline && !clientSideLanguages.has(normalizedLanguage)) {
        showOfflineDialog({
          title: "Can't run this language offline",
          description: `${language} needs the cloud executor. Reconnect to your network to run it.`,
        });
        return {
          output: [],
          error: '📡 You are offline. This language requires a server to execute. Please reconnect to the internet and try again.',
          executedAt: new Date().toISOString(),
        };
      }

      const shellExecutorMode = typeof window !== 'undefined'
        ? window.localStorage.getItem('ide.shellExecutorMode') || 'webcontainer'
        : 'webcontainer';
      const shouldUseWebContainer =
        ['shell', 'bash', 'javascript'].includes(normalizedLanguage) &&
        (isOffline || shellExecutorMode !== 'wandbox') &&
        webContainerStatus !== 'error';

      if (shouldUseWebContainer && /\b(pip|pip3|uv)\b/.test(code)) {
        return {
          output: [],
          error: 'This browser-native shell runs on Node.js WebContainers, so Python package managers like pip/uv are unavailable here. To use pip/uv, enable the container runner backend in Supabase (`EXECUTOR_MODE=hybrid` or `container`) and set `EXECUTOR_CONTAINER_BASE_URL` in your Edge Function environment.',
          executedAt: new Date().toISOString(),
        };
      }

      if (shouldUseWebContainer) {
        const runtimeCommand = normalizedLanguage === 'javascript' ? 'node' : 'jsh';
        const runtimeArgs = normalizedLanguage === 'javascript' ? ['-e', code] : ['-lc', code];
        try {
          if (webContainerStatus === 'idle') await boot();
          const result = await spawn(runtimeCommand, runtimeArgs);
          return {
            output: [...result.stdout, ...result.stderr],
            error: result.exitCode === 0 ? null : `Command exited with code ${result.exitCode}`,
            executedAt: new Date().toISOString(),
          };
        } catch (error) {
          console.warn('WebContainer execution failed, falling back to edge executor.', error);
        }
      }

      if (canFallbackToBrowserJs) {
        const result = await runJavaScriptInBrowser(code);
        return {
          ...result,
          output: [
            isOffline
              ? '⚡ Offline — running in browser sandbox (no Node APIs).'
              : '⚡ WebContainer unavailable — running in browser sandbox (no Node APIs).',
            ...result.output,
          ],
        };
      }

      if (isOffline) {
        showOfflineDialog({
          title: "You're offline",
          description: 'The in-browser runtime is unavailable for this command. Reconnect to use the cloud executor.',
        });
        return {
          output: [],
          error: '📡 You are offline and the in-browser runtime is unavailable. Reconnect to use the cloud executor.',
          executedAt: new Date().toISOString(),
        };
      }

      // Edge function (Supabase) for non-Replit platforms
      const sessionKey = normalizedLanguage === 'bash' ? 'shell' : normalizedLanguage;
      const body: Record<string, string> = { code, language };
      if (stdin) body.stdin = stdin;
      const existingSessionId = executorSessions[sessionKey];
      if (existingSessionId) body.sessionId = existingSessionId;

      const { data, error } = await supabase.functions.invoke('execute-code', { body });

      if (error) {
        let errorMessage = error.message;
        try {
          const match = error.message.match(/\{.*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            errorMessage = parsed.error || errorMessage;
          }
        } catch { /* keep original */ }
        return { output: [], error: errorMessage, executedAt: new Date().toISOString() };
      }

      if (data?.sessionId && data.sessionId !== existingSessionId) {
        setExecutorSessions((prev) => ({ ...prev, [sessionKey]: data.sessionId }));
      }

      if (data?.error) {
        return { output: data.output || [], error: data.error, executedAt: data.executedAt || new Date().toISOString() };
      }

      return data as ExecutionResult;

    } catch (err) {
      let errorMessage = 'Unknown error';
      if (err instanceof Error) {
        try {
          const match = err.message.match(/\{.*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            errorMessage = parsed.error || err.message;
          } else {
            errorMessage = err.message;
          }
        } catch {
          errorMessage = err.message;
        }
      }
      return { output: [], error: errorMessage, executedAt: new Date().toISOString() };
    } finally {
      setIsExecuting(false);
    }
  }, [boot, executorSessions, spawn, webContainerStatus, runPyodide]);

  const executeShellCommand = useCallback(async (command: string): Promise<ExecutionResult> => {
    return executeCode(command, 'shell');
  }, [executeCode]);

  // Reset the Replit persistent shell session (e.g. user clicks "clear / new shell")
  const resetReplitShell = useCallback(async () => {
    const oldId = replitShellSessionRef.current;
    replitShellSessionRef.current = null;
    if (oldId) {
      try {
        await fetch(`/api/replit/shell/session/${oldId}`, { method: 'DELETE' });
      } catch { /* best-effort */ }
    }
  }, []);

  return {
    executeCode,
    executeShellCommand,
    isExecuting,
    resetReplitShell,
  };
};
