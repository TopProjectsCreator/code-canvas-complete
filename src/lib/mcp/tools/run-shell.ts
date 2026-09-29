import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

const SERVER_URL = (process.env.CODE_CANVAS_SERVER_URL || "https://code-canvas-complete-production.up.railway.app").replace(/\/+$/, "");

export default defineTool({
  name: "run_shell",
  title: "Run shell command",
  description:
    "Execute a bash command using the configured execution runtime, Wandbox, or a persistent CodeCanvas server session. Choose executor='server' to run on the server; its first call creates a session and returns sessionId, which you should reuse on later calls. Use destroy_container when finished. Returns stdout, stderr, and exit code.",
  inputSchema: {
    command: z
      .string()
      .min(1)
      .describe("Shell command or multi-line bash script to run."),
    stdin: z.string().optional(),
    timeout_ms: z.number().int().min(1000).max(60000).optional(),
    executor: z
      .enum(["wandbox", "server"])
      .optional()
      .describe("Execution location. Omit to use the configured runtime; choose server for a persistent server-side session or wandbox to force Wandbox."),
    sessionId: z
      .string()
      .min(1)
      .optional()
      .describe("Existing server session ID returned by a previous run_shell call with executor='server'."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  handler: async ({ command, stdin, timeout_ms, executor, sessionId }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;

    if (sessionId && executor !== "server") {
      return err("sessionId can only be used with executor='server'.");
    }

    if (executor === "server") {
      if (stdin) {
        return err("stdin is not supported by persistent server shell sessions. Run a command that reads from a file or pipe instead.");
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.getToken()}`,
      };

      try {
        let activeSessionId = sessionId;
        if (!activeSessionId) {
          const createResponse = await fetch(`${SERVER_URL}/api/replit/container`, {
            method: "POST",
            headers,
            body: JSON.stringify({ projectName: "mcp-shell" }),
          });
          const createText = await createResponse.text();
          let createData: Record<string, unknown>;
          try {
            createData = JSON.parse(createText) as Record<string, unknown>;
          } catch {
            createData = { raw: createText };
          }
          if (!createResponse.ok) {
            return err(`Server shell session creation failed (${createResponse.status}): ${createText.slice(0, 500)}`);
          }
          if (typeof createData.sessionId !== "string" || !createData.sessionId) {
            return err("Server did not return a sessionId for the persistent shell.");
          }
          activeSessionId = createData.sessionId;
        }

        const res = await fetch(
          `${SERVER_URL}/api/replit/container/${encodeURIComponent(activeSessionId)}/exec`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ command, timeout_ms: timeout_ms ?? 15000 }),
          },
        );
        const text = await res.text();
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(text) as Record<string, unknown>;
        } catch {
          parsed = { raw: text };
        }
        if (!res.ok) {
          return err(`Server shell execution failed (${res.status}, sessionId ${activeSessionId}): ${text.slice(0, 500)}`);
        }
        return ok({ ...parsed, sessionId: activeSessionId, executor: "server" });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err(`Server shell execution error: ${message}`);
      }
    }

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
            ...(executor ? { executor } : {}),
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
      const message = e instanceof Error ? e.message : String(e);
      return err(`Shell execution error: ${message}`);
    }
  },
});
