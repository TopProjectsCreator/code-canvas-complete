import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { userClient, ok, err } from "../_shared";

export default defineTool({
  name: "list_reviews",
  title: "List code reviews",
  description: "List code reviews visible to the signed-in user, optionally scoped to one canvas.",
  inputSchema: {
    canvas_id: z.string().uuid().optional(),
    status: z.enum(["open", "approved", "changes_requested", "closed"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ canvas_id, status }, ctx) => {
    let q = userClient(ctx)
      .from("code_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (canvas_id) q = q.eq("project_id", canvas_id);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok({ reviews: data ?? [] });
  },
});
