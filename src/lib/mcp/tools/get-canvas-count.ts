import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";

function supabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "get_canvas_count",
  title: "Get total canvas count",
  description: "Return the total number of CodeCanvas projects across the platform.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const { data, error } = await supabase().rpc("get_total_canvases_count");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const count = typeof data === "number" ? data : Number(data ?? 0);
    return {
      content: [{ type: "text", text: `Total canvases: ${count}` }],
      structuredContent: { count },
    };
  },
});
