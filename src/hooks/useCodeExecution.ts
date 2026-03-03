import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWebContainer } from '@/hooks/useWebContainer';

interface ExecutionResult {
  output: string[];
  error: string | null;
  executedAt: string;
  isPreview?: boolean; // True for files that should render in preview instead of execute
}

export const useCodeExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executorSessions, setExecutorSessions] = useState<Record<string, string>>({});
  const { status: webContainerStatus, boot, spawn } = useWebContainer();

  const executeCode = useCallback(async (code: string, language: string = 'javascript', stdin?: string): Promise<ExecutionResult> => {
    // Handle preview-based languages (HTML, CSS, Markdown render in preview)
    const PREVIEW_LANGUAGES = new Set(['html', 'css', 'md', 'markdown', 'svg']);

    if (PREVIEW_LANGUAGES.has(language.toLowerCase())) {
      return {
        output: [`🖼️ Rendering ${language.toUpperCase()} in preview...`],
        error: null,
        executedAt: new Date().toISOString(),
        isPreview: true,
      };
    }

    // Handle data/config formats with validation or formatting
    const DATA_LANGUAGES = new Set(['json', 'xml', 'yaml', 'yml', 'toml', 'txt']);

    if (DATA_LANGUAGES.has(language.toLowerCase())) {
      // Try to validate/format the data
      if (language.toLowerCase() === 'json') {
        try {
          const parsed = JSON.parse(code);
          const formatted = JSON.stringify(parsed, null, 2);
          return {
            output: ['✓ Valid JSON', '', formatted],
            error: null,
            executedAt: new Date().toISOString(),
          };
        } catch (e) {
          return {
            output: [],
            error: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`,
            executedAt: new Date().toISOString(),
          };
        }
      }

      // For other data formats, just display them
      return {
        output: [`📄 ${language.toUpperCase()} content:`, '', code],
        error: null,
        executedAt: new Date().toISOString(),
      };
    }

    setIsExecuting(true);

    try {
      const normalizedLanguage = language.toLowerCase();
      const shellExecutorMode = typeof window !== 'undefined'
        ? window.localStorage.getItem('ide.shellExecutorMode') || 'webcontainer'
        : 'webcontainer';
      const shouldUseWebContainer =
        ['shell', 'bash', 'javascript'].includes(normalizedLanguage) &&
        shellExecutorMode !== 'wandbox' &&
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
          if (webContainerStatus === 'idle') {
            await boot();
          }

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

      const sessionKey = normalizedLanguage === 'bash' ? 'shell' : normalizedLanguage;
      const body: Record<string, string> = { code, language };
      if (stdin) body.stdin = stdin;
      const existingSessionId = executorSessions[sessionKey];
      if (existingSessionId) body.sessionId = existingSessionId;

      const { data, error } = await supabase.functions.invoke('execute-code', {
        body,
      });

      if (error) {
        let errorMessage = error.message;
        try {
          const match = error.message.match(/\{.*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            errorMessage = parsed.error || errorMessage;
          }
        } catch {
          // Keep original error message
        }

        return {
          output: [],
          error: errorMessage,
          executedAt: new Date().toISOString(),
        };
      }

      if (data?.error) {
        if (data?.sessionId && data.sessionId !== existingSessionId) {
          setExecutorSessions((prev) => ({ ...prev, [sessionKey]: data.sessionId }));
        }
        return {
          output: data.output || [],
          error: data.error,
          executedAt: data.executedAt || new Date().toISOString(),
        };
      }

      if (data?.sessionId && data.sessionId !== existingSessionId) {
        setExecutorSessions((prev) => ({ ...prev, [sessionKey]: data.sessionId }));
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

      return {
        output: [],
        error: errorMessage,
        executedAt: new Date().toISOString(),
      };
    } finally {
      setIsExecuting(false);
    }
  }, [boot, executorSessions, spawn, webContainerStatus]);

  const executeShellCommand = useCallback(async (command: string): Promise<ExecutionResult> => {
    return executeCode(command, 'shell');
  }, [executeCode]);

  return {
    executeCode,
    executeShellCommand,
    isExecuting,
  };
};
