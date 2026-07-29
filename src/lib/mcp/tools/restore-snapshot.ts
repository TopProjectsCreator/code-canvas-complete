import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, loadProject, ok, err } from "../_shared";

export default defineTool({
  name: "restore_snapshot",
  title: "Restore project snapshot",
  description:
    "Restore a project's files to a previous snapshot state. The snapshot id comes from list_history. This is a destructive operation — the current files will be overwritten.",
  inputSchema: {
    snapshot_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ snapshot_id }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const sb = userClient(ctx);

    const { data: snap, error: snapErr } = await sb
      .from("project_snapshots")
      .select("project_id, files, label")
      .eq("id", snapshot_id)
      .eq("user_id", ctx.getUserId())
      .single();
    if (snapErr) return err("Snapshot not found or access denied.");
    if (!snap) return err("Snapshot not found.");

    const { project, error: projectError } = await loadProject(ctx, snap.project_id);
    if (projectError) return err(projectError);

    const { data: updated, error: updateErr } = await sb
      .from("projects")
      .update({ files: snap.files })
      .eq("id", snap.project_id)
      .eq("updated_at", project.updated_at)
      .select("id");
    if (updateErr) return err(updateErr.message);
    if (!updated || updated.length === 0) return err("Conflict: canvas was modified by another request. Please retry.");

    return ok({
      restored: true,
      project_id: snap.project_id,
      snapshot_label: snap.label,
    });
  },
});
