import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

export default defineTool({
  name: "run_code",
  title: "Run code",
  description:
    "Execute a code snippet on the CodeCanvas execution backend (containerized sandbox for supported languages). Returns stdout, stderr, and exit code.",
  inputSchema: {
    language: z.string().min(1).describe("e.g. `python`, `javascript`, `typescript`, `bash`, `java`, `cpp`, `rust`, `go`."),
    code: z.string().min(1),
    stdin: z.string().optional(),
    timeout_ms: z.number().int().min(1000).max(60000).optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: async ({ language, code, stdin, timeout_ms }, ctx) => {
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
            apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            language,
            code,
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
      if (!res.ok) return err(`Execution failed (${res.status}): ${text.slice(0, 500)}`);
      return ok(parsed as Record<string, unknown>);
    } catch (e) {
      return err(`Execution error: ${(e as Error).message}`);
    }
  },
});
