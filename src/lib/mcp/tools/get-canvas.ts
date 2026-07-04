import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadProject, ok, err, flattenFiles, type FileNode } from "../_shared";

export default defineTool({
  name: "get_canvas",
  title: "Get canvas details",
  description:
    "Get full details of one canvas the user can access (owned, collaborated on, or public). Returns metadata and a flat file listing.",
  inputSchema: { canvas_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ canvas_id }, ctx) => {
    const { project, error } = await loadProject(ctx, canvas_id);
    if (error) return err(error);
    const files = flattenFiles(project.files as FileNode[]);
    return ok({
      canvas: {
        id: project.id,
        name: project.name,
        description: project.description,
        language: project.language,
        is_public: project.is_public,
        stars_count: project.stars_count,
        publish_slug: project.publish_slug,
        published_at: project.published_at,
        updated_at: project.updated_at,
        file_count: files.length,
      },
      files,
    });
  },
});
