import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

const SERVER_URL = (process.env.CODE_CANVAS_SERVER_URL || "https://code-canvas-complete-production.up.railway.app").replace(/\/+$/, "");

export default defineTool({
  name: "container_list_files",
  title: "List files in container",
  description:
    "List all files and directories in a container session's filesystem. Returns an array of file paths and sizes. Use this to explore the container's working directory, verify file structure, or find generated outputs.",
  inputSchema: {
    sessionId: z.string().min(1).describe("The session ID returned by create_container."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ sessionId }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    try {
      const res = await fetch(`${SERVER_URL}/api/replit/container/${encodeURIComponent(sessionId)}/files`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ctx.getToken()}`,
        },
      });
      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!res.ok) return err(`Container list-files failed (${res.status}): ${text.slice(0, 500)}`);
      return ok(parsed as Record<string, unknown>);
    } catch (e) {
      return err(`Container list-files error: ${(e as Error).message}`);
    }
  },
});
