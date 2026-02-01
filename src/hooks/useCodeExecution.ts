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

      if (error) {
        return {
          output: [],
          error: error.message,
          executedAt: new Date().toISOString()
        };
      }

      return data as ExecutionResult;
    } catch (err) {
      return {
        output: [],
        error: err instanceof Error ? err.message : 'Unknown error',
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
