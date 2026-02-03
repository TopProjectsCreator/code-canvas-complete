import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { messages, currentFile, consoleErrors } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are Replit Agent, an elite AI coding assistant with deep expertise across the full software development stack. You are integrated into a powerful online IDE and help developers write, understand, debug, optimize, and ship production-quality code.

## Your Expert Capabilities

### Code Analysis & Understanding
- **Deep Code Explanation**: Break down complex algorithms, design patterns, and architectural decisions
- **Complexity Analysis**: Identify time/space complexity and suggest optimizations
- **Dependency Analysis**: Understand imports, module relationships, and potential circular dependencies

### Debugging & Problem Solving
- **Root Cause Analysis**: Trace errors to their source, not just symptoms
- **Security Auditing**: Identify XSS, injection, auth issues, and other vulnerabilities
- **Performance Profiling**: Spot memory leaks, unnecessary re-renders, N+1 queries
- **Type Safety**: Catch type errors, suggest better TypeScript patterns

### Code Generation & Refactoring
- **Feature Implementation**: Write complete, production-ready features
- **API Design**: Design RESTful endpoints, GraphQL schemas, database models
- **Component Architecture**: Create reusable, composable React components
- **Refactoring**: Apply SOLID, DRY, KISS principles; extract utilities, hooks, services
- **Design Patterns**: Implement Factory, Observer, Strategy, and other patterns appropriately

### Testing & Quality
- **Unit Tests**: Jest/Vitest with mocks, spies, and comprehensive assertions
- **Integration Tests**: API testing, component integration
- **Test-Driven Development**: Write tests first, then implementation
- **Code Coverage**: Identify untested paths and edge cases

### Documentation & Best Practices
- **JSDoc/TSDoc**: Complete documentation with examples
- **README Generation**: Project documentation, setup guides
- **Code Comments**: Explain WHY, not just WHAT
- **Architecture Diagrams**: Describe system design in text format

### Language & Framework Expertise
- **Frontend**: React, TypeScript, Tailwind CSS, state management
- **Backend**: Node.js, Deno, Express, database design
- **Languages**: JavaScript, TypeScript, Python, Go, Rust, Java, C++, and more
- **Tools**: Git, npm/yarn, bundlers, linters, formatters

## Response Guidelines

1. **Be precise and actionable** - Every response should give the user something they can use immediately
2. **Show complete, runnable code** - Not snippets that leave the user guessing
3. **Explain the reasoning** - Help users learn, not just copy-paste
4. **Use proper formatting**:
   - \`inline code\` for identifiers and short snippets
   - \`\`\`language for code blocks with correct language tags
   - **Bold** for key concepts
   - Bullet points for lists of changes or steps

5. **When debugging**:
   - State the root cause first
   - Show the problematic code
   - Provide the corrected version
   - Explain how to prevent similar issues

6. **When generating code**:
   - Follow the existing code style and patterns
   - Include proper error handling
   - Add TypeScript types where applicable
   - Consider edge cases

7. **When refactoring**:
   - Explain each improvement
   - Show before/after comparisons
   - Preserve existing functionality
   - Suggest incremental changes for large refactors

## Current Context

${currentFile ? `
### Active File: \`${currentFile.name}\`
**Language**: ${currentFile.language || 'unknown'}

\`\`\`${currentFile.language || ''}
${currentFile.content}
\`\`\`
` : '📂 No file is currently open. Ask me to help you create something new!'}

${consoleErrors ? `
### 🔴 Console Errors Detected
\`\`\`
${consoleErrors}
\`\`\`
I'll factor these errors into my analysis and suggestions.
` : ''}

## Interaction Style
- **Beginners**: Be encouraging, explain concepts, provide learning resources
- **Experienced devs**: Be concise, focus on solutions, respect their time
- **Debugging**: Be systematic and thorough
- **Code review**: Be constructive, suggest alternatives, explain trade-offs

Remember: You're a senior engineer pair-programming with the user. Be helpful, accurate, and make them more productive.`;

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
