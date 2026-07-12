import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, ok, err } from "../_shared";

const SERVER_URL = (process.env.CODE_CANVAS_SERVER_URL || "https://code-canvas-complete-production.up.railway.app").replace(/\/+$/, "");

export default defineTool({
  name: "create_container",
  title: "Create persistent container",
  description:
    "Create a new persistent shell container with an isolated filesystem and a long-running bash process. The container preserves state between commands (current directory, environment variables, installed packages, etc.). Returns a sessionId that must be used with container_exec, container_write_file, container_read_file, container_list_files, and destroy_container.",
  inputSchema: {
    projectName: z.string().optional().describe("Optional friendly name for the container project."),
    files: z
      .array(z.object({
        path: z.string(),
        content: z.string(),
      }))
      .optional()
      .describe("Optional initial files to seed into the container's filesystem."),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: async ({ projectName, files }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    try {
      const res = await fetch(`${SERVER_URL}/api/replit/container`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.getToken()}`,
        },
        body: JSON.stringify({ projectName, files }),
      });
      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!res.ok) return err(`Failed to create container (${res.status}): ${text.slice(0, 500)}`);
      return ok(parsed as Record<string, unknown>);
    } catch (e) {
      return err(`Container creation error: ${(e as Error).message}`);
    }
  },
});
