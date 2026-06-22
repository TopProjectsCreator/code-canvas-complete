import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { redactJson, rehydrate, transformJsonStrings } from "./redaction.ts";
import { getProvider, resolveModelRouting, type ProviderDef } from "./providers.ts";
import { translateRequest, translateResponse, translateStreamChunk, detectShape, type Shape } from "./translate.ts";
import { redactImagesInBody } from "./image-redaction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-provider, x-internal-secret, anthropic-version, x-api-key",
  "Access-Control-Expose-Headers": "content-type",
};

// ---------- Crypto helpers (Web Crypto, no node:crypto) ----------

async function hashProxyKey(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

let cachedInternalSecret: string | null | undefined;

async function getInternalSecret(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  if (cachedInternalSecret !== undefined) return cachedInternalSecret;
  const raw = Deno.env.get("REDACTOR_INTERNAL_SECRET");
  if (raw) {
    cachedInternalSecret = raw;
    return raw;
  }
  const { data } = await supabase
    .from("redactor_secrets")
    .select("value")
    .eq("key", "internal_secret")
    .single();
  cachedInternalSecret = data?.value ?? null;
  return cachedInternalSecret;
}

async function decryptProviderKey(
  ciphertext: string,
  iv: string,
  salt: string,
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const internalSecret = await getInternalSecret(supabase);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const funcUrl = `${supabaseUrl}/functions/v1/redactor-crypto`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  headers["Authorization"] = `Bearer ${serviceKey}`;
  if (internalSecret) headers["x-internal-secret"] = internalSecret;

  const res = await fetch(funcUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "decrypt-provider-key",
      ciphertext,
      iv,
      salt,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`decrypt failed: ${(err as { error?: string }).error ?? res.status}`);
  }
  const data = await res.json();
  return (data as { apiKey: string }).apiKey;
}

// ---------- Rate limiter (in-memory sliding window) ----------

const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(keyId: string, rpm: number): boolean {
  const now = Date.now();
  let timestamps = rateLimitBuckets.get(keyId);
  if (!timestamps) {
    timestamps = [];
    rateLimitBuckets.set(keyId, timestamps);
  }
  const windowStart = now - 60_000;
  while (timestamps.length > 0 && timestamps[0] < windowStart) {
    timestamps.shift();
  }
  if (timestamps.length >= rpm) return false;
  timestamps.push(now);
  return true;
}

// ---------- IP allowlist check ----------

function getClientIP(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") ?? "";
}

function isIPAllowed(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.includes(ip);
}

// ---------- Model pricing / cost ----------

interface ModelCostRow {
  model_id: string;
  provider_id: string;
  cost_input: number;
  cost_output: number;
}

async function getModelCost(
  model: string | undefined,
  providerId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ costInput: number; costOutput: number } | null> {
  if (!model) return null;
  const { data } = await supabase
    .from("redactor_model_pricing")
    .select("cost_input, cost_output")
    .eq("model_id", `${providerId}/${model}`)
    .maybeSingle();
  if (data) return { costInput: (data as any).cost_input, costOutput: (data as any).cost_output };
  // Try bare model name
  const { data: data2 } = await supabase
    .from("redactor_model_pricing")
    .select("cost_input, cost_output")
    .eq("model_id", model)
    .maybeSingle();
  if (data2) return { costInput: (data2 as any).cost_input, costOutput: (data2 as any).cost_output };
  return null;
}

function computeCost(inputTokens: number, outputTokens: number, pricing: { costInput: number; costOutput: number }): number {
  return ((inputTokens * pricing.costInput) + (outputTokens * pricing.costOutput)) / 1_000_000;
}

// ---------- Log retention ----------

async function cleanOldLogs(supabase: ReturnType<typeof createClient>): Promise<void> {
  const retentionDays = parseInt(Deno.env.get("REDACTOR_LOG_RETENTION_DAYS") ?? "90", 10);
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  await supabase
    .from("redactor_request_logs")
    .delete()
    .lt("created_at", cutoff)
    .catch(() => {});
}

// ---------- Spend cap check ----------

async function checkMonthlySpend(
  proxyKeyId: string,
  monthlyCapUsd: number | null,
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  if (monthlyCapUsd == null) return true;
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("redactor_request_logs")
    .select("cost_usd")
    .eq("proxy_key_id", proxyKeyId)
    .gte("created_at", start.toISOString());
  const total = (data ?? []).reduce((s: number, r: any) => s + parseFloat(r.cost_usd ?? "0"), 0);
  return total < monthlyCapUsd;
}

// ---------- Auth: proxy key lookup ----------

interface AuthedProxyKey {
  id: string;
  userId: string;
  allowedProviders: string[];
  logRequests: boolean;
  rateLimitRpm: number | null;
  ipAllowlist: string[];
  monthlyCapUsd: number | null;
  redactImages: boolean;
}

async function authenticateProxyKey(
  authHeader: string | null,
  supabase: ReturnType<typeof createClient>,
): Promise<AuthedProxyKey> {
  if (!authHeader) throw new ProxyError(401, "Missing Authorization header");
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("lvp_")) throw new ProxyError(401, "Invalid proxy key format");
  const hash = await hashProxyKey(token);

  const { data, error } = await supabase
    .from("redactor_proxy_keys")
    .select("id, user_id, allowed_providers, log_requests, revoked_at, expires_at, rate_limit_rpm, ip_allowlist, monthly_cap_usd, redact_images")
    .eq("key_hash", hash)
    .single();

  if (error || !data) throw new ProxyError(401, "Unknown or revoked proxy key");
  if (data.revoked_at) throw new ProxyError(401, "Proxy key has been revoked");
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new ProxyError(401, "Proxy key has expired");
  }

  // Touch last_used_at (fire-and-forget)
  supabase
    .from("redactor_proxy_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .catch(() => {});

  return {
    id: data.id,
    userId: data.user_id,
    allowedProviders: data.allowed_providers ?? [],
    logRequests: data.log_requests ?? true,
    rateLimitRpm: data.rate_limit_rpm ?? null,
    ipAllowlist: data.ip_allowlist ?? [],
    monthlyCapUsd: data.monthly_cap_usd ?? null,
    redactImages: (data as any).redact_images ?? true,
  };
}

// ---------- Provider key lookup ----------

interface UpstreamKey {
  apiKey: string;
  provider: ProviderDef;
  baseUrl: string;
}

async function getProviderKey(
  userId: string,
  providerId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<UpstreamKey> {
  const { data, error } = await supabase
    .from("redactor_provider_keys")
    .select("provider, encrypted_key, iv, salt, base_url")
    .eq("user_id", userId)
    .eq("provider", providerId)
    .maybeSingle();

  if (error || !data) throw new ProxyError(400, `No provider key configured for '${providerId}'`);

  const provider = getProvider(providerId);
  if (!provider) throw new ProxyError(400, `Unknown provider '${providerId}'`);

  const apiKey = await decryptProviderKey(data.encrypted_key, data.iv, data.salt, supabase);
  return { apiKey, provider, baseUrl: data.base_url || provider.baseUrl };
}

// ---------- Custom rules ----------

async function getUserRules(
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ pattern: string; label: string }[]> {
  const { data } = await supabase
    .from("redactor_redaction_rules")
    .select("pattern, label")
    .eq("user_id", userId)
    .eq("enabled", true);
  return (data ?? []).map((r) => ({ pattern: r.pattern, label: r.label }));
}

// ---------- Upstream request building ----------

function buildUpstreamHeaders(
  provider: ProviderDef,
  apiKey: string,
  incoming: Headers,
): Headers {
  const h = new Headers();
  const ct = incoming.get("content-type");
  if (ct) h.set("content-type", ct);
  const accept = incoming.get("accept");
  if (accept) h.set("accept", accept);

  if (provider.authStyle === "bearer") {
    h.set("authorization", `Bearer ${apiKey}`);
  } else if (provider.authStyle === "x-api-key") {
    h.set("x-api-key", apiKey);
    h.set("anthropic-version", incoming.get("anthropic-version") ?? "2023-06-01");
  } else if (provider.authStyle === "google") {
    h.set("x-goog-api-key", apiKey);
  }
  return h;
}

// ---------- Logging ----------

interface LogInput {
  status: number;
  latencyMs: number;
  providerId: string;
  model?: string;
  redactions?: Record<string, number>;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  error?: string;
}

async function writeLog(
  ctx: { proxyKey: AuthedProxyKey; providerId: string },
  input: LogInput,
  supabase: ReturnType<typeof createClient>,
) {
  if (!ctx.proxyKey.logRequests) return;
  try {
    await supabase.from("redactor_request_logs").insert({
      user_id: ctx.proxyKey.userId,
      proxy_key_id: ctx.proxyKey.id,
      provider: ctx.providerId,
      model: input.model ?? null,
      status: input.status,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      cost_usd: input.costUsd ?? null,
      redactions: input.redactions ?? null,
      latency_ms: input.latencyMs,
      error: input.error ?? null,
    });
  } catch (e) {
    console.error("log insert failed", e);
  }
}

// ---------- Error ----------

class ProxyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ProxyError";
  }
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message, type: "proxy_error" } }), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

// ---------- Usage / model extraction ----------

function extractUsage(obj: unknown): { input?: number; output?: number } {
  if (!obj || typeof obj !== "object") return {};
  const o = obj as Record<string, unknown>;
  const usage = o.usage as Record<string, unknown> | undefined;
  if (!usage) return {};
  return {
    input: (usage.prompt_tokens as number) ?? (usage.input_tokens as number) ?? undefined,
    output: (usage.completion_tokens as number) ?? (usage.output_tokens as number) ?? undefined,
  };
}

function extractModel(resp: unknown, req: unknown): string | undefined {
  const fromResp =
    resp && typeof resp === "object"
      ? ((resp as Record<string, unknown>).model as string | undefined)
      : undefined;
  if (fromResp) return fromResp;
  if (req && typeof req === "object") {
    return (req as Record<string, unknown>).model as string | undefined;
  }
  return undefined;
}

// ---------- SSE rehydration stream ----------

function rehydrateStreamChunk(
  chunk: string,
  tokens: string[],
  map: Record<string, string>,
): string {
  let out = chunk;
  for (const t of tokens) {
    if (out.includes(t)) {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(escaped, "g"), map[t]);
    }
  }
  return out;
}

function createRehydrateStream(
  upstream: ReadableStream<Uint8Array>,
  map: Record<string, string>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";
  const tokens = Object.keys(map).sort((a, b) => b.length - a.length);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lastSep = pending.lastIndexOf("\n\n");
          if (lastSep >= 0) {
            const flushable = pending.slice(0, lastSep + 2);
            pending = pending.slice(lastSep + 2);
            const out = rehydrateStreamChunk(flushable, tokens, map);
            controller.enqueue(encoder.encode(out));
          }
        }
        if (pending) {
          controller.enqueue(encoder.encode(rehydrateStreamChunk(pending, tokens, map)));
        }
      } catch (e) {
        controller.error(e);
        return;
      }
      controller.close();
    },
  });
}

function isStreamingRequest(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return (body as Record<string, unknown>).stream === true;
}

// ---------- Main proxy pipeline ----------

interface ProxyContext {
  proxyKey: AuthedProxyKey;
  providerId: string;
  upstream: UpstreamKey;
  path: string;
}

async function runProxy(
  request: Request,
  ctx: ProxyContext,
  supabase: ReturnType<typeof createClient>,
  sourceShape?: Shape,
): Promise<Response> {
  const startedAt = Date.now();
  const customPatterns = await getUserRules(ctx.proxyKey.userId, supabase);
  const targetShape = ctx.upstream.provider.shape as Shape;
  const needTranslate = sourceShape && sourceShape !== targetShape;

  const reqContentType = (request.headers.get("content-type") ?? "").toLowerCase();
  const isJsonReq = reqContentType.includes("application/json") || reqContentType === "";

  const upstreamUrl = ctx.upstream.baseUrl.replace(/\/$/, "") + ctx.path;
  const upstreamHeaders = buildUpstreamHeaders(ctx.upstream.provider, ctx.upstream.apiKey, request.headers);

  let sharedMap: Record<string, string> = {};
  let redactionCounts: Record<string, number> = {};
  let bodyJson: Record<string, unknown> | null = null;
  let upstreamBody: BodyInit | null = null;

  if (isJsonReq && request.method !== "GET" && request.method !== "HEAD") {
    try {
      bodyJson = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonError(400, "Request body must be valid JSON");
    }
    // 1. Image redaction (before shape translation, in source shape)
    const imgResult = await redactImagesInBody(
      bodyJson,
      sourceShape ?? "openai",
      { customPatterns, detectNames: false },
      ctx.proxyKey.redactImages,
    );

    // 2. Translate request shape if needed
    if (needTranslate && imgResult.body) {
      bodyJson = translateRequest(imgResult.body, sourceShape!, targetShape);
    } else if (imgResult.body) {
      bodyJson = imgResult.body;
    }

    // 3. Text redaction (seeded with image PII map for cross-media dedup)
    const redacted = redactJson(bodyJson, {
      customPatterns,
      detectNames: false,
      seedMap: imgResult.map,
      seedCounts: imgResult.counts,
    });
    sharedMap = redacted.map;
    redactionCounts = redacted.counts;
    upstreamHeaders.set("content-type", "application/json");
    upstreamBody = JSON.stringify(redacted.value);
  } else if (request.method !== "GET" && request.method !== "HEAD") {
    if (reqContentType) upstreamHeaders.set("content-type", reqContentType);
    upstreamBody = await request.arrayBuffer();
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: upstreamBody as BodyInit | null,
    });
  } catch (e) {
    await writeLog(ctx, { status: 502, latencyMs: Date.now() - startedAt, providerId: ctx.providerId, redactions: redactionCounts, error: (e as Error).message }, supabase);
    return jsonError(502, "Upstream request failed: " + (e as Error).message);
  }

  const respHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === "content-encoding" || lk === "content-length" || lk === "transfer-encoding" || lk === "connection") {
      return;
    }
    respHeaders.set(k, v);
  });

  const respContentType = (upstreamRes.headers.get("content-type") ?? "").toLowerCase();
  const isSSE = respContentType.includes("text/event-stream");
  const isJsonResp = respContentType.includes("application/json");
  const wantStream = isJsonReq && isStreamingRequest(bodyJson);

  if ((wantStream || isSSE) && upstreamRes.body) {
    let stream: ReadableStream<Uint8Array>;
    if (needTranslate && targetShape !== "openai") {
      // Translate streaming response back to source shape
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = upstreamRes.body.getReader();
      stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let pending = "";
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              pending += decoder.decode(value, { stream: true });
              const events = pending.split("\n");
              pending = events.pop() ?? "";
              for (const line of events) {
                const translated = translateStreamChunk(line + "\n", targetShape, sourceShape!);
                if (translated) {
                  controller.enqueue(encoder.encode(translated));
                }
              }
            }
            if (pending) {
              const translated = translateStreamChunk(pending, targetShape, sourceShape!);
              if (translated) controller.enqueue(encoder.encode(translated));
            }
          } catch (e) { controller.error(e); return; }
          controller.close();
        },
      });
    } else {
      stream = createRehydrateStream(upstreamRes.body, sharedMap);
    }
    writeLog(ctx, { status: upstreamRes.status, latencyMs: Date.now() - startedAt, providerId: ctx.providerId, redactions: redactionCounts }, supabase).catch(() => {});
    return new Response(stream, { status: upstreamRes.status, headers: respHeaders });
  }

  if (!isJsonResp) {
    const buf = await upstreamRes.arrayBuffer();
    await writeLog(ctx, { status: upstreamRes.status, latencyMs: Date.now() - startedAt, providerId: ctx.providerId, redactions: redactionCounts }, supabase);
    return new Response(buf, { status: upstreamRes.status, headers: respHeaders });
  }

  // JSON response
  const text = await upstreamRes.text();
  let outText = text;
  try {
    let parsed = JSON.parse(text);
    // Translate response shape back if needed
    if (needTranslate) {
      parsed = translateResponse(parsed, targetShape, sourceShape!);
    }
    const rehydrated = transformJsonStrings(parsed, (s) => rehydrate(s, sharedMap));
    outText = JSON.stringify(rehydrated);
    const usage = extractUsage(rehydrated);
    const model = extractModel(rehydrated, bodyJson);
    const pricing = await getModelCost(model, ctx.providerId, supabase);
    const costUsd = usage.input != null && usage.output != null && pricing
      ? computeCost(usage.input, usage.output, pricing)
      : undefined;
    await writeLog(ctx, { status: upstreamRes.status, latencyMs: Date.now() - startedAt, providerId: ctx.providerId, redactions: redactionCounts, inputTokens: usage.input, outputTokens: usage.output, model, costUsd }, supabase);
  } catch {
    outText = rehydrate(text, sharedMap);
    await writeLog(ctx, { status: upstreamRes.status, latencyMs: Date.now() - startedAt, providerId: ctx.providerId, redactions: redactionCounts }, supabase);
  }

  return new Response(outText, { status: upstreamRes.status, headers: respHeaders });
}

// ---------- Endpoint routing ----------

interface EndpointRoute {
  providerId: string;
  path: string;
}

function parsePath(url: string): { route: EndpointRoute | null; rest: string } {
  const u = new URL(url);
  // Expected: /v1/chat/completions, /v1/embeddings, /anthropic/v1/messages, /gemini/v1beta/models/{model}:generateContent
  const segments = u.pathname.split("/").filter(Boolean);
  // Remove "redactor-proxy" or function name prefix
  // The function URL is usually /functions/v1/redactor-proxy
  // so segments = ["functions", "v1", "redactor-proxy", ...rest]
  // or just the remaining path after routing.
  // We look for known prefixes.
  if (segments.length < 2) return { route: null, rest: u.pathname };

  // Check for known provider-specific prefixes: /anthropic/... or /gemini/...
  const first = segments[segments.length - 2];
  const second = segments[segments.length - 1];

  if (first === "anthropic") {
    return { route: { providerId: "anthropic", path: "/" + second }, rest: u.pathname };
  }
  if (first === "gemini" || first === "google") {
    // /gemini/v1beta/models/{model}:generateContent
    const modelIdx = segments.indexOf("models");
    if (modelIdx >= 0 && modelIdx + 1 < segments.length) {
      const action = segments[modelIdx + 1];
      const restPath = "/" + segments.slice(segments.length - 2).join("/");
      return { route: { providerId: "google", path: restPath }, rest: u.pathname };
    }
    return { route: { providerId: "google", path: "/" + second }, rest: u.pathname };
  }
  if (first === "v1") {
    return { route: { providerId: "", path: "/v1/" + second }, rest: u.pathname };
  }

  return { route: null, rest: u.pathname };
}

// ---------- Main handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const authed = await authenticateProxyKey(req.headers.get("authorization"), supabase);

    const { route } = parsePath(req.url);
    if (!route) return jsonError(404, "Unknown endpoint");

    // Determine source shape from path
    const pathSourceShape: Shape | undefined =
      route.providerId === "anthropic" ? "anthropic" :
      route.providerId === "google" ? "gemini" :
      route.providerId === "" || !route.providerId ? "openai" :
      undefined;

    // If no provider is determined by the path, try the x-provider header or model inference
    let providerId = route.providerId;

    // For OpenAI-shape endpoints (/v1/...), infer provider from model
    if (!providerId) {
      const ct = (req.headers.get("content-type") ?? "").toLowerCase();
      const isJson = ct.includes("application/json") || ct === "";
      if (isJson && req.method !== "GET" && req.method !== "HEAD") {
        const body = await req.clone().json().catch(() => null) as Record<string, unknown> | null;
        const model = body?.model as string | undefined;
        if (model) {
          const routed = resolveModelRouting(model);
          providerId = routed.providerId ?? "";
          // Rewrite body with resolved model name
          if (routed.model !== model) {
            const newBody = { ...body, model: routed.model };
            req = new Request(req.url, {
              method: req.method,
              headers: req.headers,
              body: JSON.stringify(newBody),
            });
          }
        }
      }
    }

    providerId = providerId || req.headers.get("x-provider") || "openai";

    if (authed.allowedProviders.length > 0 && !authed.allowedProviders.includes(providerId)) {
      return jsonError(403, `Provider '${providerId}' not allowed for this key`);
    }

    // IP allowlist check
    if (!isIPAllowed(getClientIP(req), authed.ipAllowlist)) {
      return jsonError(403, "IP not allowed");
    }

    // Rate limit check
    if (authed.rateLimitRpm != null && !checkRateLimit(authed.id, authed.rateLimitRpm)) {
      return jsonError(429, "Rate limit exceeded");
    }

    // Spend cap check
    if (!(await checkMonthlySpend(authed.id, authed.monthlyCapUsd, supabase))) {
      return jsonError(429, "Monthly spend cap exceeded");
    }

    // Log retention cleanup (fire-and-forget, max 1/min)
    if (!rateLimitBuckets.has("__log_cleanup")) {
      cleanOldLogs(supabase);
    }

    const upstream = await getProviderKey(authed.userId, providerId, supabase);
    const resp = await runProxy(req, { proxyKey: authed, providerId, upstream, path: route.path }, supabase, pathSourceShape);
    return resp;
  } catch (e) {
    if (e instanceof ProxyError) {
      return jsonError(e.status, e.message);
    }
    console.error("redactor-proxy error", e);
    return jsonError(500, "Internal error");
  }
});
