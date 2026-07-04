import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadProject, ok, err } from "../_shared";

export default defineTool({
  name: "get_preview_url",
  title: "Get canvas preview URL",
  description:
    "Return the public preview URL for a canvas. Requires the canvas to be published (has a publish_slug).",
  inputSchema: { canvas_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ canvas_id }, ctx) => {
    const { project, error } = await loadProject(ctx, canvas_id);
    if (error) return err(error);
    if (!project.publish_slug) {
      return err("Canvas is not published. Call update_canvas_meta to publish it first, or open it in the editor.");
    }
    const editorUrl = `https://codecanvas.app/project/${project.id}`;
    const publishedUrl = `https://${project.publish_slug}.codecanvas.app`;
    return ok({
      editor_url: editorUrl,
      published_url: publishedUrl,
      published_at: project.published_at,
    });
  },
});
