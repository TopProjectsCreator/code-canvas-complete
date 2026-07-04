import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "send_message",
  title: "Send inbox message",
  description: "Send a message to another CodeCanvas user by user id.",
  inputSchema: {
    recipient_id: z.string().uuid(),
    subject: z.string().min(1).max(200),
    body_html: z.string().min(1).max(20000),
    kind: z.string().max(40).optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ recipient_id, subject, body_html, kind }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { data, error } = await userClient(ctx)
      .from("messages")
      .insert({
        sender_id: ctx.getUserId(),
        recipient_id,
        subject,
        body_html,
        kind: kind ?? "direct",
      })
      .select("id, subject, created_at")
      .single();
    if (error) return err(error.message);
    return ok({ message: data });
  },
});
