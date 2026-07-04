import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, loadProject, ok, err } from "../_shared";

export default defineTool({
  name: "fork_canvas",
  title: "Fork canvas",
  description: "Create a copy of a canvas the user can access, owned by the signed-in user.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ canvas_id, name }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { project, error } = await loadProject(ctx, canvas_id);
    if (error) return err(error);
    const { data, error: insertError } = await userClient(ctx)
      .from("projects")
      .insert({
        user_id: ctx.getUserId(),
        name: name ?? `${project.name} (fork)`,
        description: project.description,
        language: project.language,
        is_public: false,
        files: project.files,
        forked_from: project.id,
      })
      .select("id, name")
      .single();
    if (insertError) return err(insertError.message);
    return ok({ canvas: data });
  },
});
