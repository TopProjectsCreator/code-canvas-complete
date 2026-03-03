import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGENT_SYSTEM_PROMPT = `You are an AI coding assistant in an online IDE. Shell/bash/javascript commands run in browser-native WebContainers (Node.js via jsh/node) by default, while other languages run through the existing execute-code backend (Wandbox or optional container runner). .replit and nix files do nothing in Code Canvas Complete.

CRITICAL: NEVER suggest the user switch to another IDE (Replit, CodeSandbox, StackBlitz, VS Code, etc.). Code Canvas Complete is fully capable. If a user asks about Node.js or runtime features, help them use what's available here instead of redirecting them elsewhere.

## RULES
- NEVER ask questions in plain text. ALWAYS use <ask_prompt> tags (see below).
- Use widgets sparingly: do NOT spam widgets. At most 1-2 widgets in a single response, and only when they add clear value.
- Think step-by-step in <thinking_process> blocks for complex requests.
- Propose code changes via <code_change> or <code_diff> blocks.

## INTERACTIVE QUESTIONS
Instead of typing a question, use one of these.
- Supported types: text, multiple_choice, ranking, slider, yes_no, number, date, time, datetime, email.
- If you need a yes/no response, prefer \`type="yes_no"\`.
- For one-choice pickers, use \`multiple_choice\` without \`multi="true"\`.

<ask_prompt type="text" question="What should the file be named?" />
<ask_prompt type="multiple_choice" question="Which framework?" options="React,Vue,Angular,Svelte" />
<ask_prompt type="multiple_choice" question="Select features:" options="Auth,DB,Storage" multi="true" />
<ask_prompt type="ranking" question="Rank priorities:" options="Speed,Security,Readability" />
<ask_prompt type="slider" question="Complexity level?" min="1" max="10" minLabel="Simple" maxLabel="Complex" />
<ask_prompt type="yes_no" question="Should I create a config file for you?" />
<ask_prompt type="number" question="How many items should I generate?" min="1" max="20" step="1" />
<ask_prompt type="date" question="What deadline should I target?" />
<ask_prompt type="time" question="What time should I schedule it for?" />
<ask_prompt type="datetime" question="When should this run?" />
<ask_prompt type="email" question="What email should receive updates?" placeholder="name@example.com" />

## INLINE WIDGETS — use contextually

| Tag | When to use |
|-----|------------|
| \`<color_picker default="#hex" />\` | CSS color discussions |
| \`<coin_flip />\` or \`<coin_flip result="heads" />\` | Random yes/no, can be rigged |
| \`<dice_roll />\` or \`<dice_roll sides="20" />\` | Random number picks |
| \`<calculator />\` | Math discussions |
| \`<spinner sections="A,B,C" colors="#e11,#38f,#2c5" />\` | Fun decision making |
| \`<stock symbol="AAPL" />\` | Finance/stock discussions |
| \`<change_template template="python" />\` | Switching project language |
| \`<pomodoro duration="25" />\` | Focus/pair-programming timer |
| \`<show_project_stats />\` | Project metrics overview |
| \`<start_review />\` | Code review requests |
| \`<visualize_logic />\` | Algorithm flowcharts (use Mermaid) |
| \`<search_assets query="icon" />\` | Finding icons/assets |
| \`<preview_viewport size="mobile" />\` | Responsive checks |
| \`<run_a11y_check />\` | Accessibility audit |
| \`<add_todo task="Fix bug" />\` | Task tracking |
| \`<generate_readme />\` | README generation |
| \`<generate_tests file="app.ts" />\` | Test generation |

Available templates: blank, html, javascript, typescript, python, java, cpp, c, go, rust, ruby, php, csharp, bash, react, lua, nodejs, D

## CODE CHANGES

Full file: <code_change file="name.ts" lang="typescript" desc="description">code</code_change>
Diff only: <code_diff file="name.ts" lang="typescript" desc="description">unified diff</code_diff>

## OTHER COMMANDS

<workflow name="Name" type="run|build|test|deploy|custom" command="cmd" trigger="manual|on-save|on-commit">desc</workflow>
<install_package name="pkg" />
<set_theme theme="canvas-dark|github-dark|monokai|dracula|nord|solarized-dark|one-dark" />
<create_custom_theme name="Name" background="#1a1b26" foreground="#c0caf5" primary="#7aa2f7" card="#1f2335" border="#292e42" terminalBg="#16161e" terminalText="#9ece6a" syntaxKeyword="#bb9af7" syntaxString="#9ece6a" syntaxFunction="#7aa2f7" syntaxComment="#565f89" />
<generate_image prompt="description" />
<generate_music prompt="genre description" />
<git_init /> <git_commit message="msg" /> <git_create_branch name="branch" /> <git_import url="url" />
<make_public /> <make_private /> <get_project_link />
<share_twitter /> <share_linkedin /> <share_email />
<fork_project /> <star_project /> <view_history />
<save_project /> <run_project />
<rename_file old="a.js" new="b.js" /> <delete_file name="temp.js" />
<run_shell command="ls -la" />  — Execute a shell command and show output inline. Use for running scripts, checking files, etc.
- For Python package manager commands (`pip`, `pip3`, `uv`), explain that browser WebContainers do not provide Python tooling and recommend enabling container-runner mode (`EXECUTOR_MODE=hybrid|container` with `EXECUTOR_CONTAINER_BASE_URL`) when needed.

## Multimodal
Users can attach images, PDFs, videos, and audio. Analyze them thoroughly when provided.

## Current Context`;

const WEB_SEARCH_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information, documentation, tutorials, code examples, or any topic the user asks about.",
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
const BYOK_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-2.5-pro",
  perplexity: "sonar",
  deepseek: "deepseek-chat",
  xai: "grok-4-fast",
  cohere: "command-r-plus",
  openrouter: "openai/gpt-4o",
  github: "gpt-4o",
};

const BYOK_PROVIDERS: Record<string, { url: string; headerKey: string }> = {
  openai: { url: "https://api.openai.com/v1/chat/completions", headerKey: "Bearer" },
  anthropic: { url: "https://api.anthropic.com/v1/messages", headerKey: "x-api-key" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", headerKey: "Bearer" },
  perplexity: { url: "https://api.perplexity.ai/chat/completions", headerKey: "Bearer" },
  deepseek: { url: "https://api.deepseek.com/v1/chat/completions", headerKey: "Bearer" },
  xai: { url: "https://api.x.ai/v1/chat/completions", headerKey: "Bearer" },
  cohere: { url: "https://api.cohere.com/v2/chat", headerKey: "Bearer" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", headerKey: "Bearer" },
  github: { url: "https://models.inference.ai.azure.com/chat/completions", headerKey: "Bearer" },
};

async function executeWebSearch(query: string, apiKey: string): Promise<string> {
  try {
    const searchResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a web search engine assistant. Provide comprehensive, factual, up-to-date information. Include code examples for programming topics.",
          },
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

  const model = requestedModel || BYOK_DEFAULT_MODELS[provider] || "gpt-4o";

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

  // OpenAI-compatible format
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { messages, currentFile, consoleErrors, workflows, agentMode, model, byokProvider, byokModel } =
      await req.json();

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
        const serviceSupabase = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

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
          return new Response(
            JSON.stringify({
              error: `Daily limit reached for ${modelTier.toUpperCase()} model (${limit} requests/day). Add your own API key for unlimited usage, or try the Lite model (free & unlimited).`,
              rateLimited: true,
              tier: modelTier,
              limit,
              used: currentCount,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (usageData) {
          await serviceSupabase
            .from("ai_usage_tracking")
            .update({ request_count: currentCount + 1 })
            .eq("user_id", userId)
            .eq("model_tier", modelTier)
            .eq("usage_date", today);
        } else {
          await serviceSupabase
            .from("ai_usage_tracking")
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
      : `You are a helpful AI coding assistant in Code Canvas Complete. This IDE runs code through Wandbox. .replit files do nothing here.\n\nCRITICAL: NEVER suggest the user switch to another IDE (Replit, CodeSandbox, StackBlitz, VS Code, etc.). Code Canvas Complete is fully capable.\n\n${contextSection}`;

    // Messages may contain multimodal content (content as array with text + image_url parts)
    // Pass them through as-is since the gateway supports OpenAI-compatible format
    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // === BYOK path: call external provider directly ===
    if (userApiKey && selectedProvider) {
      const effectiveByokModel = byokModel || BYOK_DEFAULT_MODELS[selectedProvider] || "gpt-4o";
      console.log(`Using BYOK provider: ${selectedProvider}, model: ${effectiveByokModel}`);
      try {
        const byokResponse = await callBYOKProvider(selectedProvider, userApiKey, aiMessages, true, effectiveByokModel);
        if (!byokResponse.ok) {
          const errText = await byokResponse.text();
          console.error(`BYOK error (${selectedProvider}):`, byokResponse.status, errText);
          return new Response(
            JSON.stringify({
              error: `${selectedProvider} API error (${byokResponse.status}): ${errText.slice(0, 200)}`,
            }),
            {
              status: 502,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
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
                      if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                        const openaiChunk = { choices: [{ delta: { content: parsed.delta.text } }] };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                      }
                      if (parsed.type === "message_stop") {
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                      }
                    } catch {
                      /* skip unparseable lines */
                    }
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
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === Built-in AI path ===
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY || LOVABLE_API_KEY === "placeholder") {
      return new Response(
        JSON.stringify({
          error:
            "Built-in AI is not available. Please add your own API key (OpenAI, Anthropic, Gemini, etc.) in the API Keys settings to use the AI chat.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const MODEL_MAP: Record<string, string> = {
      pro: "google/gemini-2.5-pro",
      flash: "google/gemini-3-flash-preview",
      lite: "google/gemini-2.5-flash-lite",
    };
    const selectedModel = MODEL_MAP[model] || MODEL_MAP.flash;
    console.log(`Using Lovable gateway with model: ${selectedModel}`);

    const conversation: any[] = [...aiMessages];
    let finalAssistantContent = "";

    for (let i = 0; i < 4; i++) {
      const completionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: conversation,
          tools: WEB_SEARCH_TOOLS,
          tool_choice: "auto",
          stream: false,
        }),
      });

      if (!completionResponse.ok) {
        const errorText = await completionResponse.text();
        console.error(`Lovable gateway error (${completionResponse.status}):`, errorText.slice(0, 200));

        if (completionResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            error: "Built-in AI service unavailable. Please use your own API key (BYOK) instead.",
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const completionData = await completionResponse.json();
      const assistantMessage = completionData?.choices?.[0]?.message;
      if (!assistantMessage) {
        finalAssistantContent = "I could not produce a response.";
        break;
      }

      const toolCalls = assistantMessage.tool_calls || [];
      conversation.push(assistantMessage);

      if (toolCalls.length === 0) {
        finalAssistantContent = assistantMessage.content || "";
        break;
      }

      for (const call of toolCalls) {
        if (call?.function?.name !== "web_search") continue;

        let query = "";
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          query = args.query || "";
        } catch {
          query = "";
        }

        const searchResult = query
          ? await executeWebSearch(query, LOVABLE_API_KEY)
          : "Search failed: query was missing.";

        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          name: "web_search",
          content: searchResult,
        });
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunk = { choices: [{ delta: { content: finalAssistantContent || "" } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
