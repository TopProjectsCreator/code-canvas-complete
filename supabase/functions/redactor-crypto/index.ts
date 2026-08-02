import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface EncryptedBlob {
  ciphertext: string;
  iv: string;
  salt: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Server misconfigured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

let cachedMasterKey: Uint8Array | null = null;

async function getMasterKey(): Promise<Uint8Array> {
  if (cachedMasterKey) return cachedMasterKey;
  const decode = (raw: string) => {
    const buf = Uint8Array.from(atob(raw.trim()), (c) => c.charCodeAt(0));
    if (buf.length !== 32) throw new Error("MASTER_ENCRYPTION_KEY must be 32 bytes base64");
    return buf;
  };
  const raw = Deno.env.get("MASTER_ENCRYPTION_KEY");
  if (raw) {
    cachedMasterKey = decode(raw);
    return cachedMasterKey;
  }
  // Fallback: read from DB (service role required)
  const { data: rows, error } = await adminClient()
    .from("redactor_secrets")
    .select("value")
    .eq("key", "master_encryption_key");
  if (error) throw new Error(`Could not load master key: ${error.message}`);
  if (!rows || rows.length === 0) throw new Error("MASTER_ENCRYPTION_KEY not set and no DB fallback row");
  cachedMasterKey = decode(rows[0].value as string);
  return cachedMasterKey;
}

let cachedInternalSecret: string | null | undefined;

async function getInternalSecret(): Promise<string | null> {
  if (cachedInternalSecret !== undefined) return cachedInternalSecret;
  const raw = Deno.env.get("REDACTOR_INTERNAL_SECRET");
  if (raw) {
    cachedInternalSecret = raw;
    return raw;
  }
  try {
    const { data: secRows } = await adminClient()
      .from("redactor_secrets")
      .select("value")
      .eq("key", "internal_secret");
    cachedInternalSecret = (secRows?.[0]?.value as string) ?? null;
  } catch {
    cachedInternalSecret = null;
  }
  return cachedInternalSecret;
}

async function deriveKey(salt: Uint8Array): Promise<Uint8Array> {
  const master = await getMasterKey();
  const key = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", salt, info: new TextEncoder().encode("provider-key-v1"), hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function encryptSecret(plaintext: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyRaw = await deriveKey(salt);
  const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["encrypt"]);
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(enc);
  return {
    ciphertext: btoa(String.fromCharCode(...combined)),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

async function checkInternalSecret(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (SERVICE_KEY && authHeader === `Bearer ${SERVICE_KEY}`) return true;
  const secret = await getInternalSecret();
  if (!secret) return true;
  return (req.headers.get("x-internal-secret") ?? "") === secret;
}

/** Verify the caller's JWT. Works with either service-role or anon/publishable key. */
async function getCallerUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { user: null, reason: "Missing Authorization header" };
  const key = SERVICE_KEY || ANON_KEY;
  if (!SUPABASE_URL || !key) {
    return { user: null, reason: "Server misconfigured: Supabase credentials unavailable" };
  }
  const client = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, reason: error?.message ?? "Invalid session token" };
  }
  return { user: data.user, reason: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...payload } = body as Record<string, unknown>;

    if (action === "decrypt-provider-key") {
      if (!(await checkInternalSecret(req))) return json({ error: "Forbidden" }, 403);
      const { ciphertext, iv, salt } = payload as Record<string, string>;
      if (!ciphertext || !iv || !salt) return json({ error: "ciphertext, iv, salt required" }, 400);
      const saltBuf = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
      const ivBuf = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
      const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
      const keyRaw = await deriveKey(saltBuf);
      const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["decrypt"]);
      const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, combined);
      return json({ apiKey: new TextDecoder().decode(dec) });
    }

    if (action === "encrypt-provider-key") {
      const { user, reason } = await getCallerUser(req);
      if (!user) {
        console.error("encrypt-provider-key unauthorized:", reason);
        return json({ error: `Unauthorized: ${reason}` }, 401);
      }
      const apiKey = typeof payload.apiKey === "string" ? payload.apiKey : "";
      const result = await encryptSecret(apiKey);
      return json(result);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("redactor-crypto error:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
