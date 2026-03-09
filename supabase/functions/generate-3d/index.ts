import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, taskId } = await req.json();

    // Get user's Meshy API key from database
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Get Meshy API key
    const { data: keyData } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .eq("provider", "meshy")
      .single();

    if (!keyData?.api_key) {
      return new Response(
        JSON.stringify({ error: "Meshy API key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const meshyApiKey = keyData.api_key;

    // If taskId provided, check status
    if (taskId) {
      const statusResp = await fetch(`https://api.meshy.ai/openapi/v1/text-to-3d/${taskId}`, {
        headers: { Authorization: `Bearer ${meshyApiKey}` },
      });

      const statusData = await statusResp.json();

      if (statusData.status === "SUCCEEDED") {
        return new Response(
          JSON.stringify({
            status: "SUCCEEDED",
            glbUrl: statusData.model_urls?.glb || statusData.model_url,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (statusData.status === "FAILED") {
        return new Response(
          JSON.stringify({ status: "FAILED", error: statusData.message || "Generation failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ status: statusData.status || "PENDING" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Start new generation
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const createResp = await fetch("https://api.meshy.ai/openapi/v1/text-to-3d", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${meshyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "preview",
        prompt: prompt,
        art_style: "realistic",
        negative_prompt: "low quality, blurry, distorted",
      }),
    });

    const createData = await createResp.json();

    if (!createResp.ok) {
      return new Response(
        JSON.stringify({ error: createData.message || "Failed to start generation" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: createResp.status }
      );
    }

    // Return task ID for polling
    return new Response(
      JSON.stringify({
        status: "polling",
        taskId: createData.result || createData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});