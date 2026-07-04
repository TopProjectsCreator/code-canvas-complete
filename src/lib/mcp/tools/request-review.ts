import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "request_review",
  title: "Request code review",
  description: "Open a code review request on a canvas.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    reviewer_id: z.string().uuid().optional(),
    file_paths: z.array(z.string()).optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ canvas_id, title, description, reviewer_id, file_paths }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { data, error } = await userClient(ctx)
      .from("code_reviews")
      .insert({
        project_id: canvas_id,
        requester_id: ctx.getUserId(),
        reviewer_id: reviewer_id ?? null,
        title,
        description: description ?? null,
        file_paths: file_paths ?? [],
        status: "open",
      })
      .select("*")
      .single();
    if (error) return err(error.message);
    return ok({ review: data });
  },
});
