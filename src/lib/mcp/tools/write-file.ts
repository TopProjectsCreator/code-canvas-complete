import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, loadProject, ok, err, upsertFile, type FileNode } from "../_shared";

export default defineTool({
  name: "write_file",
  title: "Write canvas file",
  description: "Create or overwrite a file in a canvas the user owns.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    path: z.string().min(1),
    content: z.string(),
    language: z.string().max(40).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ canvas_id, path, content, language }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { project, error } = await loadProject(ctx, canvas_id);
    if (error) return err(error);
    if (project.user_id !== ctx.getUserId()) {
      return err("Only the canvas owner can write files.");
    }
    const nextFiles = upsertFile(project.files as FileNode[], path, content, language);
    const { data: updated, error: updateError } = await userClient(ctx)
      .from("projects")
      .update({ files: nextFiles })
      .eq("id", canvas_id)
      .eq("updated_at", project.updated_at)
      .select("id");
    if (updateError) return err(updateError.message);
    if (!updated || updated.length === 0) return err("Conflict: canvas was modified by another request. Please retry.");
    return ok({ path, bytes: content.length });
  },
});
