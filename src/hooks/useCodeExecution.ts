import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExecutionResult {
  output: string[];
  error: string | null;
  executedAt: string;
}

// Languages that can be executed via Piston API
const EXECUTABLE_LANGUAGES = new Set([
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 
  'rust', 'ruby', 'php', 'swift', 'kotlin', 'csharp', 'bash', 'shell', 'makefile', 'make'
]);

// Languages that are markup/config and can't be "run"
const NON_EXECUTABLE_LANGUAGES = new Set([
  'html', 'css', 'json', 'xml', 'yaml', 'yml', 'md', 'markdown', 'txt', 'svg', 'toml'
]);

export const useCodeExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);

  const executeCode = useCallback(async (code: string, language: string = 'javascript'): Promise<ExecutionResult> => {
    // Handle non-executable languages gracefully
    if (NON_EXECUTABLE_LANGUAGES.has(language.toLowerCase())) {
      const messages: Record<string, string> = {
        'html': 'HTML files are rendered in the preview. Click Run to see your HTML in the Webview.',
        'css': 'CSS files are applied when linked in HTML. Check the preview to see styles.',
        'json': 'JSON is a data format, not executable code.',
        'xml': 'XML is a markup format, not executable code.',
        'yaml': 'YAML is a configuration format, not executable code.',
        'yml': 'YAML is a configuration format, not executable code.',
        'md': 'Markdown is a documentation format, not executable code.',
        'markdown': 'Markdown is a documentation format, not executable code.',
        'toml': 'TOML is a configuration format, not executable code.',
      };
      return {
        output: [messages[language.toLowerCase()] || `${language.toUpperCase()} files cannot be executed directly.`],
        error: null,
        executedAt: new Date().toISOString()
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
