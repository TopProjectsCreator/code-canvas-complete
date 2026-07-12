import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

const SERVER_URL = (process.env.CODE_CANVAS_SERVER_URL || "https://code-canvas-complete-production.up.railway.app").replace(/\/+$/, "");

export default defineTool({
  name: "container_exec",
  title: "Execute command in container",
  description:
    "Run a bash command in an existing container session. The command runs in the persistent bash process so state is preserved: current working directory, environment variables, installed packages, aliases, etc. Returns stdout and exit code. Use this to run build tools, install packages, start servers, or any shell operation.",
  inputSchema: {
    sessionId: z.string().min(1).describe("The session ID returned by create_container."),
    command: z.string().min(1).describe("Bash command or multi-line script to run."),
    timeout_ms: z.number().int().min(1000).max(120000).optional().describe("Timeout in milliseconds (default 30000, max 120000)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  handler: async ({ sessionId, command, timeout_ms }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    try {
      const res = await fetch(`${SERVER_URL}/api/replit/container/${encodeURIComponent(sessionId)}/exec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.getToken()}`,
        },
        body: JSON.stringify({ command, timeout_ms: timeout_ms ?? 30000 }),
      });
      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!res.ok) return err(`Container exec failed (${res.status}): ${text.slice(0, 500)}`);
      return ok(parsed as Record<string, unknown>);
    } catch (e) {
      return err(`Container exec error: ${(e as Error).message}`);
    }
  },
});
