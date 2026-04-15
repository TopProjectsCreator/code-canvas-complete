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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { extension_id, action } = await req.json();
    if (!extension_id) return new Response(JSON.stringify({ error: "extension_id required" }), { status: 400, headers: corsHeaders });

    if (action === "uninstall") {
      const { error } = await supabase.from("installed_extensions")
        .delete()
        .eq("user_id", user.id)
        .eq("extension_id", extension_id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

      // Decrement install count
      try { await supabaseAdmin.rpc("decrement_extension_installs", { ext_id: extension_id }); } catch { /* ignore */ }

      return new Response(JSON.stringify({ ok: true, action: "uninstalled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Install
    const { error } = await supabase.from("installed_extensions").insert({
      user_id: user.id,
      extension_id,
    });
    if (error) {
      if (error.code === "23505") return new Response(JSON.stringify({ ok: true, action: "already_installed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    }

    // Increment install count
    try { await supabaseAdmin.rpc("increment_extension_installs", { ext_id: extension_id }); } catch { /* ignore */ }

    return new Response(JSON.stringify({ ok: true, action: "installed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: corsHeaders });
  }
});
