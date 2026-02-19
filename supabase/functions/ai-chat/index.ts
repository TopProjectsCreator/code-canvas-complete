import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGENT_SYSTEM_PROMPT = `You are an AI coding assistant integrated into an online IDE that is inspired by Replit but is NOT the real Replit. This is a custom-built IDE clone.

## CRITICAL PLATFORM FACTS

- This IDE is NOT Replit. It is a Replit-inspired clone built as a web app.
- Code execution uses **Wandbox** (a remote compilation/execution sandbox), NOT Replit's infrastructure.
- **.replit files do absolutely nothing** in this environment. Never suggest creating or editing .replit files.
- **nix configuration files do nothing** here. Do not suggest nix-related solutions.
- The terminal runs commands through Wandbox, not a real shell. Some commands may not work.
- Only standard library modules are available for most languages (Wandbox limitation). External packages cannot be pip/npm installed at runtime.
- For HTML/CSS/JS and React projects, code runs in-browser via Babel Standalone, not through Wandbox.
- Interactive stdin is handled by detecting input calls and prompting the user in the terminal before execution.

## Agent Capabilities

You operate in AGENT MODE: think step-by-step, use tools, and propose code changes users can apply directly.

### Web Search

You have access to web search. When users ask about current events, documentation, tutorials, or anything that would benefit from up-to-date information, use the web_search tool. The search results will be provided back to you so you can give informed answers.

### Structured Output Format

When analyzing code or proposing changes, use these special blocks:

1. **Thinking Process** - Show your reasoning (collapsible for users):
<thinking>
Your step-by-step analysis goes here...
</thinking>

2. **Code Changes** - Propose code that users can apply with one click:
<code_change file="filename.ts" lang="typescript" desc="Brief description of change">
// Your code here
</code_change>

3. **Workflow Creation** - Create automated workflows users can run:
<workflow name="Workflow Name" type="run|build|test|deploy|custom" command="command to execute" trigger="manual|on-save|on-commit">
Description of what this workflow does
</workflow>

4. **Package Installation** - Install packages for the user:
<install_package name="package-name" />

5. **Theme Change** - Change the IDE theme:
<set_theme theme="theme-name" />

Available themes: replit-dark, github-dark, monokai, dracula, nord, solarized-dark, one-dark

6. **Custom Theme Creation** - Create a brand new custom theme with specific colors:
<create_custom_theme name="Theme Name" background="#1a1b26" foreground="#c0caf5" primary="#7aa2f7" card="#1f2335" border="#292e42" terminalBg="#16161e" terminalText="#9ece6a" syntaxKeyword="#bb9af7" syntaxString="#9ece6a" syntaxFunction="#7aa2f7" syntaxComment="#565f89" />

7. **Image Generation** - Generate images using AI:
<generate_image prompt="A detailed description of the image to generate" />

8. **Music Generation** - Generate music using Lyria RealTime:
<generate_music prompt="Minimal techno with deep bass" />
<generate_music prompt="Chill lo-fi hip hop beats" bpm="85" duration="20" />

9. **Git Operations** - Manage version control:
<git_init />
<git_commit message="Your commit message here" />
<git_create_branch name="feature-branch-name" />
<git_import url="https://github.com/user/repo" />

10. **Project Sharing & Visibility**:
<make_public />
<make_private />
<get_project_link />
<share_twitter />
<share_linkedin />
<share_email />
<fork_project />
<star_project />
<view_history />

11. **User Interaction & Project Control**:
<ask_user question="What would you like to name this file?" />
<save_project />
<run_project />

### Response Guidelines

1. **Think First**: Always start with a <thinking> block for complex requests
2. **Be Actionable**: Every issue should have a proposed fix
3. **Use Code Blocks**: All code in proper \`\`\`language blocks
4. **Show Changes**: Use <code_change> for modifications users can apply
5. **Search the Web**: When users ask about current events or need up-to-date docs, use the web_search tool
6. **Never suggest .replit or nix files**: They don't work in this environment

## Current Context`;

const WEB_SEARCH_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information, documentation, tutorials, code examples, or any topic the user asks about.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query to look up on the web" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

// Provider endpoint configurations for BYOK
// Models list is not restrictive — any model the user's key supports will be forwarded
const BYOK_PROVIDERS: Record<string, { url: string; headerKey: string }> = {
  openai: { url: "https://api.openai.com/v1/chat/completions", headerKey: "Bearer" },
  anthropic: { url: "https://api.anthropic.com/v1/messages", headerKey: "x-api-key" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", headerKey: "Bearer" },
  perplexity: { url: "https://api.perplexity.ai/chat/completions", headerKey: "Bearer" },
  deepseek: { url: "https://api.deepseek.com/v1/chat/completions", headerKey: "Bearer" },
  xai: { url: "https://api.x.ai/v1/chat/completions", headerKey: "Bearer" },
  cohere: { url: "https://api.cohere.com/v2/chat", headerKey: "Bearer" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", headerKey: "Bearer" },
};

async function executeWebSearch(query: string, apiKey: string): Promise<string> {
  try {
    const searchResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a web search engine assistant. Provide comprehensive, factual, up-to-date information. Include code examples for programming topics." },
          { role: "user", content: `Search query: "${query}"\n\nProvide comprehensive search results for this query.` },
        ],
      }),
    });
    if (!searchResp.ok) return `Search for "${query}" failed.`;
    const searchData = await searchResp.json();
    return searchData.choices?.[0]?.message?.content || "No results found.";
  } catch (err) {
    console.error("Web search error:", err);
    return `Search for "${query}" encountered an error.`;
  }
}

async function callBYOKProvider(
  provider: string,
  apiKey: string,
  messages: any[],
  stream: boolean,
  requestedModel?: string,
): Promise<Response> {
  const config = BYOK_PROVIDERS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const model = requestedModel || "gpt-4o";

  // Anthropic has a different API format
  if (provider === "anthropic") {
    const systemMsg = messages.find((m: any) => m.role === "system");
    const nonSystemMsgs = messages.filter((m: any) => m.role !== "system");
    
    return fetch(config.url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemMsg?.content || "",
        messages: nonSystemMsgs,
        stream,
      }),
    });
  }

  // OpenAI-compatible format (OpenAI, Gemini, Perplexity, DeepSeek, xAI, Cohere, OpenRouter)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  return fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, stream }),
  });
}

const DAILY_LIMITS: Record<string, number> = { pro: 5, flash: 10, lite: -1 };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase config missing");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { messages, currentFile, consoleErrors, workflows, agentMode, model, byokProvider, byokModel } = await req.json();

    // Check if user has a custom API key for the selected BYOK provider
    let userApiKey: string | null = null;
    let selectedProvider: string | null = null;

    if (byokProvider && BYOK_PROVIDERS[byokProvider]) {
      const { data: keyData } = await supabase
        .from("user_api_keys")
        .select("api_key")
        .eq("user_id", userId)
        .eq("provider", byokProvider)
        .single();
      
      if (keyData) {
        userApiKey = (keyData as any).api_key;
        selectedProvider = byokProvider;
      }
    }

    // If no BYOK, check for any user key to bypass limits
    let hasByokKey = !!userApiKey;
    if (!hasByokKey) {
      const { data: anyKey } = await supabase
        .from("user_api_keys")
        .select("provider, api_key")
        .eq("user_id", userId)
        .limit(1);
      
      if (anyKey && anyKey.length > 0) {
        hasByokKey = true;
        // Use first available key if no specific provider selected
        if (!userApiKey) {
          userApiKey = (anyKey[0] as any).api_key;
          selectedProvider = (anyKey[0] as any).provider;
        }
      }
    }

    // Rate limiting for built-in keys
    const modelTier = model || "flash";
    if (!hasByokKey) {
      const limit = DAILY_LIMITS[modelTier];
      if (limit !== -1) {
        // Use service role to read/write usage tracking
        const serviceSupabase = supabaseServiceKey 
          ? createClient(supabaseUrl, supabaseServiceKey)
          : supabase;
        
        const today = new Date().toISOString().split("T")[0];
        const { data: usageData } = await serviceSupabase
          .from("ai_usage_tracking")
          .select("request_count")
          .eq("user_id", userId)
          .eq("model_tier", modelTier)
          .eq("usage_date", today)
          .single();

        const currentCount = (usageData as any)?.request_count || 0;
        if (currentCount >= limit) {
          return new Response(JSON.stringify({ 
            error: `Daily limit reached for ${modelTier.toUpperCase()} model (${limit} requests/day). Add your own API key for unlimited usage, or try the Lite model (free & unlimited).`,
            rateLimited: true,
            tier: modelTier,
            limit,
            used: currentCount,
          }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Increment usage
        if (usageData) {
          await serviceSupabase.from("ai_usage_tracking")
            .update({ request_count: currentCount + 1 })
            .eq("user_id", userId)
            .eq("model_tier", modelTier)
            .eq("usage_date", today);
        } else {
          await serviceSupabase.from("ai_usage_tracking")
            .insert({ user_id: userId, model_tier: modelTier, usage_date: today, request_count: 1 });
        }
      }
    }

    // Build context
    let contextSection = "";
    if (currentFile) {
      contextSection += `\n### Active File: \`${currentFile.name}\`\n**Language**: ${currentFile.language || "unknown"}\n\n\`\`\`${currentFile.language || ""}\n${currentFile.content}\n\`\`\`\n`;
    } else {
      contextSection += "📂 No file is currently open.";
    }
    if (consoleErrors) {
      contextSection += `\n\n### 🔴 Console Errors\n\`\`\`\n${consoleErrors}\n\`\`\``;
    }
    if (workflows && workflows.length > 0) {
      contextSection += `\n\n### 🔧 Existing Workflows\n${workflows.map((w: any) => `- **${w.name}** (${w.type}): \`${w.command}\``).join("\n")}`;
    }

    const systemPrompt = agentMode
      ? AGENT_SYSTEM_PROMPT + "\n" + contextSection
      : `You are a helpful AI coding assistant in a Replit-like IDE (but NOT actual Replit). This IDE runs code through Wandbox. .replit files do nothing here.\n\n${contextSection}`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // === BYOK path: call external provider directly ===
    if (userApiKey && selectedProvider) {
      console.log(`Using BYOK provider: ${selectedProvider}, model: ${byokModel}`);
      try {
        const byokResponse = await callBYOKProvider(selectedProvider, userApiKey, aiMessages, true, byokModel);
        if (!byokResponse.ok) {
          const errText = await byokResponse.text();
          console.error(`BYOK error (${selectedProvider}):`, byokResponse.status, errText);
          return new Response(JSON.stringify({ error: `${selectedProvider} API error (${byokResponse.status}): ${errText.slice(0, 200)}` }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Anthropic streams use a different SSE format - convert to OpenAI-compatible
        if (selectedProvider === "anthropic") {
          const reader = byokResponse.body!.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();
          
          const stream = new ReadableStream({
            async start(controller) {
              let buffer = "";
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  
                  let newlineIdx: number;
                  while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.slice(0, newlineIdx).trim();
                    buffer = buffer.slice(newlineIdx + 1);
                    
                    if (!line.startsWith("data: ") || line === "data: [DONE]") {
                      if (line === "data: [DONE]") {
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                      }
                      continue;
                    }
                    
                    try {
                      const parsed = JSON.parse(line.slice(6));
                      // Anthropic content_block_delta events
                      if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                        const openaiChunk = { choices: [{ delta: { content: parsed.delta.text } }] };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                      }
                      // Anthropic message_stop event
                      if (parsed.type === "message_stop") {
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                      }
                    } catch { /* skip unparseable lines */ }
                  }
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              } catch (err) {
                console.error("Anthropic stream transform error:", err);
                controller.close();
              }
            },
          });
          
          return new Response(stream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        // All other providers use OpenAI-compatible streaming
        return new Response(byokResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } catch (byokErr) {
        console.error("BYOK call failed:", byokErr);
        return new Response(JSON.stringify({ error: `Failed to call ${selectedProvider}: ${byokErr}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === Built-in AI path ===
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    // Try Lovable gateway first, then fall back to direct Gemini API
    const MODEL_MAP: Record<string, string> = {
      pro: "gemini-2.5-pro",
      flash: "gemini-2.5-flash",
      lite: "gemini-2.5-flash-lite",
    };
    const geminiModel = MODEL_MAP[model] || MODEL_MAP.flash;

    // Try Lovable gateway
    let gatewayWorked = false;
    if (LOVABLE_API_KEY) {
      const selectedModel = `google/${geminiModel}`;
      console.log(`Trying Lovable gateway with model: ${selectedModel}`);
      
      // Use a simplified messages array to avoid potential payload issues
      const simplifiedMessages = aiMessages.map((m: any) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content.slice(0, 30000) : m.content,
      }));
      
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages: simplifiedMessages, stream: true }),
      });

      if (streamResponse.ok) {
        gatewayWorked = true;
        return new Response(streamResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } else {
        const errorText = await streamResponse.text();
        console.error(`Lovable gateway failed (${streamResponse.status}):`, errorText.slice(0, 200));
      }
    }

    // Fallback: direct Gemini API via OpenAI-compatible endpoint
    if (!gatewayWorked && GEMINI_API_KEY) {
      console.log(`Using direct Gemini API with model: ${geminiModel}`);
      const streamResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: geminiModel, messages: aiMessages, stream: true }),
      });

      if (streamResponse.ok) {
        return new Response(streamResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } else {
        const errorText = await streamResponse.text();
        console.error(`Direct Gemini API failed (${streamResponse.status}):`, errorText.slice(0, 200));
      }
    }

    // Both failed
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "No AI API key configured. Add a Gemini API key in settings." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "AI service unavailable. Try using a BYOK provider key." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("AI chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
