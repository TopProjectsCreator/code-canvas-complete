import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "list_my_canvases",
  title: "List my canvases",
  description: "List CodeCanvas projects owned by the signed-in user.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { data, error } = await userClient(ctx)
      .from("projects")
      .select("id, name, description, language, is_public, stars_count, updated_at")
      .eq("user_id", ctx.getUserId())
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return err(error.message);
    return ok({ canvases: data ?? [] });
  },
});
