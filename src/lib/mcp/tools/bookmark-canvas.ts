import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "bookmark_canvas",
  title: "Bookmark or unbookmark canvas",
  description: "Bookmark (or remove bookmark on) a canvas as the signed-in user.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    bookmarked: z.boolean(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ canvas_id, bookmarked }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const sb = userClient(ctx);
    if (bookmarked) {
      const { error } = await sb
        .from("project_bookmarks")
        .upsert({ project_id: canvas_id, user_id: ctx.getUserId() });
      if (error) return err(error.message);
    } else {
      const { error } = await sb
        .from("project_bookmarks")
        .delete()
        .eq("project_id", canvas_id)
        .eq("user_id", ctx.getUserId());
      if (error) return err(error.message);
    }
    return ok({ canvas_id, bookmarked });
  },
});
