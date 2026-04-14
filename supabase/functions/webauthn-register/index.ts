import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple base64url helpers
function base64urlEncode(buf: Uint8Array): string {
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "get-challenge") {
      // Generate a registration challenge
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeB64 = base64urlEncode(challenge);

      // Get existing credentials to exclude
      const { data: existing } = await adminClient
        .from("webauthn_credentials")
        .select("credential_id")
        .eq("user_id", user.id);

      const excludeCredentials = (existing || []).map((c) => ({
        id: c.credential_id,
        type: "public-key",
      }));

      const options = {
        challenge: challengeB64,
        rp: {
          name: "CodeCanvas",
          id: new URL(req.headers.get("origin") || supabaseUrl).hostname,
        },
        user: {
          id: base64urlEncode(new TextEncoder().encode(user.id)),
          name: user.email || user.id,
          displayName:
            user.user_metadata?.display_name || user.email || "User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred",
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none",
        excludeCredentials,
      };

      return new Response(JSON.stringify({ options }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-registration") {
      const { credential, deviceName } = body;

      if (
        !credential?.id ||
        !credential?.response?.attestationObject ||
        !credential?.response?.clientDataJSON
      ) {
        return new Response(
          JSON.stringify({ error: "Invalid credential data" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Store the credential (in production you'd verify the attestation fully)
      // For WebAuthn level 1 with attestation=none, we trust the browser
      const { error: insertError } = await adminClient
        .from("webauthn_credentials")
        .insert({
          user_id: user.id,
          credential_id: credential.id,
          public_key: credential.response.attestationObject,
          sign_count: 0,
          device_name: deviceName || "Passkey",
          transports: credential.response.transports || [],
        });

      if (insertError) {
        return new Response(
          JSON.stringify({
            error: insertError.message.includes("unique")
              ? "This passkey is already registered"
              : insertError.message,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await adminClient
        .from("webauthn_credentials")
        .select("id, credential_id, device_name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ credentials: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { credentialId } = body;
      if (!credentialId) {
        return new Response(
          JSON.stringify({ error: "Missing credentialId" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      await adminClient
        .from("webauthn_credentials")
        .delete()
        .eq("id", credentialId)
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
