import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { redactJson, rehydrate, transformJsonStrings } from "./redaction.ts";
import { getProvider, resolveModelRouting, buildEndpointPath, getAuthStyleForShape, type ProviderDef, type RouterConfig, type RouterStep } from "./providers.ts";
import { translateRequest, translateResponse, translateStreamChunk, translateStreamChunks, createOpenaiToAnthropicTransformer, createGeminiToAnthropicTransformer, createAnthropicToGeminiTransformer, detectShape, type Shape } from "./translate.ts";
import { redactImagesInBody } from "./image-redaction.ts";
import { redactVideosInBody, serveRedactedVideo } from "./video-redaction.ts";

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

async function getInternalSecret(supabase: any): Promise<string | null> {
  if (cachedInternalSecret !== undefined) return cachedInternalSecret;
  const raw = Deno.env.get("REDACTOR_INTERNAL_SECRET");
  if (raw) {
    cachedInternalSecret = raw;
    return raw;
  }
  type SecretRow = { value: string };
  const { data: rows } = await (supabase as any)
    .from("redactor_secrets")
    .select("value")
    .eq("key", "internal_secret") as { data: SecretRow[] | null; error: unknown };
  cachedInternalSecret = rows?.[0]?.value ?? null;
  return cachedInternalSecret;
}

async function decryptProviderKey(
  ciphertext: string,
  iv: string,
  salt: string,
  supabase: any,
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
    const errText = await res.text().catch(() => "");
    let errMsg: string;
    try { errMsg = JSON.parse(errText).error || `HTTP ${res.status}`; } catch { errMsg = errText || `HTTP ${res.status}`; }
    throw new ProxyError(502, `decrypt failed: ${errMsg}`);
  }
  const data = await res.json();
  const apiKey = (data as { apiKey?: string }).apiKey;
  if (!apiKey) throw new ProxyError(502, "decrypt returned empty key");
  return apiKey;
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
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")) ?? "";
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
  supabase: any,
): Promise<{ costInput: number; costOutput: number } | null> {
  if (!model) return null;
  const { data: pricingRows } = await supabase
    .from("redactor_model_pricing")
    .select("cost_input, cost_output")
    .eq("model_id", `${providerId}/${model}`);
  if (pricingRows && pricingRows.length > 0) return { costInput: (pricingRows[0] as any).cost_input, costOutput: (pricingRows[0] as any).cost_output };
  // Try bare model name
  const { data: pricingRows2 } = await supabase
    .from("redactor_model_pricing")
    .select("cost_input, cost_output")
    .eq("model_id", model);
  if (pricingRows2 && pricingRows2.length > 0) return { costInput: (pricingRows2[0] as any).cost_input, costOutput: (pricingRows2[0] as any).cost_output };
  return null;
}

function computeCost(inputTokens: number, outputTokens: number, pricing: { costInput: number; costOutput: number }): number {
  return ((inputTokens * pricing.costInput) + (outputTokens * pricing.costOutput)) / 1_000_000;
}

// ---------- Log retention ----------

async function cleanOldLogs(supabase: any): Promise<void> {
  const retentionDays = parseInt(Deno.env.get("REDACTOR_LOG_RETENTION_DAYS") ?? "90", 10);
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  try {
    await supabase
      .from("redactor_request_logs")
      .delete()
      .lt("created_at", cutoff);
  } catch {}
}

// ---------- Spend cap check ----------

async function checkMonthlySpend(
  proxyKeyId: string,
  monthlyCapUsd: number | null,
  supabase: any,
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
  redactVideos: boolean;
}

async function authenticateProxyKey(
  authHeader: string | null,
  supabase: any,
): Promise<AuthedProxyKey> {
  if (!authHeader) throw new ProxyError(401, "Missing Authorization header");
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Try proxy key auth
  if (token.startsWith("lvp_")) {
    const hash = await hashProxyKey(token);
    const { data: rows, error } = await supabase
      .from("redactor_proxy_keys")
      .select("id, user_id, allowed_providers, log_requests, revoked_at, expires_at, rate_limit_rpm, ip_allowlist, monthly_cap_usd, redact_images, redact_videos")
      .eq("key_hash", hash);

    if (error || !rows || rows.length === 0) throw new ProxyError(401, "Unknown or revoked proxy key");
    const keyObj = rows[0];
    if (keyObj.revoked_at) throw new ProxyError(401, "Proxy key has been revoked");
    if (keyObj.expires_at && new Date(keyObj.expires_at).getTime() < Date.now()) {
      throw new ProxyError(401, "Proxy key has expired");
    }

    supabase.from("redactor_proxy_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyObj.id).then(undefined, () => {});

    return {
      id: keyObj.id, userId: keyObj.user_id, allowedProviders: keyObj.allowed_providers ?? [],
      logRequests: keyObj.log_requests ?? true, rateLimitRpm: keyObj.rate_limit_rpm ?? null,
      ipAllowlist: keyObj.ip_allowlist ?? [], monthlyCapUsd: keyObj.monthly_cap_usd ?? null,
      redactImages: (keyObj as any).redact_images ?? true, redactVideos: (keyObj as any).redact_videos ?? true,
    };
  }

  // Try Supabase session token auth (for dashboard/test endpoint)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) throw new ProxyError(401, "Invalid authentication token");

  return {
    id: "__test__", userId: user.id, allowedProviders: [], logRequests: true,
    rateLimitRpm: null, ipAllowlist: [], monthlyCapUsd: null,
    redactImages: true, redactVideos: true,
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
  supabase: any,
): Promise<UpstreamKey> {
  const { data: provRows, error } = await supabase
    .from("redactor_provider_keys")
    .select("provider, encrypted_key, iv, salt, base_url")
    .eq("user_id", userId)
    .eq("provider", providerId);

  if (error || !provRows || provRows.length === 0) throw new ProxyError(400, `No provider key configured for '${providerId}'`);
  const provKey = provRows[0];

  const provider = getProvider(providerId);
  if (!provider) throw new ProxyError(400, `Unknown provider '${providerId}'`);

  const apiKey = await decryptProviderKey(provKey.encrypted_key, provKey.iv, provKey.salt, supabase);
  return { apiKey, provider, baseUrl: provKey.base_url || provider.baseUrl };
}

// ---------- Custom rules ----------

async function getUserRules(
  userId: string,
  supabase: any,
): Promise<{ pattern: string; label: string }[]> {
  const { data } = await supabase
    .from("redactor_redaction_rules")
    .select("pattern, label")
    .eq("user_id", userId)
    .eq("enabled", true);
  return (data ?? []).map((r: any) => ({ pattern: r.pattern, label: r.label }));
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
  supabase: any,
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
      out = out.replace(new RegExp(escaped, "g"), () => map[t]);
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
  supabase: any,
  sourceShape?: Shape,
): Promise<Response> {
  const startedAt = Date.now();
  const customPatterns = await getUserRules(ctx.proxyKey.userId, supabase);
  const targetShape = ctx.upstream.provider.shape as Shape;
  const needTranslate = sourceShape && sourceShape !== targetShape;

  const reqContentType = (request.headers.get("content-type") ?? "").toLowerCase();
  const isJsonReq = reqContentType.includes("application/json") || reqContentType === "";

  let upstreamUrl = ctx.upstream.baseUrl.replace(/\/$/, "") + ctx.path;
  const upstreamHeaders = buildUpstreamHeaders(ctx.upstream.provider, ctx.upstream.apiKey, request.headers);

  let sharedMap: Record<string, string> = {};
  let redactionCounts: Record<string, number> = {};
  let bodyJson: Record<string, unknown> | null = null;
  let upstreamBody: BodyInit | null = null;
  let wasStreaming = false;
  let originalModel: string | undefined;

  if (isJsonReq && request.method !== "GET" && request.method !== "HEAD") {
    try {
      bodyJson = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonError(400, "Request body must be valid JSON");
    }
    wasStreaming = isStreamingRequest(bodyJson);
    originalModel = bodyJson?.model as string | undefined;
    // 1. Image redaction (before shape translation, in source shape)
    const imgResult = await redactImagesInBody(
      bodyJson,
      sourceShape ?? "openai",
      { customPatterns, detectNames: false },
      ctx.proxyKey.redactImages,
    );

    // Use the image-redacted body for video redaction so pixelation isn't lost
    const bodyAfterImages = imgResult.body ?? bodyJson;

    // 2. Video redaction (after image, before shape translation)
    const videoResult = await redactVideosInBody(
      bodyAfterImages,
      sourceShape ?? "openai",
      { customPatterns, detectNames: false },
      ctx.proxyKey.redactVideos,
    );

    // Merge video PII map into image map for cross-media dedup
    const mergedMap = { ...imgResult.map, ...videoResult.map };
    const mergedCounts = { ...imgResult.counts };
    for (const [k, v] of Object.entries(videoResult.counts)) {
      mergedCounts[k] = (mergedCounts[k] ?? 0) + v;
    }

    // 3. Translate request shape if needed
    if (needTranslate && videoResult.body) {
      bodyJson = translateRequest(videoResult.body, sourceShape!, targetShape);
    } else if (videoResult.body) {
      bodyJson = videoResult.body;
    }

    // 4. Text redaction (seeded with image + video PII map for cross-media dedup)
    const redacted = redactJson(bodyJson, {
      customPatterns,
      detectNames: false,
      seedMap: mergedMap,
      seedCounts: mergedCounts,
    });
    sharedMap = redacted.map;
    redactionCounts = redacted.counts;
    upstreamHeaders.set("content-type", "application/json");
    upstreamBody = JSON.stringify(redacted.value);

    // 5. Recalculate upstream URL when shape translation was applied
    if (needTranslate) {
      let newPath = ctx.path;
      if (targetShape === "gemini") {
        if (originalModel) {
          const action = wasStreaming ? "streamGenerateContent" : "generateContent";
          newPath = `/models/${originalModel}:${action}`;
        }
      } else if (targetShape === "anthropic") {
        newPath = "/messages";
      } else if (targetShape === "openai") {
        newPath = "/chat/completions";
      }
      upstreamUrl = ctx.upstream.baseUrl.replace(/\/$/, "") + newPath;
    }
  } else if (request.method !== "GET" && request.method !== "HEAD") {
    if (reqContentType) upstreamHeaders.set("content-type", reqContentType);
    upstreamBody = await request.arrayBuffer();
  }

  let upstreamRes!: Response;
  let lastError: Error | undefined;
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      upstreamRes = await fetch(upstreamUrl, {
        method: request.method,
        headers: upstreamHeaders,
        body: upstreamBody as BodyInit | null,
        signal: controller.signal,
      });
      lastError = undefined;
      break;
    } catch (e) {
      lastError = e as Error;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  if (lastError) {
    await writeLog(ctx, { status: 502, latencyMs: Date.now() - startedAt, providerId: ctx.providerId, redactions: redactionCounts, error: lastError.message }, supabase);
    return jsonError(502, "Upstream request failed: " + lastError.message);
  }

  const respHeaders = new Headers({ "access-control-allow-origin": "*" });
  upstreamRes.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === "content-encoding" || lk === "content-length" || lk === "transfer-encoding" || lk === "connection" || lk === "access-control-allow-origin") {
      return;
    }
    respHeaders.set(k, v);
  });

  const respContentType = (upstreamRes.headers.get("content-type") ?? "").toLowerCase();
  const isSSE = respContentType.includes("text/event-stream");
  const isJsonResp = respContentType.includes("application/json");
  const wantStream = isJsonReq && (needTranslate ? wasStreaming : isStreamingRequest(bodyJson));

  if ((wantStream || isSSE) && upstreamRes.body && upstreamRes.status < 400) {
    let stream: ReadableStream<Uint8Array>;
    if (needTranslate) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      if (targetShape === "openai") {
        // OpenAI upstream → non-OpenAI caller
        // e.g. OpenAI SSE → Gemini SSE, OpenAI SSE → Anthropic SSE
        const anthropicTransformer = sourceShape === "anthropic" ? createOpenaiToAnthropicTransformer() : null;
        stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstreamRes.body!.getReader();
            let pending = "";
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                pending += decoder.decode(value, { stream: true });
                const events = pending.split("\n");
                pending = events.pop() ?? "";
                for (const line of events) {
                  if (sourceShape === "anthropic" && anthropicTransformer) {
                    const translated = anthropicTransformer(line + "\n");
                    for (const t of translated) controller.enqueue(encoder.encode(t));
                  } else if (sourceShape === "gemini") {
                    const translated = translateStreamChunks(line + "\n", "openai", "gemini");
                    if (translated) {
                      for (const t of translated) controller.enqueue(encoder.encode(t));
                    }
                  }
                }
              }
              if (pending) {
                if (sourceShape === "anthropic" && anthropicTransformer) {
                  const translated = anthropicTransformer(pending);
                  for (const t of translated) controller.enqueue(encoder.encode(t));
                } else if (sourceShape === "gemini") {
                  const translated = translateStreamChunks(pending, "openai", "gemini");
                  if (translated) {
                    for (const t of translated) controller.enqueue(encoder.encode(t));
                  }
                }
              }
            } catch (e) { controller.error(e); return; }
            controller.close();
          },
        });
      } else if (sourceShape === "openai") {
        // Non-OpenAI upstream → OpenAI caller
        // e.g. Gemini SSE → OpenAI SSE, Anthropic SSE → OpenAI SSE
        stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstreamRes.body!.getReader();
            let pending = "";
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                pending += decoder.decode(value, { stream: true });
                const events = pending.split("\n");
                pending = events.pop() ?? "";
                for (const line of events) {
                  const translated = translateStreamChunk(line + "\n", targetShape, "openai");
                  if (translated) controller.enqueue(encoder.encode(translated));
                }
              }
              if (pending) {
                const translated = translateStreamChunk(pending, targetShape, "openai");
                if (translated) controller.enqueue(encoder.encode(translated));
              }
            } catch (e) { controller.error(e); return; }
            controller.close();
          },
        });
      } else {
        // Both non-OpenAI, different → use direct Gemini↔Anthropic translators
        // e.g. Gemini SSE → Anthropic SSE, Anthropic SSE → Gemini SSE
        const directTransformer =
          targetShape === "gemini" && sourceShape === "anthropic" ? createGeminiToAnthropicTransformer() :
          targetShape === "anthropic" && sourceShape === "gemini" ? createAnthropicToGeminiTransformer() :
          null;
        stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstreamRes.body!.getReader();
            let pending = "";
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                pending += decoder.decode(value, { stream: true });
                const events = pending.split("\n");
                pending = events.pop() ?? "";
                if (directTransformer) {
                  for (const line of events) {
                    const translated = directTransformer(line + "\n");
                    for (const t of translated) controller.enqueue(encoder.encode(t));
                  }
                }
              }
              if (pending && directTransformer) {
                const translated = directTransformer(pending);
                for (const t of translated) controller.enqueue(encoder.encode(t));
              }
            } catch (e) { controller.error(e); return; }
            controller.close();
          },
        });
      }
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
    if (upstreamRes.status >= 400) {
      // Handle upstream errors: parse body if possible, produce a useful error
      if (!text.trim()) {
        outText = JSON.stringify({ error: { message: `Upstream returned ${upstreamRes.status} with empty body`, type: "upstream_error" } });
      } else {
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(text); } catch {
          outText = JSON.stringify({ error: { message: `Upstream returned ${upstreamRes.status}: ${text.slice(0, 200)}`, type: "upstream_error" } });
          return new Response(outText, { status: upstreamRes.status, headers: respHeaders });
        }
        if (targetShape === "gemini") {
          const err = (parsed as any)?.error;
          outText = JSON.stringify({ error: { message: err?.message ?? err?.status ?? `Gemini returned ${upstreamRes.status}`, type: "upstream_error" } });
        } else if (targetShape === "anthropic") {
          const err = (parsed as any)?.error;
          outText = JSON.stringify({ error: { message: err?.message ?? `Anthropic returned ${upstreamRes.status}`, type: "upstream_error" } });
        } else {
          try { const p = JSON.parse(text); outText = JSON.stringify({ error: { message: (p as any)?.error?.message ?? (p as any)?.error ?? text.slice(0, 300), type: "upstream_error" } }); }
          catch { outText = JSON.stringify({ error: { message: text.slice(0, 300), type: "upstream_error" } }); }
        }
      }
    } else if (needTranslate) {
      let parsed = JSON.parse(text);
      parsed = translateResponse(parsed, targetShape, sourceShape!);
      if (!parsed.model && originalModel) parsed.model = originalModel;
      const rehydrated = transformJsonStrings(parsed, (s) => rehydrate(s, sharedMap));
      outText = JSON.stringify(rehydrated);
      const usage = extractUsage(rehydrated);
      const model = extractModel(rehydrated, bodyJson);
      const pricing = await getModelCost(model, ctx.providerId, supabase);
      const costUsd = usage.input != null && usage.output != null && pricing
        ? computeCost(usage.input, usage.output, pricing)
        : undefined;
      await writeLog(ctx, { status: upstreamRes.status, latencyMs: Date.now() - startedAt, providerId: ctx.providerId, redactions: redactionCounts, inputTokens: usage.input, outputTokens: usage.output, model, costUsd }, supabase);
    } else {
      const parsed = JSON.parse(text);
      if (!parsed.model && originalModel) parsed.model = originalModel;
      const rehydrated = transformJsonStrings(parsed, (s) => rehydrate(s, sharedMap));
      outText = JSON.stringify(rehydrated);
      const usage = extractUsage(rehydrated);
      const model = extractModel(rehydrated, bodyJson);
      const pricing = await getModelCost(model, ctx.providerId, supabase);
      const costUsd = usage.input != null && usage.output != null && pricing
        ? computeCost(usage.input, usage.output, pricing)
        : undefined;
      await writeLog(ctx, { status: upstreamRes.status, latencyMs: Date.now() - startedAt, providerId: ctx.providerId, redactions: redactionCounts, inputTokens: usage.input, outputTokens: usage.output, model, costUsd }, supabase);
    }
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
  const segments = u.pathname.split("/").filter(Boolean);

  // Strip Supabase function prefix (/functions/v1/redactor-proxy/...)
  // so that remaining segments are the actual API path
  const fnIdx = segments.indexOf("redactor-proxy");
  const rest = fnIdx >= 0 ? segments.slice(fnIdx + 1) : segments;

  if (rest.length < 1) return { route: null, rest: u.pathname };

  const prefix = rest[0];

  if (prefix === "v1") {
    // /v1/images/embeddings → route to /embeddings on any provider that
    // supports multimodal inputs (OpenRouter, Aurous, etc.). Provider is
    // resolved from the model name as usual, so users pick the right model
    // (e.g. openrouter/openai/text-embedding-3-small).
    if (rest.length >= 3 && rest[1] === "images" && rest[2] === "embeddings") {
      return { route: { providerId: "", path: "/embeddings" }, rest: u.pathname };
    }
    // /v1/chat/completions, /v1/embeddings, etc.
    // baseUrls already include /v1 for OpenAI-compatible providers
    const path = "/" + rest.slice(1).join("/");
    return { route: { providerId: "", path }, rest: u.pathname };
  }
  if (prefix === "anthropic") {
    // /anthropic/v1/messages
    // Anthropic baseUrl = https://api.anthropic.com/v1, strip /anthropic/v1
    const path = rest.length > 2 ? "/" + rest.slice(2).join("/") : "/";
    return { route: { providerId: "anthropic", path }, rest: u.pathname };
  }
  if (prefix === "gemini" || prefix === "google") {
    // /gemini/v1beta/models/{model}:generateContent
    // Google baseUrl = https://generativelanguage.googleapis.com/v1beta
    const path = rest.length > 2 ? "/" + rest.slice(2).join("/") : "/";
    return { route: { providerId: "google", path }, rest: u.pathname };
  }

  return { route: null, rest: u.pathname };
}

// ---------- Router logic ----------

const shapeCache = new Map<string, { shape: string; timestamp: number }>();
const SHAPE_CACHE_TTL = 3600_000;

async function loadRouter(userId: string, routerId: string, supabase: any): Promise<RouterConfig | null> {
  const { data: routerRows } = await supabase.from("redactor_model_routers").select("id, name, fallback_on, fallback_status_codes").eq("user_id", userId).eq("id", routerId);
  if (!routerRows || routerRows.length === 0) return null;
  const router = routerRows[0];
  const { data: stepRows } = await supabase.from("redactor_router_steps").select("id, provider_key_id, base_url, encrypted_key, iv, salt, model, api_shape, enabled").eq("router_id", routerId).order("step_order");
  const steps = (stepRows ?? []).filter((s: any) => s.enabled).map((s: any) => ({
    id: s.id, provider_key_id: s.provider_key_id, base_url: s.base_url,
    encrypted_key: s.encrypted_key, iv: s.iv, salt: s.salt,
    model: s.model, api_shape: s.api_shape, enabled: s.enabled,
  }));
  return { id: router.id, name: router.name, fallback_on: router.fallback_on, fallback_status_codes: router.fallback_status_codes, steps };
}

async function loadRouterByName(userId: string, name: string, supabase: any): Promise<RouterConfig | null> {
  const { data: routerRows } = await supabase.from("redactor_model_routers").select("id").eq("user_id", userId).eq("name", name);
  if (!routerRows || routerRows.length === 0) return null;
  return loadRouter(userId, routerRows[0].id, supabase);
}

async function resolveStepShape(step: RouterStep, apiKey: string): Promise<Shape> {
  if (step.api_shape !== "auto") return step.api_shape as Shape;
  const baseUrl = step.base_url || "";
  const model = step.model;
  const cacheKey = `${baseUrl}:${model}`;
  const cached = shapeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SHAPE_CACHE_TTL) return cached.shape as Shape;

  const shapes: Shape[] = ["openai", "openai-responses", "anthropic", "gemini"];
  for (const shape of shapes) {
    try {
      const endpoint = buildEndpointPath(shape, model, baseUrl);
      const url = baseUrl.replace(/\/$/, "") + endpoint;
      const headers = new Headers({ "content-type": "application/json" });
      const authStyle = getAuthStyleForShape(shape);
      if (authStyle === "bearer") headers.set("authorization", `Bearer ${apiKey}`);
      else if (authStyle === "x-api-key") { headers.set("x-api-key", apiKey); headers.set("anthropic-version", "2023-06-01"); }
      else if (authStyle === "google") headers.set("x-goog-api-key", apiKey);

      let body: Record<string, unknown>;
      if (shape === "openai-responses") body = { model, input: "hi", max_output_tokens: 1 };
      else if (shape === "anthropic") body = { model, messages: [{ role: "user", content: "hi" }], max_tokens: 1 };
      else if (shape === "gemini") body = { contents: [{ role: "user", parts: [{ text: "hi" }] }] };
      else body = { model, messages: [{ role: "user", content: "hi" }], max_tokens: 1 };

      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      if (res.ok) { shapeCache.set(cacheKey, { shape, timestamp: Date.now() }); return shape; }
      if (res.status === 404 || res.status === 405) continue;
      shapeCache.set(cacheKey, { shape, timestamp: Date.now() });
      return shape;
    } catch { }
  }
  shapeCache.set(cacheKey, { shape: "openai", timestamp: Date.now() });
  return "openai";
}

function shouldFallback(status: number, error: unknown, router: RouterConfig): boolean {
  const fb = router.fallback_on;
  if (fb === "timeout") return error instanceof DOMException && error.name === "AbortError";
  if (fb === "server_errors") return status >= 500 || (error instanceof DOMException && error.name === "AbortError");
  if (fb === "custom") return (router.fallback_status_codes ?? []).includes(status) || (error instanceof DOMException && error.name === "AbortError");
  return status >= 400 || (error instanceof DOMException && error.name === "AbortError");
}

function buildAuthHeaders(shape: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const authStyle = getAuthStyleForShape(shape);
  if (authStyle === "bearer") headers["authorization"] = `Bearer ${apiKey}`;
  else if (authStyle === "x-api-key") { headers["x-api-key"] = apiKey; headers["anthropic-version"] = "2023-06-01"; }
  else if (authStyle === "google") headers["x-goog-api-key"] = apiKey;
  return headers;
}

async function runRouter(request: Request, router: RouterConfig, sourceShape: Shape, supabase: any, proxyKey: AuthedProxyKey): Promise<Response> {
  const startedAt = Date.now();
  const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
  const customPatterns = await getUserRules(proxyKey.userId, supabase);
  let lastError: { status: number; message: string } = { status: 500, message: "All router steps failed" };

  for (let i = 0; i < router.steps.length; i++) {
    const step = router.steps[i];
    const stepStart = Date.now();
    try {
      let apiKey: string;
      if (step.provider_key_id) {
        const { data: keyRows } = await supabase.from("redactor_provider_keys").select("encrypted_key, iv, salt").eq("id", step.provider_key_id);
        if (!keyRows || keyRows.length === 0) { lastError = { status: 500, message: `Step ${i + 1}: Provider key not found` }; continue; }
        apiKey = await decryptProviderKey(keyRows[0].encrypted_key, keyRows[0].iv, keyRows[0].salt, supabase);
      } else if (step.encrypted_key && step.iv && step.salt) {
        apiKey = await decryptProviderKey(step.encrypted_key, step.iv, step.salt, supabase);
      } else { lastError = { status: 500, message: `Step ${i + 1}: No API key` }; continue; }

      const targetShape = await resolveStepShape(step, apiKey);
      let upstreamBody = body ? { ...body } : {};
      upstreamBody.model = step.model;
      const isStream = upstreamBody.stream === true;

      // Redaction pipeline
      const imgResult = await redactImagesInBody(upstreamBody, sourceShape, { customPatterns, detectNames: false }, proxyKey.redactImages);
      upstreamBody = imgResult.body ?? upstreamBody;
      const videoResult = await redactVideosInBody(upstreamBody, sourceShape, { customPatterns, detectNames: false }, proxyKey.redactVideos);
      upstreamBody = videoResult.body ?? upstreamBody;
      const mergedMap = { ...imgResult.map, ...videoResult.map };
      const mergedCounts = { ...imgResult.counts };
      for (const [k, v] of Object.entries(videoResult.counts)) mergedCounts[k] = (mergedCounts[k] ?? 0) + v;

      if (sourceShape !== targetShape) upstreamBody = translateRequest(upstreamBody, sourceShape, targetShape);
      const redacted = redactJson(upstreamBody, { customPatterns, detectNames: false, seedMap: mergedMap, seedCounts: mergedCounts });
      upstreamBody = redacted.value;
      const sharedMap = redacted.map;
      const redactionCounts = redacted.counts;

      const baseUrl = step.base_url || "";
      const endpoint = buildEndpointPath(targetShape, step.model, baseUrl);
      const upstreamUrl = baseUrl.replace(/\/$/, "") + endpoint;
      const headers = buildAuthHeaders(targetShape, apiKey);

      const res = await fetch(upstreamUrl, { method: "POST", headers, body: JSON.stringify(upstreamBody), signal: AbortSignal.timeout(55000) });
      const latencyMs = Date.now() - stepStart;

      if (res.status >= 400) {
        const errorText = await res.text().catch(() => "");
        lastError = { status: res.status, message: errorText || `HTTP ${res.status}` };
        writeLog({ proxyKey, providerId: `router/${router.name}` }, { status: res.status, latencyMs, model: step.model, redactions: redactionCounts, error: lastError.message }, supabase).catch(() => {});
        if (shouldFallback(res.status, null, router)) continue;
        return jsonError(res.status, `Router step ${i + 1} failed: ${lastError.message}`);
      }

      if (isStream && res.body) {
        const respHeaders = new Headers({ "access-control-allow-origin": "*" });
        res.headers.forEach((v, k) => { const lk = k.toLowerCase(); if (lk === "content-encoding" || lk === "content-length" || lk === "transfer-encoding" || lk === "connection" || lk === "access-control-allow-origin") return; respHeaders.set(k, v); });
        if (sourceShape !== targetShape) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          const stream = new ReadableStream<Uint8Array>({ async start(controller) {
            const reader = res.body!.getReader(); let pending = "";
            try { while (true) { const { value, done } = await reader.read(); if (done) break; pending += decoder.decode(value, { stream: true }); const events = pending.split("\n"); pending = events.pop() ?? ""; for (const line of events) { const translated = translateStreamChunks(line + "\n", targetShape, sourceShape); if (translated) for (const t of translated) controller.enqueue(encoder.encode(t)); } }
              if (pending) { const translated = translateStreamChunks(pending, targetShape, sourceShape); if (translated) for (const t of translated) controller.enqueue(encoder.encode(t)); } } catch (e) { controller.error(e); return; } controller.close(); } });
          respHeaders.set("content-type", "text/event-stream");
          writeLog({ proxyKey, providerId: `router/${router.name}` }, { status: 200, latencyMs: Date.now() - startedAt, model: step.model, redactions: redactionCounts }, supabase).catch(() => {});
          return new Response(stream, { status: 200, headers: respHeaders });
        }
        respHeaders.set("content-type", res.headers.get("content-type") ?? "text/event-stream");
        writeLog({ proxyKey, providerId: `router/${router.name}` }, { status: 200, latencyMs: Date.now() - startedAt, model: step.model, redactions: redactionCounts }, supabase).catch(() => {});
        return new Response(res.body, { status: 200, headers: respHeaders });
      }

      let resBody = await res.json();
      if (sourceShape !== targetShape) resBody = translateResponse(resBody, targetShape, sourceShape);
      if (Object.keys(sharedMap).length > 0) resBody = transformJsonStrings(resBody, (s) => rehydrate(s, sharedMap));

      const usage = extractUsage(resBody);
      const model = extractModel(resBody, upstreamBody);
      const pricing = await getModelCost(model, `router/${router.name}`, supabase);
      const costUsd = usage.input != null && usage.output != null && pricing ? computeCost(usage.input, usage.output, pricing) : undefined;

      const respHeaders = new Headers({ "access-control-allow-origin": "*", "content-type": "application/json" });
      writeLog({ proxyKey, providerId: `router/${router.name}` }, { status: 200, latencyMs: Date.now() - startedAt, model: step.model, redactions: redactionCounts, inputTokens: usage.input, outputTokens: usage.output, costUsd }, supabase).catch(() => {});
      return new Response(JSON.stringify(resBody), { status: 200, headers: respHeaders });
    } catch (e) {
      const isTimeout = e instanceof DOMException && e.name === "AbortError";
      lastError = { status: isTimeout ? 504 : 500, message: isTimeout ? "Request timed out" : (e as Error).message };
      writeLog({ proxyKey, providerId: `router/${router.name}` }, { status: lastError.status, latencyMs: Date.now() - stepStart, model: step.model, error: lastError.message }, supabase).catch(() => {});
      if (!shouldFallback(isTimeout ? 504 : 500, e, router)) return jsonError(lastError.status, `Router step ${i + 1} failed: ${lastError.message}`);
    }
  }
  return jsonError(lastError.status, `All router steps failed. Last error: ${lastError.message}`);
}

async function runRouterTest(request: Request, router: RouterConfig, sourceShape: Shape, supabase: any, proxyKey: AuthedProxyKey): Promise<Response> {
  const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
  const customPatterns = await getUserRules(proxyKey.userId, supabase);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const stepsTried: number[] = []; let succeededAt: number | null = null; let totalLatency = 0;
    for (let i = 0; i < router.steps.length; i++) {
      const step = router.steps[i]; const stepStart = Date.now(); stepsTried.push(i + 1);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "probe", step: i + 1, model: step.model, shape: step.api_shape, totalSteps: router.steps.length })}\n\n`));
      try {
        let apiKey: string;
        if (step.provider_key_id) {
          const { data: keyRows } = await supabase.from("redactor_provider_keys").select("encrypted_key, iv, salt").eq("id", step.provider_key_id);
          if (!keyRows || keyRows.length === 0) { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", step: i + 1, status: 500, message: "Provider key not found", latency_ms: Date.now() - stepStart })}\n\n`)); continue; }
          apiKey = await decryptProviderKey(keyRows[0].encrypted_key, keyRows[0].iv, keyRows[0].salt, supabase);
        } else if (step.encrypted_key && step.iv && step.salt) {
          apiKey = await decryptProviderKey(step.encrypted_key, step.iv, step.salt, supabase);
        } else { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", step: i + 1, status: 500, message: "No API key", latency_ms: Date.now() - stepStart })}\n\n`)); continue; }

        const targetShape = await resolveStepShape(step, apiKey);
        let upstreamBody = body ? { ...body } : {}; upstreamBody.model = step.model;

        // Redaction
        const imgResult = await redactImagesInBody(upstreamBody, sourceShape, { customPatterns, detectNames: false }, proxyKey.redactImages);
        upstreamBody = imgResult.body ?? upstreamBody;
        const videoResult = await redactVideosInBody(upstreamBody, sourceShape, { customPatterns, detectNames: false }, proxyKey.redactVideos);
        upstreamBody = videoResult.body ?? upstreamBody;
        const mergedMap = { ...imgResult.map, ...videoResult.map };
        const mergedCounts = { ...imgResult.counts };
        for (const [k, v] of Object.entries(videoResult.counts)) mergedCounts[k] = (mergedCounts[k] ?? 0) + v;
        if (sourceShape !== targetShape) upstreamBody = translateRequest(upstreamBody, sourceShape, targetShape);
        const redacted = redactJson(upstreamBody, { customPatterns, detectNames: false, seedMap: mergedMap, seedCounts: mergedCounts });
        upstreamBody = redacted.value;

        const baseUrl = step.base_url || "";
        const endpoint = buildEndpointPath(targetShape, step.model, baseUrl);
        const upstreamUrl = baseUrl.replace(/\/$/, "") + endpoint;
        const headers = buildAuthHeaders(targetShape, apiKey);
        const res = await fetch(upstreamUrl, { method: "POST", headers, body: JSON.stringify(upstreamBody), signal: AbortSignal.timeout(55000) });
        const latency = Date.now() - stepStart; totalLatency += latency;

        if (res.status >= 400) {
          const errorText = await res.text().catch(() => "");
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", step: i + 1, status: res.status, message: errorText || `HTTP ${res.status}`, latency_ms: latency })}\n\n`));
          continue;
        }

        let resBody = await res.json();
        if (sourceShape !== targetShape) resBody = translateResponse(resBody, targetShape, sourceShape);
        if (Object.keys(redacted.map).length > 0) resBody = transformJsonStrings(resBody, (s) => rehydrate(s, redacted.map));

        let responseText: string;
        if (resBody.choices?.[0]?.message?.content) responseText = resBody.choices[0].message.content;
        else if (resBody.content?.[0]?.text) responseText = resBody.content[0].text;
        else if (resBody.candidates?.[0]?.content?.parts?.[0]?.text) responseText = resBody.candidates[0].content.parts[0].text;
        else if (resBody.output?.[0]?.content?.[0]?.text) responseText = resBody.output[0].content[0].text;
        else responseText = JSON.stringify(resBody).slice(0, 500);

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "success", step: i + 1, status: res.status, latency_ms: latency, response_text: responseText, usage: resBody.usage })}\n\n`));
        succeededAt = i + 1; break;
      } catch (e) {
        const latency = Date.now() - stepStart; totalLatency += latency;
        const isTimeout = e instanceof DOMException && e.name === "AbortError";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", step: i + 1, status: isTimeout ? 504 : 500, message: isTimeout ? "Request timed out" : (e as Error).message, latency_ms: latency })}\n\n`));
      }
    }
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", steps_tried: stepsTried, succeeded_at: succeededAt, total_latency_ms: totalLatency })}\n\n`));
    controller.close();
  } });
  return new Response(stream, { status: 200, headers: { ...corsHeaders, "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive" } });
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Video serving route ─────────────────────────────────
  const urlPath = new URL(req.url).pathname;
  const videoMatch = urlPath.match(/\/v\/([a-f0-9-]+)\.mp4$/);
  if (videoMatch) {
    return await serveRedactedVideo(videoMatch[1]);
  }

  // ── Router test endpoint (before parsePath) ─────────────
  const routerTestMatch = urlPath.match(/\/redactor-proxy\/router\/([^/]+)\/test$/);
  if (routerTestMatch) {
    try {
      const authed = await authenticateProxyKey(req.headers.get("authorization"), supabase);
      const routerId = routerTestMatch[1];
      const router = await loadRouter(authed.userId, routerId, supabase);
      if (!router) return jsonError(404, `Router '${routerId}' not found`);
      if (authed.id !== "__test__" && authed.rateLimitRpm != null && !checkRateLimit(authed.id, authed.rateLimitRpm)) return jsonError(429, "Rate limit exceeded");
      return await runRouterTest(req, router, "openai", supabase, authed);
    } catch (e) {
      if (e instanceof ProxyError) return jsonError(e.status, e.message);
      console.error("redactor-proxy router test error", e);
      return jsonError(500, "Internal error");
    }
  }

  try {
    const authed = await authenticateProxyKey(req.headers.get("authorization"), supabase);

    const { route } = parsePath(req.url);
    if (!route) return jsonError(404, "Unknown endpoint");

    const pathSourceShape: Shape | undefined =
      route.providerId === "anthropic" ? "anthropic" :
      route.providerId === "google" ? "gemini" :
      route.providerId === "" || !route.providerId ? "openai" : undefined;

    let providerId = route.providerId;

    if (!providerId) {
      const ct = (req.headers.get("content-type") ?? "").toLowerCase();
      const isJson = ct.includes("application/json") || ct === "";
      if (isJson && req.method !== "GET" && req.method !== "HEAD") {
        const body = await req.clone().json().catch(() => null) as Record<string, unknown> | null;
        const model = body?.model as string | undefined;
        if (model) {
          const routed = resolveModelRouting(model);
          providerId = routed.providerId ?? "";

          if (providerId === "_router") {
            const routerName = routed.model;
            const router = await loadRouterByName(authed.userId, routerName, supabase);
            if (!router) return jsonError(404, `Router '${routerName}' not found`);
            if (router.steps.length === 0) return jsonError(400, `Router '${routerName}' has no enabled steps`);
            if (!isIPAllowed(getClientIP(req), authed.ipAllowlist)) return jsonError(403, "IP not allowed");
            if (authed.rateLimitRpm != null && !checkRateLimit(authed.id, authed.rateLimitRpm)) return jsonError(429, "Rate limit exceeded");
            if (!(await checkMonthlySpend(authed.id, authed.monthlyCapUsd, supabase))) return jsonError(429, "Monthly spend cap exceeded");
            return await runRouter(req, router, pathSourceShape ?? "openai", supabase, authed);
          }

          if (routed.model !== model) {
            const newBody = { ...body, model: routed.model };
            req = new Request(req.url, { method: req.method, headers: req.headers, body: JSON.stringify(newBody) });
          }
        }
      }
    }

    providerId = providerId || req.headers.get("x-provider") || "openai";

    if (authed.allowedProviders.length > 0 && !authed.allowedProviders.includes(providerId)) {
      return jsonError(403, `Provider '${providerId}' not allowed for this key`);
    }

    if (!isIPAllowed(getClientIP(req), authed.ipAllowlist)) return jsonError(403, "IP not allowed");
    if (authed.rateLimitRpm != null && !checkRateLimit(authed.id, authed.rateLimitRpm)) return jsonError(429, "Rate limit exceeded");
    if (!(await checkMonthlySpend(authed.id, authed.monthlyCapUsd, supabase))) return jsonError(429, "Monthly spend cap exceeded");

    // Log retention cleanup (fire-and-forget, max 1/min)
    {
      const now = Date.now();
      const existing = rateLimitBuckets.get("__log_cleanup");
      if (!existing || existing[existing.length - 1] < now - 60_000) {
        cleanOldLogs(supabase).catch(() => {});
        rateLimitBuckets.set("__log_cleanup", [now]);
      }
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
