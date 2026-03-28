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

    const { extension_id, version, source_bundle_url, changelog } = await req.json();
    if (!extension_id || !version || !source_bundle_url) {
      return new Response(JSON.stringify({ error: "extension_id, version, and source_bundle_url are required" }), { status: 400, headers: corsHeaders });
    }

    // Verify ownership
    const { data: ext, error: extErr } = await supabase.from("extensions").select("id, owner_id").eq("id", extension_id).single();
    if (extErr || !ext) return new Response(JSON.stringify({ error: "Extension not found" }), { status: 404, headers: corsHeaders });
    if (ext.owner_id !== user.id) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    // Create version record
    const { error: versionErr } = await supabase.from("extension_versions").insert({
      extension_id,
      version,
      source_bundle_url,
      changelog: changelog || null,
    });
    if (versionErr) return new Response(JSON.stringify({ error: versionErr.message }), { status: 400, headers: corsHeaders });

    // Update extension status and version
    const { data: updated, error: updateErr } = await supabase.from("extensions")
      .update({ status: "published", version })
      .eq("id", extension_id)
      .select()
      .single();

    if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 400, headers: corsHeaders });

    return new Response(JSON.stringify(updated), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: corsHeaders });
  }
});
