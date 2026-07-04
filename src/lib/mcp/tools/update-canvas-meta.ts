import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "update_canvas_meta",
  title: "Update canvas metadata",
  description: "Rename, re-describe, change language, or toggle public visibility.",
  inputSchema: {
    canvas_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    language: z.string().max(40).optional(),
    is_public: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ canvas_id, ...patch }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (!Object.keys(clean).length) return err("No fields to update.");
    const { data, error } = await userClient(ctx)
      .from("projects")
      .update(clean)
      .eq("id", canvas_id)
      .eq("user_id", ctx.getUserId())
      .select("id, name, description, language, is_public")
      .maybeSingle();
    if (error) return err(error.message);
    if (!data) return err("Canvas not found or not owned by you.");
    return ok({ canvas: data });
  },
});
