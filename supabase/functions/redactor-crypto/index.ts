import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface EncryptedBlob {
  ciphertext: string;
  iv: string;
  salt: string;
}

let cachedMasterKey: Uint8Array | null = null;

async function getMasterKey(): Promise<Uint8Array> {
  if (cachedMasterKey) return cachedMasterKey;
  const raw = Deno.env.get("MASTER_ENCRYPTION_KEY");
  if (raw) {
    const buf = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    if (buf.length !== 32) throw new Error("MASTER_ENCRYPTION_KEY must be 32 bytes base64");
    cachedMasterKey = buf;
    return buf;
  }
  // Fallback: read from DB
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase
    .from("redactor_secrets")
    .select("value")
    .eq("key", "master_encryption_key")
    .maybeSingle();
  if (error || !data) throw new Error("MASTER_ENCRYPTION_KEY not set and no DB fallback");
  const buf = Uint8Array.from(atob(data.value), (c) => c.charCodeAt(0));
  if (buf.length !== 32) throw new Error("MASTER_ENCRYPTION_KEY must be 32 bytes base64");
  cachedMasterKey = buf;
  return buf;
}

let cachedInternalSecret: string | null = null;

async function getInternalSecret(): Promise<string | null> {
  if (cachedInternalSecret !== null) return cachedInternalSecret;
  const raw = Deno.env.get("REDACTOR_INTERNAL_SECRET");
  if (raw) {
    cachedInternalSecret = raw;
    return raw;
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data } = await supabase
    .from("redactor_secrets")
    .select("value")
    .eq("key", "internal_secret")
    .maybeSingle();
  cachedInternalSecret = data?.value ?? null;
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
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(enc);
  return {
    ciphertext: btoa(String.fromCharCode(...combined)),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

async function checkInternalSecret(req: Request): Promise<boolean> {
  const secret = await getInternalSecret();
  if (!secret) return true; // no secret configured — allow all
  const header = req.headers.get("x-internal-secret") ?? "";
  return header === secret;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, ...payload } = body;

    if (action === "decrypt-provider-key") {
      if (!(await checkInternalSecret(req))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { ciphertext, iv, salt } = payload;
      if (!ciphertext || !iv || !salt) throw new Error("ciphertext, iv, salt required");
      const saltBuf = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
      const ivBuf = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
      const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
      const keyRaw = await deriveKey(saltBuf);
      const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["decrypt"]);
      const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, combined);
      const apiKey = new TextDecoder().decode(dec);
      return new Response(JSON.stringify({ apiKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // encrypt-provider-key requires user JWT auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "encrypt-provider-key") {
      const { apiKey } = payload;
      if (!apiKey) throw new Error("apiKey required");
      const result = await encryptSecret(apiKey);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
