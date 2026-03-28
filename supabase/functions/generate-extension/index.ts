import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { name, description, runtime_type } = await req.json();
    if (!name || !description) {
      return new Response(JSON.stringify({ error: "name and description required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert extension developer for Code Canvas IDE. Generate a complete, working extension based on the user's description.

Extensions have three runtime modes:
1. "widget" - A React-like component that renders UI in a sidebar panel. Return an object with { render() } that returns an HTML string.
2. "command" - A function that processes text/code. Return an object with { execute(input: string): string }.
3. "chat-tool" - A function the AI can call. Return an object with { name, description, parameters: {}, execute(params): string }.

The extension code is injected into an async function body that already receives a "ctx" parameter.
DO NOT use "export default", "module.exports", or any import/require statements.
The code should directly use ctx and return the appropriate result.

The ctx object has these helpers:
- ctx.showUI(html: string) - Display HTML in the extension widget panel
- ctx.getSelectedText() - Get currently selected text in the editor
- ctx.replaceSelectedText(text: string) - Replace selected text
- ctx.showNotification(msg: string) - Show a toast notification
- ctx.fetch(url: string, options?) - Make HTTP requests (proxied)
- ctx.storage.get(key: string) - Get persisted value
- ctx.storage.set(key: string, value: any) - Set persisted value
- ctx.ai.complete(prompt: string) - Call AI for text completion
- ctx.ai.structured(prompt: string, schema: object) - Get structured AI output

IMPORTANT RULES:
- Write clean, modern JavaScript (no TypeScript, no imports, no exports)
- The code runs inside: (async function(ctx) { YOUR_CODE_HERE })
- Do NOT write "export default function", just write the code body directly
- For widgets: call ctx.showUI(html) with inline styles
- For commands: return { execute(input) { ... return transformedText; } }
- For chat-tools: return { name, description, parameters: {}, execute(params) { ... } }
- Include error handling
- Make the extension genuinely useful and complete

EXAMPLE for a "widget" extension:
const html = '<div style="padding:8px"><h3>Hello</h3></div>';
ctx.showUI(html);

EXAMPLE for a "command" extension:
return { execute(input) { return input.toUpperCase(); } };

Return ONLY the JavaScript code, no markdown fences, no explanation.`;

    const userPrompt = `Create a "${name}" extension (${runtime_type || "widget"} mode).
Description: ${description}

Generate the complete extension code.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted, add funds in Settings" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    let code = data.choices?.[0]?.message?.content || "";
    
    // Strip markdown fences if present
    code = code.replace(/^```(?:javascript|js)?\n?/gm, "").replace(/```$/gm, "").trim();

    return new Response(JSON.stringify({ code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-extension error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
