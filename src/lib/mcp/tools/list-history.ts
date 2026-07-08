import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "list_history",
  title: "List project history",
  description:
    "List snapshot restore-points for a project the user owns. Each entry includes the label, type, detail, and timestamp. Use the id with restore_snapshot to roll back.",
  inputSchema: {
    project_id: z.string().uuid(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, limit }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { data, error } = await userClient(ctx)
      .from("project_snapshots")
      .select("id, type, label, detail, created_at")
      .eq("project_id", project_id)
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return err(error.message);
    return ok({ history: data ?? [] });
  },
});
