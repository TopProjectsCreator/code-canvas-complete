import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, loadProject, ok, err } from "../_shared";

export default defineTool({
  name: "create_snapshot",
  title: "Create project snapshot",
  description:
    "Create a named restore-point (snapshot) of a project's current file state. The AI should call this before making potentially destructive changes so the user can roll back via list_history / restore_snapshot.",
  inputSchema: {
    project_id: z.string().uuid(),
    label: z.string().min(1).max(200),
    detail: z.string().max(500).optional(),
    type: z
      .enum(["snapshot", "pre-edit", "pre-delete", "pre-run", "manual"])
      .optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ project_id, label, detail, type }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const { project, error } = await loadProject(ctx, project_id);
    if (error) return err(error);
    if (project.user_id !== ctx.getUserId()) {
      return err("Only the project owner can create snapshots.");
    }
    const { data, error: insertErr } = await userClient(ctx)
      .from("project_snapshots")
      .insert({
        project_id,
        user_id: ctx.getUserId(),
        type: type ?? "snapshot",
        label,
        detail,
        files: project.files,
      })
      .select("id, created_at")
      .single();
    if (insertErr) return err(insertErr.message);
    return ok({
      snapshot_id: data.id,
      created_at: data.created_at,
    });
  },
});
