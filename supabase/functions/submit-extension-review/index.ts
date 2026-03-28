import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { extension_id } = await req.json();
    if (!extension_id) return new Response(JSON.stringify({ error: "extension_id required" }), { status: 400, headers: corsHeaders });

    // Verify ownership
    const { data: ext, error: extErr } = await supabase.from("extensions").select("id, owner_id, status").eq("id", extension_id).single();
    if (extErr || !ext) return new Response(JSON.stringify({ error: "Extension not found" }), { status: 404, headers: corsHeaders });
    if (ext.owner_id !== user.id) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    // Update status to pending_review
    await supabase.from("extensions").update({ status: "pending_review" }).eq("id", extension_id);

    // Create review record
    const { data, error } = await supabase.from("extension_reviews").insert({
      extension_id,
      submitted_by: user.id,
      status: "pending",
    }).select().single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: corsHeaders });
  }
});
