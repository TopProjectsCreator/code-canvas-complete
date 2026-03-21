import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARDUINO_SECTION = `
## ARDUINO & BREADBOARD CAD
When the user is working with the Arduino template, they have access to a visual breadboard circuit designer. You can **generate circuit.json files directly** to build breadboards programmatically.

### Breadboard Visualizer
- The breadboard panel is in the "Breadboard" tab of the Arduino panel (bottom of the IDE).
- **Tool Modes**: Select (move components), Wire (connect pins), Delete (remove components/wires).
- **Simulation**: Click the green "Simulate" button to test the circuit.
- Upload to a physical board via the "Upload to Board" button (requires USB connection via Web Serial).

### Code + Circuit Workflow
- The sketch code is in \`sketch.ino\` — edit it in the code editor.
- The circuit layout is saved in \`circuit.json\`. You can generate or modify this file directly.
- Use \`<code_change file="sketch.ino" lang="cpp" desc="...">\` for Arduino sketch changes.
- Use \`<code_change file="circuit.json" lang="json" desc="...">\` to generate/update the breadboard layout.

### circuit.json Schema
The file must conform to this structure:
\`\`\`json
{
  "id": "circuit-1",
  "boardId": "uno",
  "components": [
    {
      "id": "comp-1",
      "type": "led",
      "label": "LED1",
      "pins": {},
      "properties": { "color": "#ff0000" },
      "x": 200,
      "y": 100
    }
  ],
  "connections": [],
  "wires": [
    {
      "id": "wire-1",
      "from": { "componentId": "comp-1", "pinIndex": 0, "x": 210, "y": 140 },
      "to": { "componentId": "comp-2", "pinIndex": 1, "x": 320, "y": 110 },
      "color": "#ef4444"
    }
  ],
  "code": ""
}
\`\`\`

### Boards
Valid boardId values: uno, mega, nano, leonardo, micro, due, esp32, esp8266, nano_33_iot, nano_33_ble, portenta_h7, rp2040, attiny85, teensy40, stm32f4, feather_m0.

### Component Types & Pins
Place components on a 15px snap grid. The canvas breadboard area starts around x=50 and the board holes go from roughly y=60 to y=300. Space components apart (at least 80px).

| Type | Pins (by index order) | Key Properties |
|------|----------------------|----------------|
| led | anode(0), cathode(1) | color: hex string (default #ff0000) |
| resistor | left(0), right(1) | resistance: string e.g. "220Ω", "1kΩ", "10kΩ" |
| button | 1a(0), 1b(1), 2a(2), 2b(3) | label: string |
| buzzer | positive(0), negative(1) | frequency: number (default 1000) |
| capacitor | positive(0), negative(1) | capacitance: string e.g. "100µF" |
| potentiometer | left(0), wiper(1), right(2) | resistance: string |
| servo | signal(0), vcc(1), gnd(2) | angle: number (0-180) |
| motor | positive(0), negative(1) | type: "dc" |
| sensor_temp | vcc(0), out(1), gnd(2) | simValue: number |
| sensor_light | left(0), right(1) | simValue: number |
| diode | anode(0), cathode(1) | type: "1N4007" |
| transistor_npn | base(0), collector(1), emitter(2) | partNumber: "2N2222" |
| rgb_led | red(0), green(1), blue(2), common(3) | type: "common_cathode" |
| ic | pin1..pin16 | partNumber: string |
| relay | coil1(0), coil2(1), com(2), no(3) | coilVoltage: "5V" |
| toggle_switch | left(0), common(1), right(2) | |
| seven_seg | a(0), b(1), c(2), d(3) | type: "common_cathode" |
| fuse | left(0), right(1) | rating: "1A" |
| piezo | positive(0), negative(1) | |
| inductor | left(0), right(1) | inductance: "10mH" |
| voltage_reg | input(0), gnd(1), output(2) | partNumber: "7805" |
| mosfet | gate(0), drain(1), source(2) | channel: "n" |
| lcd | pin1..pin8 | rows: 2, cols: 16 |
| ultrasonic | vcc(0), trig(1), echo(2), gnd(3) | |
| pir_sensor | vcc(0), out(1), gnd(2) | |
| oled_display | vcc(0), gnd(1), scl(2), sda(3) | |

### Wiring Rules
- Wire \`from\` and \`to\` each need: \`componentId\`, \`pinIndex\`, \`x\`, \`y\`.
- Pin coordinates are computed from the component's x,y position. For bottom pins: \`pinX = component.x + pinFraction * componentWidth\`, \`pinY = component.y + componentHeight\`.
- To connect to an Arduino board pin, use \`boardRow\` and \`boardCol\` instead of \`componentId\`. Board pin positions: D0-D13 at top, A0-A5 at bottom-right, 5V/3.3V/GND on the power header.
- To connect to a power rail, use \`rail\`: "top+", "top-", "bot+", "bot-".
- Wire colors: use #ef4444 (red), #22c55e (green), #3b82f6 (blue), #eab308 (yellow), #111111 (black), #f97316 (orange), #a855f7 (purple), #ffffff (white).

### Example: LED + Resistor on Pin 13
\`\`\`json
{
  "id": "circuit-1",
  "boardId": "uno",
  "components": [
    { "id": "r1", "type": "resistor", "label": "R1 220Ω", "pins": {}, "properties": { "resistance": "220Ω" }, "x": 195, "y": 120 },
    { "id": "led1", "type": "led", "label": "LED1", "pins": {}, "properties": { "color": "#ff0000" }, "x": 300, "y": 90 }
  ],
  "connections": [],
  "wires": [
    { "id": "w1", "from": { "boardRow": 0, "boardCol": 13, "x": 750, "y": 28 }, "to": { "componentId": "r1", "pinIndex": 0, "x": 195, "y": 130 }, "color": "#3b82f6" },
    { "id": "w2", "from": { "componentId": "r1", "pinIndex": 1, "x": 265, "y": 130 }, "to": { "componentId": "led1", "pinIndex": 0, "x": 310, "y": 130 }, "color": "#3b82f6" },
    { "id": "w3", "from": { "componentId": "led1", "pinIndex": 1, "x": 318, "y": 130 }, "to": { "rail": "bot-", "x": 318, "y": 290 }, "color": "#111111" }
  ],
  "code": ""
}
\`\`\`

When asked to "build a circuit" or "create a breadboard", ALWAYS generate a complete circuit.json using \`<code_change file="circuit.json" lang="json" desc="...">\` along with the matching sketch.ino code. Generate unique IDs for components (e.g. "led-1", "r-1") and wires (e.g. "w-1", "w-2"). Space components apart to avoid overlap.
`;

const AGENT_SYSTEM_PROMPT_BASE = `You are an AI coding assistant in an online IDE. Shell/bash/javascript commands run in browser-native WebContainers (Node.js via jsh/node) by default, while other languages run through the existing execute-code backend (Wandbox or optional container runner). .replit and nix files do nothing in Code Canvas Complete.

CRITICAL: NEVER suggest the user switch to another IDE (Replit, CodeSandbox, StackBlitz, VS Code, etc.). Code Canvas Complete is fully capable. If a user asks about Node.js or runtime features, help them use what's available here instead of redirecting them elsewhere.

## RULES
- Use widgets sparingly: do NOT spam widgets. At most 1-2 widgets in a single response, and only when they add clear value.
- Think step-by-step in <thinking_process> blocks for complex requests.
- Propose code changes via <code_change> or <code_diff> blocks.

## INTERACTIVE QUESTIONS
Instead of typing a question, use one of these.
- Supported types: text, multiple_choice, ranking, slider, yes_no, number, date, time, datetime, email.
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
| \`<docs_link slug="welcome" title="Welcome to CodeCanvas" />\` | Link user to a docs page — use when answering questions about how the IDE works |
| \`<countdown seconds="60" label="Deploy timer" />\` | Countdown timer for any timed task |
| \`<password_generator length="16" />\` | Generate a secure random password |
| \`<unit_converter />\` | Unit conversion (px↔rem, colors, etc.) |
| \`<progress_tracker steps="Design,Code,Test,Deploy" current="1" />\` | Visual step progress |
| \`<json_viewer />\` | Pretty-print a JSON payload |
| \`<regex_tester />\` | Test regex patterns live |

Available templates: blank, html, javascript, typescript, python, java, cpp, c, go, rust, ruby, php, csharp, bash, react, lua, nodejs, D, arduino

## DOCUMENTATION SEARCH
The IDE has a built-in docs hub at \`/docs\`. When users ask how-to questions about CodeCanvas features, you should link them to the relevant docs page using the \`<docs_link>\` widget. Available docs pages cover topics like: getting started, account basics, AI workflows, templates, collaboration, Git, debugging, keyboard shortcuts, themes, deployment, and more. Use slug identifiers from the docs system.

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
<agent_done /> — Signal that you have completed all steps and are done. Use this ONLY when you are confident the task is fully resolved. If you ran shell commands or made code changes and want to verify them, keep going instead of emitting this tag.
Note: For Python package manager commands (pip, pip3, uv), explain that browser WebContainers do not provide Python tooling and recommend enabling container-runner mode.

## AGENTIC BEHAVIOR
You are an **agentic AI** — you should keep working autonomously until the task is fully complete.
- After running a shell command, analyze the output and decide if more actions are needed.
- After making code changes, consider if tests should be run or if related files need updating.
- Keep iterating: run commands, read output, fix issues, verify — until you are confident the task is done.
- When you are fully done, emit \`<agent_done />\` to signal completion.
- Do NOT ask the user for permission at every step — just keep going. Only ask if genuinely ambiguous.

## MCP SERVERS
When MCP servers are configured, you can call them using the \`mcp_call\` tool. Use this to interact with external services and retrieve data. Always call MCP servers when the user asks about topics that an MCP server can help with. Present the results clearly to the user.

## Multimodal
Users can attach images, PDFs, videos, and audio. Analyze them thoroughly when provided.

## Current Context`;

function buildSystemPrompt(template?: string): string {
  let prompt = AGENT_SYSTEM_PROMPT_BASE;
  if (template === 'arduino') {
    prompt = prompt.replace('## CODE CHANGES', ARDUINO_SECTION + '\n## CODE CHANGES');
  }
  return prompt;
}

const BASE_TOOLS = [
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

function buildMCPTool(mcpServers: any[]): any {
  const serverList = mcpServers.map((s: any) => s.name).join(", ");
  return {
    type: "function",
    function: {
      name: "mcp_call",
      description: `Call a configured MCP (Model Context Protocol) server to retrieve data or perform actions. Available servers: ${serverList}. Use JSON-RPC format for the request body.`,
      parameters: {
        type: "object",
        properties: {
          server_name: {
            type: "string",
            description: `Name of the MCP server to call. One of: ${serverList}`,
          },
          method: {
            type: "string",
            description:
              "The JSON-RPC method to call, e.g. 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get'",
          },
          params: {
            type: "object",
            description: "Parameters for the JSON-RPC method call",
          },
        },
        required: ["server_name", "method"],
        additionalProperties: false,
      },
    },
  };
}

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

async function executeMCPCall(serverName: string, method: string, params: any, mcpServers: any[]): Promise<string> {
  const server = mcpServers.find((s: any) => s.name.toLowerCase() === serverName.toLowerCase());
  if (!server) {
    return JSON.stringify({
      error: `MCP server "${serverName}" not found. Available: ${mcpServers.map((s: any) => s.name).join(", ")}`,
    });
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (server.api_key) {
      headers["Authorization"] = `Bearer ${server.api_key}`;
    }

    const body = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: params || {},
    };

    console.log(`MCP call to ${server.name} (${server.url}): ${method}`);

    const resp = await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`MCP server error (${resp.status}):`, errText.slice(0, 500));
      return JSON.stringify({ error: `MCP server returned ${resp.status}: ${errText.slice(0, 300)}` });
    }

    const contentType = resp.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream")) {
      // Handle SSE responses - collect all data events
      const text = await resp.text();
      const results: any[] = [];
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            results.push(JSON.parse(line.slice(6)));
          } catch {
            /* skip */
          }
        }
      }
      return JSON.stringify(results.length === 1 ? results[0] : results);
    }

    const data = await resp.json();
    return JSON.stringify(data);
  } catch (err) {
    console.error(`MCP call error:`, err);
    return JSON.stringify({ error: `Failed to call MCP server "${serverName}": ${err}` });
  }
}

async function callBYOKProvider(
  provider: string,
  apiKey: string,
  messages: any[],
  stream: boolean,
  requestedModel?: string,
  tools?: any[],
  options?: { temperature?: number; maxTokens?: number; thinkingBudget?: number },
): Promise<Response> {
  const config = BYOK_PROVIDERS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const model = requestedModel || BYOK_DEFAULT_MODELS[provider] || "gpt-4o";
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 4096;

  // Anthropic has a different API format
  if (provider === "anthropic") {
    const systemMsg = messages.find((m: any) => m.role === "system");
    const nonSystemMsgs = messages.filter((m: any) => m.role !== "system");

    const body: any = {
      model,
      max_tokens: maxTokens,
      system: systemMsg?.content || "",
      messages: nonSystemMsgs,
      stream,
      temperature,
    };
    if (options?.thinkingBudget && options.thinkingBudget > 0) {
      body.thinking = { type: "enabled", budget_tokens: options.thinkingBudget };
      delete body.temperature; // Anthropic doesn't allow temperature with thinking
    }
    if (tools && tools.length > 0) {
      body.tools = tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    return fetch(config.url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  }

  // OpenAI-compatible format
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const body: any = { model, messages, stream, temperature, max_tokens: maxTokens };
  if (options?.thinkingBudget && options.thinkingBudget > 0) {
    // For Gemini/OpenAI reasoning models
    body.reasoning_effort = options.thinkingBudget > 16384 ? "high" : options.thinkingBudget > 4096 ? "medium" : "low";
  }
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  return fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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
    const {
      messages,
      currentFile,
      consoleErrors,
      workflows,
      agentMode,
      model,
      byokProvider,
      byokModel,
      temperature: reqTemperature,
      maxTokens: reqMaxTokens,
      thinkingBudget: reqThinkingBudget,
      enableWebSearch,
      enableCodeExecution,
      enableMCP,
      template,
    } = await req.json();

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

    // Fetch user's enabled MCP servers and agent skills
    const serviceSupabaseForContext = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;
    const [{ data: mcpServers }, { data: agentSkills }] = await Promise.all([
      serviceSupabaseForContext
        .from("mcp_servers")
        .select("name, url, description, api_key, is_enabled")
        .eq("user_id", userId)
        .eq("is_enabled", true),
      serviceSupabaseForContext
        .from("agent_skills")
        .select("name, description, instruction, is_enabled")
        .eq("user_id", userId)
        .eq("is_enabled", true),
    ]);

    // Build tools list based on toggles (default to enabled if not specified)
    const tools: any[] = [];
    const enabledMCPServers = (mcpServers as any[]) || [];
    if (enableWebSearch !== false) {
      tools.push(...BASE_TOOLS);
    }
    if (enableMCP !== false && enabledMCPServers.length > 0) {
      tools.push(buildMCPTool(enabledMCPServers));
    }

    // Build provider options from request params
    const providerOptions = {
      temperature: reqTemperature,
      maxTokens: reqMaxTokens,
      thinkingBudget: reqThinkingBudget,
    };

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
    if (enabledMCPServers.length > 0) {
      contextSection += `\n\n### 🔌 Connected MCP Servers\nYou have MCP servers available. Use the \`mcp_call\` tool to interact with them. Start by calling \`tools/list\` to discover available tools, then use \`tools/call\` with the appropriate tool name and arguments.\n${enabledMCPServers.map((s: any) => `- **${s.name}**: ${s.url}${s.description ? ` — ${s.description}` : ""}`).join("\n")}`;
    }
    if (agentSkills && (agentSkills as any[]).length > 0) {
      contextSection += `\n\n### 🧠 Active Agent Skills\nFollow these custom instructions provided by the user:\n${(agentSkills as any[]).map((s: any) => `#### ${s.name}${s.description ? ` (${s.description})` : ""}\n${s.instruction}`).join("\n\n")}`;
    }

    const systemPrompt = agentMode
      ? buildSystemPrompt(template) + "\n" + contextSection
      : `You are a helpful AI coding assistant in Code Canvas Complete. This IDE runs code through Wandbox. .replit files do nothing here.\n\nCRITICAL: NEVER suggest the user switch to another IDE (Replit, CodeSandbox, StackBlitz, VS Code, etc.). Code Canvas Complete is fully capable.\n\n${contextSection}`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // === Helper: execute tool calls and return results ===
    async function executeToolCalls(toolCalls: any[], lovableApiKey?: string): Promise<any[]> {
      const results: any[] = [];
      for (const call of toolCalls) {
        const fnName = call?.function?.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* empty */
        }

        let result = "";
        if (fnName === "web_search") {
          const key = lovableApiKey || Deno.env.get("LOVABLE_API_KEY") || "";
          result = args.query ? await executeWebSearch(args.query, key) : "Search failed: query was missing.";
        } else if (fnName === "mcp_call") {
          result = await executeMCPCall(args.server_name || "", args.method || "", args.params, enabledMCPServers);
        } else {
          result = `Unknown tool: ${fnName}`;
        }

        results.push({
          role: "tool",
          tool_call_id: call.id,
          name: fnName,
          content: result,
        });
      }
      return results;
    }

    // === BYOK path: call external provider with tool support ===
    if (userApiKey && selectedProvider) {
      const effectiveByokModel = byokModel || BYOK_DEFAULT_MODELS[selectedProvider] || "gpt-4o";
      console.log(`Using BYOK provider: ${selectedProvider}, model: ${effectiveByokModel}`);
      try {
        // Use non-streaming tool loop, then stream final response
        const conversation: any[] = [...aiMessages];

        for (let i = 0; i < 4; i++) {
          const byokResponse = await callBYOKProvider(
            selectedProvider,
            userApiKey,
            conversation,
            false,
            effectiveByokModel,
            tools.length > 0 ? tools : undefined,
            providerOptions,
          );

          if (!byokResponse.ok) {
            const errText = await byokResponse.text();
            console.error(`BYOK error (${selectedProvider}):`, byokResponse.status, errText);
            return new Response(
              JSON.stringify({
                error: `${selectedProvider} API error (${byokResponse.status}): ${errText.slice(0, 200)}`,
              }),
              { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          let assistantMessage: any;

          if (selectedProvider === "anthropic") {
            // Parse Anthropic response format
            const data = await byokResponse.json();
            const textContent =
              data.content
                ?.filter((b: any) => b.type === "text")
                .map((b: any) => b.text)
                .join("") || "";
            const toolUseBlocks = data.content?.filter((b: any) => b.type === "tool_use") || [];

            if (toolUseBlocks.length === 0) {
              // No tool calls, stream the final response
              const encoder = new TextEncoder();
              const stream = new ReadableStream({
                start(controller) {
                  const chunk = { choices: [{ delta: { content: textContent } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                },
              });
              return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
            }

            // Execute Anthropic tool calls
            conversation.push({ role: "assistant", content: data.content });
            for (const tu of toolUseBlocks) {
              let result = "";
              if (tu.name === "web_search") {
                const key = Deno.env.get("LOVABLE_API_KEY") || "";
                result = tu.input?.query ? await executeWebSearch(tu.input.query, key) : "Search failed.";
              } else if (tu.name === "mcp_call") {
                result = await executeMCPCall(
                  tu.input?.server_name || "",
                  tu.input?.method || "",
                  tu.input?.params,
                  enabledMCPServers,
                );
              }
              conversation.push({
                role: "user",
                content: [{ type: "tool_result", tool_use_id: tu.id, content: result }],
              });
            }
            continue;
          }

          // OpenAI-compatible response
          const data = await byokResponse.json();
          assistantMessage = data?.choices?.[0]?.message;
          if (!assistantMessage) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ choices: [{ delta: { content: "I could not produce a response." } }] })}\n\n`,
                  ),
                );
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
          }

          const toolCallsInResponse = assistantMessage.tool_calls || [];
          conversation.push(assistantMessage);

          if (toolCallsInResponse.length === 0) {
            // No tool calls - stream the final content
            const finalContent = assistantMessage.content || "";
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                const chunk = { choices: [{ delta: { content: finalContent } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
          }

          // Execute tool calls
          const toolResults = await executeToolCalls(toolCallsInResponse);
          conversation.push(...toolResults);
        }

        // Fallback if loop exhausted
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: "Tool call loop exhausted. Please try again." } }] })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
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
          tools,
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

      const toolCallsInResponse = assistantMessage.tool_calls || [];
      conversation.push(assistantMessage);

      if (toolCallsInResponse.length === 0) {
        finalAssistantContent = assistantMessage.content || "";
        break;
      }

      const toolResults = await executeToolCalls(toolCallsInResponse, LOVABLE_API_KEY);
      conversation.push(...toolResults);
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
