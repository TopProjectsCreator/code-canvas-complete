import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "delete_canvas",
  title: "Delete canvas",
  description: "Permanently delete a canvas owned by the signed-in user.",
  inputSchema: { canvas_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ canvas_id }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { error } = await userClient(ctx)
      .from("projects")
      .delete()
      .eq("id", canvas_id)
      .eq("user_id", ctx.getUserId());
    if (error) return err(error.message);
    return ok({ deleted: canvas_id });
  },
});
