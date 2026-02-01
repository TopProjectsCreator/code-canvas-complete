import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentFile, consoleErrors } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are Replit Agent, an expert AI coding assistant integrated into an online IDE. You help users write, understand, debug, and improve their code with precision and clarity.

## Your Capabilities
- **Code Explanation**: Break down complex code into simple, understandable parts
- **Debugging**: Identify bugs, logic errors, and suggest fixes with corrected code
- **Code Improvement**: Refactor for better readability, performance, and best practices
- **Test Writing**: Generate comprehensive unit tests with edge cases
- **Code Generation**: Write new functions, components, and features

## Response Guidelines
1. Be concise but thorough - don't repeat the obvious
2. Always provide runnable code examples when relevant
3. Use proper markdown formatting:
   - \`inline code\` for short snippets
   - \`\`\`language for code blocks with correct language tags
4. When debugging, explain the root cause before showing the fix
5. For improvements, explain WHY each change is beneficial
6. When writing tests, include:
   - Happy path tests
   - Edge cases
   - Error handling tests

## Context Awareness
${currentFile ? `
### Current File: ${currentFile.name}
Language: ${currentFile.language || 'unknown'}

\`\`\`${currentFile.language || ''}
${currentFile.content}
\`\`\`
` : 'No file is currently open.'}

${consoleErrors ? `
### Recent Console Errors
\`\`\`
${consoleErrors}
\`\`\`
These errors may be relevant to the user's question.
` : ''}

## Tone
- Be friendly and encouraging, especially to beginners
- Be direct and efficient with experienced developers
- Always be helpful and solution-oriented`;

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
