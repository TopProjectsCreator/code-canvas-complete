import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "add_comment",
  title: "Add code comment",
  description: "Post a comment on a specific line of a file in a canvas.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    file_path: z.string().min(1),
    line_number: z.number().int().min(1),
    content: z.string().min(1).max(4000),
    parent_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ canvas_id, file_path, line_number, content, parent_id }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { data, error } = await userClient(ctx)
      .from("code_comments")
      .insert({
        project_id: canvas_id,
        user_id: ctx.getUserId(),
        file_path,
        line_number,
        content,
        parent_id: parent_id ?? null,
      })
      .select("*")
      .single();
    if (error) return err(error.message);
    return ok({ comment: data });
  },
});
