import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Provider = "meshy" | "sloyd" | "tripo" | "modelslab" | "fal" | "neural4d";

const PROVIDER_INFO: Record<Provider, string> = {
  meshy: "Meshy",
  sloyd: "Sloyd",
  tripo: "Tripo",
  modelslab: "ModelsLab",
  fal: "Fal.ai",
  neural4d: "Neural4D",
};

// Provider handlers
async function handleMeshy(apiKey: string, prompt: string, taskId: string | null, corsHeaders: Record<string, string>) {
  if (taskId) {
    const statusResp = await fetch(`https://api.meshy.ai/openapi/v1/text-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const statusData = await statusResp.json();

    if (statusData.status === "SUCCEEDED") {
      return new Response(
        JSON.stringify({ status: "SUCCEEDED", glbUrl: statusData.model_urls?.glb || statusData.model_url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (statusData.status === "FAILED") {
      return new Response(
        JSON.stringify({ status: "FAILED", error: statusData.message || "Generation failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ status: statusData.status || "PENDING" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const createResp = await fetch("https://api.meshy.ai/openapi/v1/text-to-3d", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "preview", prompt, art_style: "realistic", negative_prompt: "low quality, blurry, distorted" }),
  });
  const createData = await createResp.json();
  if (!createResp.ok) {
    return new Response(
      JSON.stringify({ error: createData.message || "Failed to start generation" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: createResp.status }
    );
  }
  return new Response(
    JSON.stringify({ status: "polling", taskId: createData.result || createData.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleSloyd(apiKey: string, prompt: string, corsHeaders: Record<string, string>) {
  // Sloyd generates synchronously
  const resp = await fetch("https://api.sloyd.ai/v1/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, output_format: "glb" }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return new Response(
      JSON.stringify({ error: data.error || data.message || "Sloyd generation failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: resp.status }
    );
  }
  return new Response(
    JSON.stringify({ status: "SUCCEEDED", glbUrl: data.model_url || data.url }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleTripo(apiKey: string, prompt: string, taskId: string | null, corsHeaders: Record<string, string>) {
  if (taskId) {
    const statusResp = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await statusResp.json();
    const status = data.data?.status;
    if (status === "success") {
      return new Response(
        JSON.stringify({ status: "SUCCEEDED", glbUrl: data.data?.output?.model }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (status === "failed") {
      return new Response(
        JSON.stringify({ status: "FAILED", error: "Tripo generation failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ status: "PENDING" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const createResp = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text_to_model", prompt }),
  });
  const data = await createResp.json();
  if (!createResp.ok) {
    const errMsg = data.message || data.error || "Tripo generation failed";
    const isBilling = typeof errMsg === "string" && /credit|balance|payment|subscribe/i.test(errMsg);
    return new Response(
      JSON.stringify({
        status: "FAILED",
        error: isBilling
          ? "Your Tripo account is out of credits. Top up at tripo3d.ai or switch providers (Meshy, Sloyd, Neural4D)."
          : errMsg,
        billing: isBilling,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
  return new Response(
    JSON.stringify({ status: "polling", taskId: data.data?.task_id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleModelsLab(apiKey: string, prompt: string, taskId: string | null, corsHeaders: Record<string, string>) {
  if (taskId) {
    const statusResp = await fetch("https://modelslab.com/api/v6/3d/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, request_id: taskId }),
    });
    const data = await statusResp.json();
    if (data.status === "success") {
      return new Response(
        JSON.stringify({ status: "SUCCEEDED", glbUrl: data.output?.[0] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (data.status === "error") {
      return new Response(
        JSON.stringify({ status: "FAILED", error: data.message || "ModelsLab failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ status: "PENDING" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const createResp = await fetch("https://modelslab.com/api/v6/3d/text_to_3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: apiKey, prompt, negative_prompt: "low quality", guidance_scale: 15, num_inference_steps: 64 }),
  });
  const data = await createResp.json();
  if (data.status === "error" || !createResp.ok) {
    const errMsg = data.message || data.messege || "ModelsLab failed";
    const isBilling = typeof errMsg === "string" && /out of credits|subscribe|fund your wallet|exhausted/i.test(errMsg);
    return new Response(
      JSON.stringify({
        status: "FAILED",
        error: isBilling
          ? "Your ModelsLab account is out of credits. Top up at modelslab.com or switch providers (Meshy, Tripo, Sloyd, Neural4D)."
          : errMsg,
        billing: isBilling,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
  if (data.status === "success" && data.output?.[0]) {
    return new Response(
      JSON.stringify({ status: "SUCCEEDED", glbUrl: data.output[0] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ status: "polling", taskId: data.id || data.request_id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleFal(apiKey: string, prompt: string, corsHeaders: Record<string, string>) {
  // Fal.ai Hyper3D Rodin - synchronous
  const resp = await fetch("https://fal.run/fal-ai/hyper3d/rodin", {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, geometry_file_format: "glb" }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const errMsg = data.detail || data.message || data.error || "Fal.ai generation failed";
    const isBilling = typeof errMsg === "string" && /exhausted balance|user is locked|top up/i.test(errMsg);
    return new Response(
      JSON.stringify({
        status: "FAILED",
        error: isBilling
          ? "Your Fal.ai account is out of credits. Top up at fal.ai/dashboard/billing or switch providers (Meshy, Tripo, Sloyd, ModelsLab, Neural4D)."
          : errMsg,
        billing: isBilling,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
  return new Response(
    JSON.stringify({ status: "SUCCEEDED", glbUrl: data.model_mesh?.url || data.output?.url }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleNeural4D(apiKey: string, prompt: string, taskId: string | null, corsHeaders: Record<string, string>) {
  // Neural4D uses an async flow:
  // 1) create generation job -> returns uuids[]
  // 2) poll /retrieveModel with uuid until codeStatus=0
  const unreachableMsg = "Neural4D's API (port 3000) is not reachable from our servers. Please switch providers (Meshy, Tripo, Sloyd, ModelsLab, or Fal.ai).";
  if (taskId) {
    let statusResp: Response;
    try {
      statusResp = await fetch("https://alb.neural4d.com:3000/api/retrieveModel", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uuid: taskId }),
      });
    } catch (_e) {
      return new Response(
        JSON.stringify({ status: "FAILED", error: unreachableMsg, unreachable: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    const statusData = await statusResp.json();
    if (!statusResp.ok) {
      return new Response(
        JSON.stringify({ status: "FAILED", error: statusData.error || statusData.message || "Neural4D status check failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const codeStatus = statusData.codeStatus;
    if (codeStatus === 0 && statusData.modelUrl) {
      return new Response(
        JSON.stringify({ status: "SUCCEEDED", glbUrl: statusData.modelUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (codeStatus === -3) {
      return new Response(
        JSON.stringify({ status: "FAILED", error: statusData.message || "Neural4D generation failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (codeStatus === -1 || codeStatus === -2) {
      return new Response(
        JSON.stringify({ error: statusData.message || "Neural4D request invalid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ status: "PENDING" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const createResp = await fetch("https://alb.neural4d.com:3000/api/generateModelWithText", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, modelCount: 1, disablePbr: 0 }),
  });
  const createData = await createResp.json();
  if (!createResp.ok) {
    return new Response(
      JSON.stringify({ error: createData.error || createData.message || "Failed to start Neural4D generation" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: createResp.status }
    );
  }

  const firstUuid = Array.isArray(createData.uuids) ? createData.uuids[0] : null;
  if (!firstUuid) {
    return new Response(
      JSON.stringify({ error: createData.message || "Neural4D did not return a model id" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ status: "polling", taskId: firstUuid }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, taskId, provider = "meshy" } = await req.json();

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

    const selectedProvider = (provider as Provider) || "meshy";
    const providerName = PROVIDER_INFO[selectedProvider] || "3D Provider";

    // Get API key for selected provider
    const { data: keyData } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .eq("provider", selectedProvider)
      .single();

    if (!keyData?.api_key) {
      return new Response(
        JSON.stringify({ error: `${providerName} API key not configured` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const apiKey = keyData.api_key;

    if (!taskId && !prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    switch (selectedProvider) {
      case "meshy":
        return await handleMeshy(apiKey, prompt, taskId, corsHeaders);
      case "sloyd":
        return await handleSloyd(apiKey, prompt, corsHeaders);
      case "tripo":
        return await handleTripo(apiKey, prompt, taskId, corsHeaders);
      case "modelslab":
        return await handleModelsLab(apiKey, prompt, taskId, corsHeaders);
      case "fal":
        return await handleFal(apiKey, prompt, corsHeaders);
      case "neural4d":
        return await handleNeural4D(apiKey, prompt, taskId, corsHeaders);
      default:
        return new Response(
          JSON.stringify({ error: "Unknown provider" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
