import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "list_comments",
  title: "List code comments",
  description: "List code comments on a canvas, optionally filtered by file path.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    file_path: z.string().optional(),
    include_resolved: z.boolean().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ canvas_id, file_path, include_resolved }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    let q = userClient(ctx)
      .from("code_comments")
      .select("*")
      .eq("project_id", canvas_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (file_path) q = q.eq("file_path", file_path);
    if (!include_resolved) q = q.eq("resolved", false);
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok({ comments: data ?? [] });
  },
});
