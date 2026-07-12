import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

const SERVER_URL = (process.env.CODE_CANVAS_SERVER_URL || "https://code-canvas-complete-production.up.railway.app").replace(/\/+$/, "");

export default defineTool({
  name: "destroy_container",
  title: "Destroy container",
  description:
    "Destroy a container session and clean up all its resources. Kills the persistent bash process, removes the isolated filesystem directory, and frees server resources. Always call this when you are done with a container to avoid resource leaks.",
  inputSchema: {
    sessionId: z.string().min(1).describe("The session ID returned by create_container to destroy."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  handler: async ({ sessionId }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    try {
      const res = await fetch(`${SERVER_URL}/api/replit/container/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ctx.getToken()}`,
        },
      });
      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!res.ok) return err(`Container destroy failed (${res.status}): ${text.slice(0, 500)}`);
      return ok(parsed as Record<string, unknown>);
    } catch (e) {
      return err(`Container destroy error: ${(e as Error).message}`);
    }
  },
});
