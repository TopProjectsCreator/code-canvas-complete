import { useRef, useCallback, useState } from "react";
import { useCodeExecution } from "@/hooks/useCodeExecution";
import type { NbOutput } from "@/types/ide";

interface KernelState {
  status: "idle" | "running" | "ready" | "error";
  error: string | null;
}

export function useNotebookKernel() {
  const { executeCode, isExecuting } = useCodeExecution();
  const [kernel, setKernel] = useState<KernelState>({ status: "idle", error: null });
  const executionCountRef = useRef(0);

  const runCell = useCallback(
    async (code: string, kernelId: string): Promise<{ outputs: NbOutput[]; executionCount: number }> => {
      setKernel({ status: "running", error: null });
      executionCountRef.current += 1;
      const count = executionCountRef.current;
      const outputs: NbOutput[] = [];

      try {
        const result = await executeCode(code, "python");
        if (result.error) {
          outputs.push({
            output_type: "error",
            ename: "Error",
            evalue: result.error,
            traceback: [result.error],
          });
        }
        if (result.output && result.output.length > 0) {
          const text = result.output.join("\n");
          if (text.trim()) {
            outputs.push({
              output_type: "stream",
              name: "stdout",
              text,
            });
          }
        }
        setKernel({ status: "ready", error: null });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputs.push({
          output_type: "error",
          ename: "ExecutionError",
          evalue: msg,
          traceback: [msg],
        });
        setKernel({ status: "error", error: msg });
      }

      return { outputs, executionCount: count };
    },
    [executeCode],
  );

  const restartKernel = useCallback(() => {
    executionCountRef.current = 0;
    setKernel({ status: "idle", error: null });
  }, []);

  return { runCell, restartKernel, kernel, isExecuting };
}
