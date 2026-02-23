import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROVIDER_TESTS: Record<string, { url: string; method: string; headers: (key: string) => Record<string, string>; body?: string }> = {
  openai: {
    url: "https://api.openai.com/v1/models",
    method: "GET",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    method: "GET",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    method: "GET",
    headers: (key) => ({ "x-goog-api-key": key }),
  },
  perplexity: {
    url: "https://api.perplexity.ai/chat/completions",
    method: "POST",
    headers: (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" }),
    body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: "test" }], max_tokens: 1 }),
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/models",
    method: "GET",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  xai: {
    url: "https://api.x.ai/v1/models",
    method: "GET",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  cohere: {
    url: "https://api.cohere.com/v2/models?page_size=1",
    method: "GET",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/auth/key",
    method: "GET",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  github: {
    url: "https://api.github.com/user",
    method: "GET",
    headers: (key) => ({ Authorization: `token ${key}`, "User-Agent": "Lovable-IDE" }),
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, apiKey } = await req.json();

    if (!provider || !apiKey) {
      return new Response(JSON.stringify({ valid: false, error: "Missing provider or apiKey" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = PROVIDER_TESTS[provider];
    if (!config) {
      return new Response(JSON.stringify({ valid: false, error: "Unknown provider" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const opts: RequestInit = {
      method: config.method,
      headers: config.headers(apiKey),
    };
    if (config.body) opts.body = config.body;

    const resp = await fetch(config.url, opts);

    if (resp.ok || resp.status === 200 || resp.status === 201) {
      return new Response(JSON.stringify({ valid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 400 can mean auth succeeded but request was bad — still valid key
    if (resp.status === 400) {
      return new Response(JSON.stringify({ valid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let errorMsg = `API returned ${resp.status}`;
    try {
      const errData = await resp.json();
      errorMsg = errData?.error?.message || errData?.message || errorMsg;
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ valid: false, error: errorMsg.slice(0, 150) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: "Validation failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
