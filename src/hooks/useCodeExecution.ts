import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExecutionResult {
  output: string[];
  error: string | null;
  executedAt: string;
  isPreview?: boolean; // True for files that should render in preview instead of execute
}

// Languages that can be executed via Piston API
const EXECUTABLE_LANGUAGES = new Set([
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 
  'rust', 'ruby', 'php', 'swift', 'kotlin', 'csharp', 'bash', 'shell', 'makefile', 'make',
  'lua', 'perl', 'scala', 'r', 'haskell', 'elixir', 'clojure', 'dart', 'julia',
  'nim', 'zig', 'fortran', 'cobol', 'fsharp', 'ocaml', 'erlang', 'crystal',
  'lisp', 'prolog', 'racket', 'd', 'groovy', 'pascal', 'coffeescript',
  'assembly', 'nasm', 'sqlite', 'sql',
]);

export const useCodeExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);

  const executeCode = useCallback(async (code: string, language: string = 'javascript'): Promise<ExecutionResult> => {
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

    // Detect DOM-dependent JS/TS that should render in preview instead of executing server-side
    // Only match clear DOM usage patterns, not general APIs like fetch()
    if ((language.toLowerCase() === 'javascript' || language.toLowerCase() === 'typescript')) {
      const domAPIs = /\b(document\.(getElementById|querySelector|querySelectorAll|createElement|body|head)|\.innerHTML|\.textContent|\.appendChild|\.removeChild|\.classList\.|\.addEventListener\(|window\.(onload|onresize|location|history))\b/;
      if (domAPIs.test(code)) {
        return {
          output: [`🖼️ Browser/DOM code detected — rendering in preview instead of executing server-side.`],
          error: null,
          executedAt: new Date().toISOString(),
          isPreview: true,
        };
      }
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
      const { data, error } = await supabase.functions.invoke('execute-code', {
        body: { code, language }
      });

      // Handle Supabase function invocation errors
      if (error) {
        // Try to parse error message if it contains JSON
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
          executedAt: new Date().toISOString()
        };
      }

      // Handle case where data contains an error (400 response from edge function)
      if (data?.error) {
        return {
          output: data.output || [],
          error: data.error,
          executedAt: data.executedAt || new Date().toISOString()
        };
      }

      return data as ExecutionResult;
    } catch (err) {
      // Network or unexpected errors
      let errorMessage = 'Unknown error';
      if (err instanceof Error) {
        // Try to extract JSON error from message
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
        executedAt: new Date().toISOString()
      };
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const executeShellCommand = useCallback(async (command: string): Promise<ExecutionResult> => {
    return executeCode(command, 'shell');
  }, [executeCode]);

  return {
    executeCode,
    executeShellCommand,
    isExecuting
  };
};
