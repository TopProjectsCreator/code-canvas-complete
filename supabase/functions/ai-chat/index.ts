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

### Expert Skills

- **Deep Analysis**: Find bugs, security issues, performance problems, type errors
- **Smart Fixes**: Provide corrected code with clear explanations
- **Refactoring**: Apply SOLID, DRY, clean code principles
- **Testing**: Generate comprehensive Jest/Vitest tests
- **Documentation**: Add JSDoc/TSDoc with examples

### Response Guidelines

1. **Think First**: Always start with a <thinking> block for complex requests
2. **Be Actionable**: Every issue should have a proposed fix
3. **Use Code Blocks**: All code in proper \`\`\`language blocks
4. **Show Changes**: Use <code_change> for modifications users can apply
5. **Be Thorough**: Check for related issues, don't just fix the obvious

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

    const { messages, currentFile, consoleErrors, agentMode } = await req.json();
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
      contextSection += "📂 No file is currently open.";
    }

    if (consoleErrors) {
      contextSection += `

### 🔴 Console Errors Detected
\`\`\`
${consoleErrors}
\`\`\`
I'll factor these errors into my analysis.`;
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
