import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "star_canvas",
  title: "Star or unstar canvas",
  description: "Star (or unstar) a canvas as the signed-in user.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    starred: z.boolean().describe("true to star, false to unstar"),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ canvas_id, starred }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const sb = userClient(ctx);
    if (starred) {
      const { error } = await sb
        .from("project_stars")
        .upsert({ project_id: canvas_id, user_id: ctx.getUserId() });
      if (error) return err(error.message);
    } else {
      const { error } = await sb
        .from("project_stars")
        .delete()
        .eq("project_id", canvas_id)
        .eq("user_id", ctx.getUserId());
      if (error) return err(error.message);
    }
    return ok({ canvas_id, starred });
  },
});
