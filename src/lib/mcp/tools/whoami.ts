import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, userClient, ok } from "../_shared";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in user's id, email, and profile display name.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { data } = await userClient(ctx)
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    return ok({
      user_id: ctx.getUserId(),
      email: ctx.getUserEmail(),
      display_name: data?.display_name ?? null,
      avatar_url: data?.avatar_url ?? null,
    });
  },
});
