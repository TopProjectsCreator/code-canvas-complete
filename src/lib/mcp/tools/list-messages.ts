import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "list_messages",
  title: "List inbox messages",
  description: "List the signed-in user's inbox messages.",
  inputSchema: {
    unread_only: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only, limit }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    let q = userClient(ctx)
      .from("messages")
      .select("id, sender_id, subject, kind, read_at, created_at, labels")
      .eq("recipient_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (unread_only) q = q.is("read_at", null);
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok({ messages: data ?? [] });
  },
});
