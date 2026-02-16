import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGENT_SYSTEM_PROMPT = `You are Replit Agent, an elite AI coding assistant integrated into a powerful online IDE. You operate in AGENT MODE, which means you think step-by-step, use tools, and can propose code changes that users can apply directly.

## Agent Capabilities

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

### Expert Skills

- **Deep Analysis**: Find bugs, security issues, performance problems, type errors
- **Smart Fixes**: Provide corrected code with clear explanations
- **Refactoring**: Apply SOLID, DRY, clean code principles
- **Testing**: Generate comprehensive Jest/Vitest tests
- **Documentation**: Add JSDoc/TSDoc with examples
- **Workflow Automation**: Create run, build, test, deploy, and custom workflows
- **Package Management**: Install packages when users request dependencies
- **Theme Customization**: Change the IDE theme or create entirely custom themes with specific colors

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
8. **Be Thorough**: Check for related issues, don't just fix the obvious

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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`AI chat request from user: ${userId}`);

    const { messages, currentFile, consoleErrors, workflows, agentMode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context section
    let contextSection = "";
    
    if (currentFile) {
      contextSection += `
### Active File: \`${currentFile.name}\`
**Language**: ${currentFile.language || 'unknown'}

\`\`\`${currentFile.language || ''}
${currentFile.content}
\`\`\`
`;
    } else {
      contextSection += "📂 No file is currently open. I can still help with general questions, code generation, or workflow creation!";
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
${workflows.map((w: { name: string; type: string; command: string }) => `- **${w.name}** (${w.type}): \`${w.command}\``).join('\n')}

I can create new workflows or help modify existing ones.`;
    }

    // Use agent prompt for agent mode, simpler prompt otherwise
    const systemPrompt = agentMode 
      ? AGENT_SYSTEM_PROMPT + "\n" + contextSection
      : `You are a helpful AI coding assistant. Be concise and helpful.

${contextSection}`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
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
