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

All color values must be hex codes. Use this when users want a custom/unique theme that doesn't match any built-in option. Be creative with color choices based on the user's description (e.g. "ocean theme", "sunset theme", "cyberpunk theme").

7. **Image Generation** - Generate images using AI:
<generate_image prompt="A detailed description of the image to generate" />

Use this when users ask you to generate, create, or draw an image. Be descriptive in the prompt for best results.

8. **Music Generation** - Generate music using Lyria RealTime:
<generate_music prompt="Minimal techno with deep bass" />
<generate_music prompt="Chill lo-fi hip hop beats" bpm="85" duration="20" />

Use this when users ask you to generate, create, or compose music. Be descriptive about genre, mood, and instruments. Optional: bpm (60-200), duration in seconds (5-30).

8. **Git Operations** - Manage version control:

Initialize a git repository:
<git_init />

Commit changes with a message:
<git_commit message="Your commit message here" />

Create a new branch:
<git_create_branch name="feature-branch-name" />

Import a repository from a Git provider (GitHub, GitLab, Bitbucket):
<git_import url="https://github.com/user/repo" />

9. **Project Sharing & Visibility** - Manage project visibility and share on social media:

Make project public (anyone can view/fork):
<make_public />

Make project private (only owner can access):
<make_private />

Show the project's shareable link:
<get_project_link />

Share the project on Twitter:
<share_twitter />

Share the project on LinkedIn:
<share_linkedin />

Share the project via email:
<share_email />

Fork the current project (creates a copy):
<fork_project />

Star/unstar the current project:
<star_project />

View project history (for browsing and rolling back changes):
<view_history />

10. **User Interaction & Project Control** - Prompt users, save, or run:

Ask the user a question (prompts a toast notification with the question):
<ask_user question="What would you like to name this file?" />

Save the current project (opens the save dialog):
<save_project />

Run the current project (executes the main file):
<run_project />

### Expert Skills

- **Web Search**: Search the web for current information, documentation, tutorials, and more
- **Deep Analysis**: Find bugs, security issues, performance problems, type errors
- **Smart Fixes**: Provide corrected code with clear explanations
- **Refactoring**: Apply SOLID, DRY, clean code principles
- **Testing**: Generate comprehensive Jest/Vitest tests
- **Documentation**: Add JSDoc/TSDoc with examples
- **Workflow Automation**: Create run, build, test, deploy, and custom workflows
- **Package Management**: Install packages when users request dependencies
- **Theme Customization**: Change the IDE theme or create entirely custom themes with specific colors
- **Image Generation**: Generate images from text descriptions using AI
- **Git Operations**: Initialize repos, commit changes, create branches, and import repositories from GitHub/GitLab/Bitbucket
- **Project Sharing**: Make projects public/private, get shareable links, share on Twitter/LinkedIn/Email
- **Project Management**: Fork projects, star/unstar, view history and rollback changes
- **User Interaction**: Ask questions to gather user input, save projects, and run code with one click

### Workflow Guidelines

When users ask to create workflows, use the <workflow> block:
- **run**: For running the application (e.g., npm start, python main.py)
- **build**: For building the application (e.g., npm run build, cargo build)
- **test**: For running tests (e.g., npm test, pytest)
- **deploy**: For deployment tasks
- **custom**: For any other automation

Examples:
<workflow name="Start Server" type="run" command="npm run dev" trigger="manual">
Starts the development server with hot reload
</workflow>

<workflow name="Run Tests" type="test" command="npm test -- --coverage" trigger="on-save">
Runs test suite with coverage report automatically when files are saved
</workflow>

### Package Installation Guidelines

When users ask to install a package or add a dependency, use the <install_package> block:
<install_package name="lodash" />

You can install multiple packages by using multiple blocks:
<install_package name="axios" />
<install_package name="lodash" />

### Theme Change Guidelines

When users ask to change the theme, switch colors, or customize appearance, use the <set_theme> block for built-in themes:
<set_theme theme="dracula" />

When users ask for a custom/unique theme (e.g. "make me an ocean theme", "I want a sunset theme"), create one with <create_custom_theme>:
<create_custom_theme name="Ocean Depths" background="#0a1628" foreground="#b8d4e3" primary="#2196f3" card="#0d1f3c" border="#1a3355" terminalBg="#071220" terminalText="#4fc3f7" syntaxKeyword="#64b5f6" syntaxString="#4dd0e1" syntaxFunction="#80deea" syntaxComment="#37596e" />

### Response Guidelines

1. **Think First**: Always start with a <thinking> block for complex requests
2. **Be Actionable**: Every issue should have a proposed fix
3. **Use Code Blocks**: All code in proper \`\`\`language blocks
4. **Show Changes**: Use <code_change> for modifications users can apply
5. **Create Workflows**: Use <workflow> when users want to automate tasks
6. **Install Packages**: Use <install_package> when users need dependencies
7. **Change Themes**: Use <set_theme> for built-in themes or <create_custom_theme> for custom themes
8. **Generate Images**: Use <generate_image> when users want to create images
9. **Git Operations**: Use <git_init>, <git_commit>, <git_create_branch>, <git_import> for version control tasks
10. **Project Sharing**: Use <make_public>, <make_private>, <get_project_link>, <share_twitter>, <share_linkedin>, <share_email> for sharing
11. **Project Management**: Use <fork_project>, <star_project>, <view_history> for forking, starring, and browsing/rolling back history
12. **Search the Web**: When users ask about current events, need up-to-date docs, or ask questions you're unsure about, use the web_search tool
13. **Be Thorough**: Check for related issues, don't just fix the obvious
14. **Never suggest .replit or nix files**: They don't work in this environment

### IDE limitations

This IDE runs code through Wandbox, a remote sandbox. Key limitations:
- No real filesystem access — files exist only in the browser
- External packages (pip install, npm install) don't work at runtime
- document/window objects are undefined when running JS through Wandbox (use the Preview for HTML/CSS/JS)
- .replit and .nix files are completely ignored
- Some shell commands may not work as expected

### Example Response Pattern

<thinking>
Let me analyze this code step by step:
1. First, I'll check the function signature...
2. Looking for potential issues...
3. Found: [issues list]
</thinking>

I found **3 issues** in your code:

### 1. Missing null check (line 5)
The \`user\` object could be undefined, causing a runtime error.

<code_change file="UserProfile.tsx" lang="tsx" desc="Add null check for user object">
const UserProfile = ({ user }: Props) => {
  if (!user) return <LoadingSpinner />;
  return <div>{user.name}</div>;
};
</code_change>

### 2. Memory leak in useEffect
[Continue with more issues and fixes...]

## Current Context`;

const WEB_SEARCH_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information, documentation, tutorials, code examples, or any topic the user asks about. Use this when you need up-to-date information or are unsure about something.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up on the web",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

async function executeWebSearch(query: string, apiKey: string): Promise<string> {
  try {
    const searchResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a web search engine assistant. When given a search query, provide comprehensive, factual, and up-to-date information about the topic. Include:
- Key facts and explanations
- Relevant code examples if it's a programming topic
- Links to official documentation if you know them
- Current best practices
- Any recent changes or updates you're aware of
Be thorough but concise. Format your response clearly with headers and bullet points.`,
          },
          {
            role: "user",
            content: `Search query: "${query}"\n\nProvide comprehensive search results for this query.`,
          },
        ],
      }),
    });

    if (!searchResp.ok) {
      console.error("Web search error:", searchResp.status);
      return `Search for "${query}" failed. Please try rephrasing your question.`;
    }

    const searchData = await searchResp.json();
    return searchData.choices?.[0]?.message?.content || "No results found.";
  } catch (err) {
    console.error("Web search execution error:", err);
    return `Search for "${query}" encountered an error.`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required. Please sign in to use the AI assistant." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired session. Please sign in again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    console.log(`AI chat request from user: ${userId}`);

    const { messages, currentFile, consoleErrors, workflows, agentMode, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context section
    let contextSection = "";

    if (currentFile) {
      contextSection += `
### Active File: \`${currentFile.name}\`
**Language**: ${currentFile.language || "unknown"}

\`\`\`${currentFile.language || ""}
${currentFile.content}
\`\`\`
`;
    } else {
      contextSection +=
        "📂 No file is currently open. I can still help with general questions, code generation, or workflow creation!";
    }

    if (consoleErrors) {
      contextSection += `

### 🔴 Console Errors Detected
\`\`\`
${consoleErrors}
\`\`\`
I'll factor these errors into my analysis.`;
    }

    if (workflows && workflows.length > 0) {
      contextSection += `

### 🔧 Existing Workflows
${workflows.map((w: { name: string; type: string; command: string }) => `- **${w.name}** (${w.type}): \`${w.command}\``).join("\n")}

I can create new workflows or help modify existing ones.`;
    }

    // Use agent prompt for agent mode, simpler prompt otherwise
    const systemPrompt = agentMode
      ? AGENT_SYSTEM_PROMPT + "\n" + contextSection
      : `You are a helpful AI coding assistant in a Replit-like IDE (but NOT actual Replit). This IDE runs code through Wandbox. .replit files do nothing here. Be concise and helpful.

${contextSection}`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // Map model selection to actual model IDs
    const MODEL_MAP: Record<string, string> = {
      pro: "google/gemini-3-pro-preview",
      flash: "google/gemini-3-flash-preview",
      lite: "google/gemini-2.5-flash-lite",
    };
    const selectedModel = MODEL_MAP[model] || MODEL_MAP.flash;
    console.log(`Using model: ${selectedModel}`);

    // === Two-pass approach: First check if web search is needed ===
    const toolCheckResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: aiMessages,
        tools: WEB_SEARCH_TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!toolCheckResponse.ok) {
      if (toolCheckResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (toolCheckResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await toolCheckResponse.text();
      console.error("AI gateway error (tool check):", toolCheckResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toolCheckData = await toolCheckResponse.json();
    const assistantMessage = toolCheckData.choices?.[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // Execute web searches in parallel
      console.log(`Executing ${toolCalls.length} web search(es)`);
      const searchResults = await Promise.all(
        toolCalls.map(async (tc: { id: string; function: { arguments: string } }) => {
          const args = JSON.parse(tc.function.arguments);
          const result = await executeWebSearch(args.query, LOVABLE_API_KEY);
          return { id: tc.id, result };
        })
      );

      // Build messages with tool results for final streaming response
      const finalMessages = [
        ...aiMessages,
        assistantMessage,
        ...searchResults.map((sr) => ({
          role: "tool",
          tool_call_id: sr.id,
          content: sr.result,
        })),
      ];

      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: finalMessages,
          stream: true,
        }),
      });

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error("AI gateway error (final):", finalResponse.status, errorText);
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — the first response already has the answer
    // Re-stream it since we consumed the non-streaming response
    const directResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!directResponse.ok) {
      const errorText = await directResponse.text();
      console.error("AI gateway error (direct):", directResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(directResponse.body, {
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
