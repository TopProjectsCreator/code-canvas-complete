import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, userClient, ok, err } from "../_shared";

export default defineTool({
  name: "list_my_canvases",
  title: "List my canvases",
  description:
    "List CodeCanvas projects owned by the signed-in user, newest first. Paginate with offset; use next_offset until has_more is false.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Page size (default 25, max 100)."),
    offset: z.number().int().min(0).optional().describe("Number of canvases to skip (default 0)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, offset }, ctx) => {
    const gate = requireAuth(ctx);
    if (gate) return gate;
    const pageSize = limit ?? 25;
    const start = offset ?? 0;
    const { data, error, count } = await userClient(ctx)
      .from("projects")
      .select("id, name, description, language, is_public, stars_count, updated_at", { count: "exact" })
      .eq("user_id", ctx.getUserId())
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) return err(error.message);
    const canvases = data ?? [];
    const total = count ?? start + canvases.length;
    const nextOffset = start + canvases.length;
    const hasMore = nextOffset < total;
    return ok({ canvases, total, offset: start, limit: pageSize, has_more: hasMore, next_offset: hasMore ? nextOffset : null });
  },
});
