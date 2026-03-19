import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, language = 'typescript', filePath } = await req.json();
    if (!symbol) {
      return new Response(JSON.stringify({ error: 'symbol is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      symbol,
      language,
      filePath,
      explanation: `${symbol} is treated as a ${language} symbol. This function can call an LLM provider to generate hover explanations, complexity notes, and suggested follow-up prompts.`,
      suggestedPrompts: [
        `Trace every caller of ${symbol}`,
        `Generate unit tests for ${symbol}`,
        `List edge cases for ${symbol}`,
      ],
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
