import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // IPv6 loopback / link-local / ULA
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  // IPv4 ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast/reserved
  }
  // Known cloud metadata hostnames
  if (h === "metadata.google.internal" || h === "metadata.goog") return true;
  return false;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname) return false;
    if (isPrivateHostname(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authentication to prevent anonymous AI credit drain
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { partName, platform, vendorUrl, imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let vendorContext = "";
    if (typeof vendorUrl === "string" && vendorUrl.trim()) {
      const trimmed = vendorUrl.trim();
      if (!isSafeUrl(trimmed)) {
        return new Response(
          JSON.stringify({ error: "Invalid vendorUrl: must be https and not point to a private/internal host." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const vendorResp = await fetch(trimmed, {
          signal: controller.signal,
          redirect: "manual",
        });
        clearTimeout(timeout);
        if (vendorResp.ok) {
          const html = (await vendorResp.text()).slice(0, 200_000);
          const titleMatch = html.match(/<title>(.*?)<\/title>/i);
          const ogImageMatch = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
          vendorContext = `Vendor URL: ${trimmed}\nVendor title: ${titleMatch?.[1] ?? "unknown"}\nVendor image: ${ogImageMatch?.[1] ?? "unknown"}`;
        }
      } catch (error) {
        console.warn("vendor context fetch failed", error);
      }
    }

    const systemPrompt = `You are an electronics and robotics parts expert. Given a part name, provide detailed identification information. Return a JSON object with these fields:
- description: A clear 1-2 sentence description of what this part does
- category: One of: motor, servo, sensor, controller, structural, electrical, connector, wheel, gear, bearing, fastener, battery, cable, other
- manufacturer: The likely manufacturer (or "Generic" if unknown)
- partNumber: The common part number if known (or null)
- material: likely primary material(s) as a short string (e.g. "6061 aluminum", "ABS plastic")
- specifications: An object with relevant specs (voltage, current, dimensions, weight, etc.)
- compatibleWith: Array of platforms this part works with (e.g. ["ftc", "arduino", "general"])
- commonUses: Array of 3-5 common use cases
- tips: A short tip about using this part
- alternativeParts: Array of 1-3 alternative/equivalent parts

Platform context: ${platform || "general"}
${vendorContext ? `\n${vendorContext}` : ""}
Image provided: ${imageBase64 ? "yes" : "no"} (if yes, infer probable material/part family from visual cues)

IMPORTANT: Return ONLY valid JSON, no markdown fences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Identify this part: "${partName}"` },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { description: content, category: "other", specifications: {} };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("identify-part error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
