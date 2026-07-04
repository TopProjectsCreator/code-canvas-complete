import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "resolve_comment",
  title: "Resolve comment",
  description: "Mark a code comment as resolved (or reopened).",
  inputSchema: {
    comment_id: z.string().uuid(),
    resolved: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ comment_id, resolved }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { data, error } = await userClient(ctx)
      .from("code_comments")
      .update({ resolved: resolved ?? true })
      .eq("id", comment_id)
      .select("id, resolved")
      .maybeSingle();
    if (error) return err(error.message);
    if (!data) return err("Comment not found or you can't update it.");
    return ok({ comment: data });
  },
});
