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
  name: "search_public_canvases",
  title: "Search public canvases",
  description:
    "Search public CodeCanvas projects by name, description, or language. Returns up to 20 results ordered by stars.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(1)
      .describe("Free-text query matched against name, description, and language."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Maximum number of results (default 10, max 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const { data, error } = await supabase()
      .from("projects")
      .select("id, name, description, language, stars_count, updated_at")
      .eq("is_public", true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,language.ilike.%${query}%`)
      .order("stars_count", { ascending: false })
      .limit(limit ?? 10);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
