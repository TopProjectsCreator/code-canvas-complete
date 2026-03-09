import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Template list — kept in sync with src/data/templateRegistry.ts.
 * We duplicate the minimal data here because edge functions can't import from src/.
 * Format: { id, description } — used to build the system prompt dynamically.
 */
const TEMPLATES: { id: string; desc: string }[] = [
  { id: "blank", desc: "Empty project, start from scratch" },
  { id: "html", desc: "HTML/CSS/JS website" },
  { id: "react", desc: "React components & UI" },
  { id: "nodejs", desc: "Node.js server with Express" },
  { id: "javascript", desc: "Plain JavaScript (Node.js)" },
  { id: "typescript", desc: "TypeScript with types" },
  { id: "python", desc: "Python scripting, AI, data science" },
  { id: "flask", desc: "Python Flask web framework" },
  { id: "django", desc: "Python Django web framework" },
  { id: "java", desc: "Java enterprise apps" },
  { id: "cpp", desc: "C++ high-performance" },
  { id: "c", desc: "C systems/embedded" },
  { id: "go", desc: "Go backend development" },
  { id: "rust", desc: "Rust memory-safe systems" },
  { id: "zig", desc: "Zig modern systems language" },
  { id: "nim", desc: "Nim compiled language" },
  { id: "ruby", desc: "Ruby web development" },
  { id: "php", desc: "PHP server-side scripting" },
  { id: "csharp", desc: "C# .NET and games" },
  { id: "sqlite", desc: "SQL database queries" },
  { id: "r", desc: "R statistical computing" },
  { id: "haskell", desc: "Haskell functional programming" },
  { id: "lisp", desc: "Common Lisp" },
  { id: "d", desc: "D systems programming" },
  { id: "groovy", desc: "Groovy JVM scripting" },
  { id: "pascal", desc: "Pascal structured programming" },
  { id: "lua", desc: "Lua game scripting" },
  { id: "perl", desc: "Perl text processing" },
  { id: "bash", desc: "Bash shell scripting" },
  { id: "arduino", desc: "Arduino embedded systems" },
  { id: "scratch", desc: "Scratch visual block programming" },
  { id: "word", desc: "Word document editing" },
  { id: "powerpoint", desc: "PowerPoint presentations" },
  { id: "excel", desc: "Excel spreadsheets" },
  { id: "video", desc: "Video editing and playback" },
  { id: "audio", desc: "Audio editing and playback" },
  { id: "rtf", desc: "Rich text document editing" },
  { id: "cad", desc: "3D CAD model viewing (STL/OBJ)" },
];

const templateList = TEMPLATES.map((t) => `- ${t.id}: ${t.desc}`).join("\n");

const SYSTEM_PROMPT = `You are a helpful assistant embedded in an online IDE that is for Code Canvas Complete. This is a custom-built online IDE experience. Your job is to help users pick the right programming template for their project.

IMPORTANT PLATFORM FACTS:
- This platform is Code Canvas Complete (not Replit).
- Code execution uses Wandbox, a remote compilation sandbox.
- .replit files do absolutely nothing here. Never suggest them.
- nix configuration files do nothing here.
- Only standard library modules are available (no pip/npm install at runtime).
- For HTML/CSS/JS and React, code runs in-browser via Babel Standalone.

Users may attach images, PDFs, or other files to show you what they want to build (e.g. screenshots, mockups, documents). Analyze them and recommend the best template.

Available templates:
${templateList}

When recommending a template, always include the template ID in your response wrapped like this: [template:id] (e.g. [template:python]).
Keep responses concise (2-3 sentences max). Be friendly and helpful. If the user describes what they want to build, recommend the best template and explain why briefly.
If users ask about .replit files or nix, remind them those do not work in Code Canvas Complete.`;

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
