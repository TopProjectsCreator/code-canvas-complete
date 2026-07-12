import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

const SERVER_URL = (process.env.CODE_CANVAS_SERVER_URL || "https://code-canvas-complete-production.up.railway.app").replace(/\/+$/, "");

export default defineTool({
  name: "container_write_file",
  title: "Write file to container",
  description:
    "Write a file into a container session's filesystem. Creates parent directories as needed. Use this to add source code, configuration files, or data files to the container before running build commands.",
  inputSchema: {
    sessionId: z.string().min(1).describe("The session ID returned by create_container."),
    path: z.string().min(1).describe("File path within the container (e.g. 'src/index.ts' or 'package.json')."),
    content: z.string().describe("File content."),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: async ({ sessionId, path, content }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    try {
      const res = await fetch(`${SERVER_URL}/api/replit/container/${encodeURIComponent(sessionId)}/write-file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.getToken()}`,
        },
        body: JSON.stringify({ path, content }),
      });
      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!res.ok) return err(`Container write-file failed (${res.status}): ${text.slice(0, 500)}`);
      return ok(parsed as Record<string, unknown>);
    } catch (e) {
      return err(`Container write-file error: ${(e as Error).message}`);
    }
  },
});
