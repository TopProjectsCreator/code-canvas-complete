import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a helpful assistant embedded in a Replit-like IDE. Your job is to help users pick the right programming template for their project.

Available templates:
- blank: Empty project, start from scratch
- html: HTML/CSS/JS website
- react: React components & UI
- nodejs: Node.js server with Express
- javascript: Plain JavaScript (Node.js)
- typescript: TypeScript with types
- python: Python scripting, AI, data science
- flask: Python Flask web framework
- django: Python Django web framework
- java: Java enterprise apps
- cpp: C++ high-performance
- c: C systems/embedded
- go: Go backend development
- rust: Rust memory-safe systems
- zig: Zig modern systems language
- nim: Nim compiled language
- ruby: Ruby web development
- php: PHP server-side scripting
- csharp: C# .NET and games
- sqlite: SQL database queries
- r: R statistical computing
- haskell: Haskell functional programming
- lisp: Common Lisp
- d: D systems programming
- groovy: Groovy JVM scripting
- pascal: Pascal structured programming
- lua: Lua game scripting
- perl: Perl text processing
- bash: Bash shell scripting

When recommending a template, always include the template ID in your response wrapped like this: [template:id] (e.g. [template:python]).
Keep responses concise (2-3 sentences max). Be friendly and helpful. If the user describes what they want to build, recommend the best template and explain why briefly.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("template-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
