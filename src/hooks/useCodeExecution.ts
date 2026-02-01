import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExecutionResult {
  output: string[];
  error: string | null;
  executedAt: string;
}

export const useCodeExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);

  const executeCode = useCallback(async (code: string, language: string = 'javascript'): Promise<ExecutionResult> => {
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
