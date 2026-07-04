import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "get_featured_canvases",
  title: "Get featured canvases",
  description: "Return the top public CodeCanvas projects ordered by star count.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("How many featured canvases to return (default 5, max 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }) => {
    const { data, error } = await supabase()
      .from("projects")
      .select("id, name, description, language, stars_count, updated_at")
      .eq("is_public", true)
      .order("stars_count", { ascending: false })
      .limit(limit ?? 5);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
