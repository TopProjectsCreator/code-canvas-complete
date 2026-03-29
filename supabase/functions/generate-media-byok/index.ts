import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "image" | "video";
type Provider =
  | "openrouter"
  | "openai"
  | "gemini"
  | "stability"
  | "ideogram"
  | "replicate"
  | "runway"
  | "kling"
  | "higgsfield"
  | "luma"
  | "pika";

const getServiceClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const extractMediaUrl = (payload: any): string | null => {
  return (
    payload?.mediaUrl ||
    payload?.output?.[0] ||
    payload?.data?.[0]?.url ||
    payload?.data?.[0]?.image_url ||
    payload?.data?.[0]?.video_url ||
    payload?.result?.url ||
    payload?.result?.video?.url ||
    payload?.output?.video ||
    payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
    payload?.choices?.[0]?.message?.videos?.[0]?.video_url?.url ||
    payload?.candidates?.[0]?.content?.parts?.find((p: any) => p?.fileData?.fileUri)?.fileData?.fileUri ||
    null
  );
};

const toDataUrl = async (url: string, mime = "image/png") => {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  return `data:${response.headers.get("content-type") || mime};base64,${b64}`;
};

async function callOpenRouter(apiKey: string, mode: Mode, prompt: string, model: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: `${mode === "video" ? "Generate a short video" : "Generate an image"}: ${prompt}` }],
      modalities: [mode, "text"],
    }),
  });
  const data = await response.json();
  const mediaUrl = extractMediaUrl(data);
  if (!response.ok || !mediaUrl) {
    throw new Error(data?.error?.message || "OpenRouter generation failed");
  }
  return mediaUrl;
}

async function callOpenAI(apiKey: string, prompt: string, model: string) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size: "1024x1024" }),
  });
  const data = await response.json();
  const mediaUrl = extractMediaUrl(data);
  if (!response.ok || !mediaUrl) {
    throw new Error(data?.error?.message || "OpenAI image generation failed");
  }
  return mediaUrl;
}

async function callGemini(apiKey: string, prompt: string, model: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });
  const data = await response.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
  if (!response.ok || !part?.inlineData?.data) {
    throw new Error(data?.error?.message || "Gemini image generation failed");
  }
  return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
}

async function callStability(apiKey: string, prompt: string, model: string) {
  const endpoint = model === "stable-image-ultra" ? "ultra" : "core";
  const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, output_format: "png" }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Stability generation failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (data?.image) return `data:image/png;base64,${data.image}`;
    const url = extractMediaUrl(data);
    if (!url) throw new Error("Stability returned no image");
    return url;
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(binary)}`;
}

async function callIdeogram(apiKey: string, prompt: string, model: string) {
  const response = await fetch("https://api.ideogram.ai/generate", {
    method: "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_request: {
        prompt,
        model,
        aspect_ratio: "1:1",
      },
    }),
  });
  const data = await response.json();
  const mediaUrl = extractMediaUrl(data);
  if (!response.ok || !mediaUrl) {
    throw new Error(data?.error?.message || "Ideogram generation failed");
  }
  return mediaUrl;
}

async function callReplicate(apiKey: string, prompt: string, model: string) {
  const create = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      version: undefined,
      model,
      input: { prompt },
    }),
  });

  const createData = await create.json();
  if (!create.ok) {
    throw new Error(createData?.detail || "Replicate request failed");
  }

  let status = createData;
  const predictionUrl = createData?.urls?.get;
  for (let i = 0; i < 30 && predictionUrl; i++) {
    if (status?.status === "succeeded" || status?.status === "failed" || status?.status === "canceled") break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const poll = await fetch(predictionUrl, { headers: { Authorization: `Token ${apiKey}` } });
    status = await poll.json();
  }

  const output = status?.output;
  const mediaUrl = Array.isArray(output) ? output[0] : output || extractMediaUrl(status);
  if (!mediaUrl) {
    throw new Error(status?.error || "Replicate returned no media");
  }
  return mediaUrl;
}

async function callRunway(apiKey: string, prompt: string, model: string) {
  const create = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({ model, promptText: prompt }),
  });
  const createData = await create.json();
  if (!create.ok) throw new Error(createData?.error || "Runway request failed");

  const taskId = createData?.id;
  if (!taskId) throw new Error("Runway task id missing");

  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const poll = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
    });
    const data = await poll.json();
    const mediaUrl = extractMediaUrl(data);
    if (mediaUrl) return mediaUrl;
    if (data?.status === "FAILED" || data?.status === "CANCELLED") {
      throw new Error(data?.error || "Runway generation failed");
    }
  }

  throw new Error("Runway generation timed out");
}

async function callFalVideo(apiKey: string, prompt: string, endpoint: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await response.json();
  const mediaUrl = extractMediaUrl(data);
  if (!response.ok || !mediaUrl) throw new Error(data?.detail || data?.error || "Video generation failed");
  return mediaUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Missing auth token" }, 401);

    const supabase = getServiceClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Invalid user token" }, 401);

    const { mode, prompt, provider, model } = await req.json() as { mode: Mode; prompt: string; provider: Provider; model: string };
    if (!mode || !prompt || !provider || !model) return json({ error: "Missing required fields" }, 400);

    const { data: keyRow, error: keyError } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userData.user.id)
      .eq("provider", provider)
      .maybeSingle();

    if (keyError) throw keyError;
    if (!keyRow?.api_key) return json({ error: `No ${provider} API key configured in BYOK settings` }, 400);

    const apiKey = keyRow.api_key as string;
    let mediaUrl: string;

    if (provider === "openrouter") {
      mediaUrl = await callOpenRouter(apiKey, mode, prompt, model);
    } else if (provider === "openai") {
      if (mode !== "image") return json({ error: "OpenAI direct provider currently supports image mode only" }, 400);
      mediaUrl = await callOpenAI(apiKey, prompt, model);
    } else if (provider === "gemini") {
      if (mode !== "image") return json({ error: "Gemini direct provider currently supports image mode only" }, 400);
      mediaUrl = await callGemini(apiKey, prompt, model);
    } else if (provider === "stability") {
      if (mode !== "image") return json({ error: "Stability supports image generation only" }, 400);
      mediaUrl = await callStability(apiKey, prompt, model);
    } else if (provider === "ideogram") {
      if (mode !== "image") return json({ error: "Ideogram supports image generation only" }, 400);
      mediaUrl = await callIdeogram(apiKey, prompt, model);
    } else if (provider === "replicate") {
      mediaUrl = await callReplicate(apiKey, prompt, model);
    } else if (provider === "runway") {
      if (mode !== "video") return json({ error: "Runway supports video generation only" }, 400);
      mediaUrl = await callRunway(apiKey, prompt, model);
    } else if (provider === "kling") {
      if (mode !== "video") return json({ error: "Kling supports video generation only" }, 400);
      mediaUrl = await callFalVideo(apiKey, prompt, "https://fal.run/fal-ai/kling-video/v2.1/master/text-to-video");
    } else if (provider === "higgsfield") {
      if (mode !== "video") return json({ error: "Higgsfield supports video generation only" }, 400);
      mediaUrl = await callFalVideo(apiKey, prompt, "https://fal.run/fal-ai/higgsfield/text-to-video");
    } else if (provider === "luma") {
      if (mode !== "video") return json({ error: "Luma supports video generation only" }, 400);
      mediaUrl = await callFalVideo(apiKey, prompt, "https://fal.run/fal-ai/luma-dream-machine");
    } else if (provider === "pika") {
      if (mode !== "video") return json({ error: "Pika supports video generation only" }, 400);
      mediaUrl = await callFalVideo(apiKey, prompt, "https://fal.run/fal-ai/pika/v2.2/text-to-video");
    } else {
      return json({ error: `Unsupported provider: ${provider}` }, 400);
    }

    if ((provider === "runway" || provider === "replicate") && mediaUrl.startsWith("http") && mode === "image") {
      mediaUrl = await toDataUrl(mediaUrl);
    }

    return json({ mediaUrl });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
