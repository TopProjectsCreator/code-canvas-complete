import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

const SERVER_URL = (process.env.CODE_CANVAS_SERVER_URL || "https://code-canvas-complete-production.up.railway.app").replace(/\/+$/, "");

export default defineTool({
  name: "container_read_file",
  title: "Read file from container",
  description:
    "Read a file from a container session's filesystem. Returns the file content as a string. Use this to inspect generated output, read build artifacts, check configuration files, or examine logs.",
  inputSchema: {
    sessionId: z.string().min(1).describe("The session ID returned by create_container."),
    path: z.string().min(1).describe("File path within the container (e.g. 'dist/output.json' or 'src/index.ts')."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ sessionId, path }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    try {
      const res = await fetch(`${SERVER_URL}/api/replit/container/${encodeURIComponent(sessionId)}/read-file?path=${encodeURIComponent(path)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ctx.getToken()}`,
        },
      });
      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!res.ok) return err(`Container read-file failed (${res.status}): ${text.slice(0, 500)}`);
      return ok(parsed as Record<string, unknown>);
    } catch (e) {
      return err(`Container read-file error: ${(e as Error).message}`);
    }
  },
});
