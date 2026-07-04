import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadProject, ok, err, flattenFiles, type FileNode } from "../_shared";

export default defineTool({
  name: "list_files",
  title: "List canvas files",
  description: "List every file in a canvas as a flat slash-delimited path list.",
  inputSchema: { canvas_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ canvas_id }, ctx) => {
    const { project, error } = await loadProject(ctx, canvas_id);
    if (error) return err(error);
    return ok({ files: flattenFiles(project.files as FileNode[]) });
  },
});
