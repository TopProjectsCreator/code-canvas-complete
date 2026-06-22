import { supabase } from "@/integrations/supabase/client";
import { nanoid } from "nanoid";

async function requireUserId(): Promise<string> {
  const { data: d } = await supabase.auth.getSession();
  const id = (d as any)?.session?.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

const db = supabase as any;

// ---------- Provider keys ----------

export interface ProviderKey {
  id: string;
  provider: string;
  label: string;
  baseUrl: string | null;
  createdAt: string;
}

export async function listProviderKeys(): Promise<ProviderKey[]> {
  const res: any = await db
    .from("redactor_provider_keys")
    .select("id, provider, label, base_url, created_at")
    .order("created_at", { ascending: false });
  const { data, error } = res;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    provider: r.provider,
    label: r.label,
    baseUrl: r.base_url,
    createdAt: r.created_at,
  }));
}

export async function addProviderKey(opts: {
  provider: string;
  label: string;
  apiKey: string;
  baseUrl?: string;
}) {
  const userId = await requireUserId();
  const id = nanoid();
  let encryptedKey: string, iv: string, salt: string;
  try {
    const { data, error } = await supabase.functions.invoke("redactor-crypto", {
      body: { action: "encrypt-provider-key", apiKey: opts.apiKey },
    });
    if (error || !data) throw error ?? new Error("Encryption failed");
    encryptedKey = data.ciphertext;
    iv = data.iv;
    salt = data.salt;
  } catch {
    throw new Error("Encryption unavailable — provider keys require the redactor-crypto edge function to be deployed.");
  }
  const res: any = await db.from("redactor_provider_keys").insert({
    id,
    user_id: userId,
    provider: opts.provider,
    label: opts.label,
    encrypted_key: encryptedKey,
    iv,
    salt,
    base_url: opts.baseUrl || null,
  });
  const { error } = res;
  if (error) throw error;
  return { ok: true };
}

export async function deleteProviderKey(id: string) {
  const res: any = await db
    .from("redactor_provider_keys")
    .delete()
    .eq("id", id);
  const { error } = res;
  if (error) throw error;
  return { ok: true };
}

// ---------- Proxy keys ----------

export interface ProxyKey {
  id: string;
  name: string;
  keyPrefix: string;
  allowedProviders: string[];
  rateLimitRpm: number | null;
  logRequests: boolean;
  redactImages: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
}

export async function listProxyKeys(): Promise<ProxyKey[]> {
  const res: any = await db
    .from("redactor_proxy_keys")
    .select("*")
    .order("created_at", { ascending: false });
  const { data, error } = res;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.key_prefix,
    allowedProviders: r.allowed_providers ?? [],
    rateLimitRpm: r.rate_limit_rpm,
    logRequests: r.log_requests,
    redactImages: r.redact_images ?? true,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revokedAt: r.revoked_at,
    expiresAt: r.expires_at,
  }));
}

export async function createProxyKey(opts: {
  name: string;
  allowedProviders: string[];
  logRequests: boolean;
  redactImages?: boolean;
  rateLimitRpm?: number;
  expiresAt?: string;
}): Promise<{ fullKey: string; prefix: string }> {
  const userId = await requireUserId();
  const random = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("");
  const full = `lvp_live_${random}`;
  const prefix = full.slice(0, 16);
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(full)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const id = nanoid();
  const res: any = await db.from("redactor_proxy_keys").insert({
    id,
    user_id: userId,
    key_hash: hash,
    key_prefix: prefix,
    name: opts.name,
    allowed_providers: opts.allowedProviders,
    log_requests: opts.logRequests,
    redact_images: opts.redactImages ?? true,
    rate_limit_rpm: opts.rateLimitRpm ?? null,
    expires_at: opts.expiresAt ?? null,
  });
  const { error } = res;
  if (error) throw error;
  return { fullKey: full, prefix };
}

export async function revokeProxyKey(id: string) {
  const res: any = await db
    .from("redactor_proxy_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  const { error } = res;
  if (error) throw error;
  return { ok: true };
}

// ---------- Redaction rules ----------

export interface RedactionRule {
  id: string;
  pattern: string;
  label: string;
  enabled: boolean;
  createdAt: string;
}

export async function listRules(): Promise<RedactionRule[]> {
  const res: any = await db
    .from("redactor_redaction_rules")
    .select("*")
    .order("created_at", { ascending: false });
  const { data, error } = res;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    pattern: r.pattern,
    label: r.label,
    enabled: r.enabled,
    createdAt: r.created_at,
  }));
}

export async function addRule(opts: { pattern: string; label: string }) {
  const userId = await requireUserId();
  try {
    new RegExp(opts.pattern);
  } catch {
    throw new Error("Invalid regex pattern");
  }
  const id = nanoid();
  const res: any = await db.from("redactor_redaction_rules").insert({
    id,
    user_id: userId,
    pattern: opts.pattern,
    label: opts.label,
    enabled: true,
  });
  const { error } = res;
  if (error) throw error;
  return { ok: true };
}

export async function deleteRule(id: string) {
  const res: any = await db
    .from("redactor_redaction_rules")
    .delete()
    .eq("id", id);
  const { error } = res;
  if (error) throw error;
  return { ok: true };
}

// ---------- Logs ----------

export interface RequestLog {
  id: string;
  provider: string;
  model: string | null;
  status: number;
  inputTokens: number | null;
  outputTokens: number | null;
  redactions: Record<string, number> | null;
  latencyMs: number | null;
  error: string | null;
  costUsd: number | null;
  createdAt: string;
  proxyKeyId?: string;
}

export interface LogStats {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  totalRedactions: number;
}

export async function getMonthlyStats(): Promise<LogStats> {
  const userId = await requireUserId();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const res: any = await db
    .from("redactor_request_logs")
    .select("*", { count: "exact", head: false })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  const { data, error } = res;
  if (error) throw error;
  const rows = (data ?? []) as any[];
  return {
    totalRequests: rows.length,
    totalTokens: rows.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0),
    totalCostUsd: rows.reduce((s, r) => s + parseFloat(r.cost_usd ?? "0"), 0),
    totalRedactions: rows.reduce((s, r) => {
      const red = r.redactions as Record<string, number> | null;
      if (!red) return s;
      return s + Object.values(red).reduce((a, b) => a + b, 0);
    }, 0),
  };
}

export async function listLogsPaginated(from: number, to: number, filters?: { provider?: string; proxyKeyId?: string; model?: string }): Promise<RequestLog[]> {
  const userId = await requireUserId();
  let query: any = db
    .from("redactor_request_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters?.provider) {
    query = query.eq("provider", filters.provider);
  }
  if (filters?.proxyKeyId) {
    query = query.eq("proxy_key_id", filters.proxyKeyId);
  }
  if (filters?.model) {
    query = query.ilike("model", `%${filters.model}%`);
  }
  const res: any = await query;
  const { data, error } = res;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    provider: r.provider,
    model: r.model,
    status: r.status,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    redactions: r.redactions as Record<string, number> | null,
    latencyMs: r.latency_ms,
    error: r.error,
    costUsd: r.cost_usd ?? null,
    createdAt: r.created_at,
    proxyKeyId: r.proxy_key_id,
  }));
}

export async function listLogs(): Promise<RequestLog[]> {
  const res: any = await db
    .from("redactor_request_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data, error } = res;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    provider: r.provider,
    model: r.model,
    status: r.status,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    redactions: r.redactions as Record<string, number> | null,
    latencyMs: r.latency_ms,
    error: r.error,
    costUsd: r.cost_usd ?? null,
    createdAt: r.created_at,
    proxyKeyId: r.proxy_key_id,
  }));
}
