import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadProject, ok, err, findFile, type FileNode } from "../_shared";

export default defineTool({
  name: "read_file",
  title: "Read canvas file",
  description: "Read the full contents of one file in a canvas.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    path: z.string().min(1).describe("Slash-delimited path from the root folder (e.g. `my-repl/main.zig`)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ canvas_id, path }, ctx) => {
    const { project, error } = await loadProject(ctx, canvas_id);
    if (error) return err(error);
    const file = findFile(project.files as FileNode[], path);
    if (!file) return err(`File not found: ${path}`);
    return ok(
      { path, language: file.language, content: file.content ?? "" },
      file.content ?? "",
    );
  },
});
