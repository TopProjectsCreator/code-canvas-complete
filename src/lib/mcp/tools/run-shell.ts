import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

export default defineTool({
  name: "run_shell",
  title: "Run shell command",
  description:
    "Execute an arbitrary shell command (bash) in the CodeCanvas execution sandbox. Returns stdout, stderr, and exit code. Supports multi-line scripts and pipes.",
  inputSchema: {
    command: z
      .string()
      .min(1)
      .describe("Shell command or multi-line bash script to run."),
    stdin: z.string().optional(),
    timeout_ms: z.number().int().min(1000).max(60000).optional(),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  handler: async ({ command, stdin, timeout_ms }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    try {
      const res = await fetch(
        `${process.env.SUPABASE_URL}/functions/v1/execute-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.getToken()}`,
            apikey:
              process.env.SUPABASE_PUBLISHABLE_KEY ??
              process.env.SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            language: "bash",
            code: command,
            stdin: stdin ?? "",
            timeout: timeout_ms ?? 15000,
          }),
        },
      );
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
      if (!res.ok)
        return err(`Shell execution failed (${res.status}): ${text.slice(0, 500)}`);
      return ok(parsed as Record<string, unknown>);
    } catch (e) {
      return err(`Shell execution error: ${(e as Error).message}`);
    }
  },
});
