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
    const { fileName = 'module.ts', exportedSymbols = [] } = await req.json();
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const targetSymbols = Array.isArray(exportedSymbols) && exportedSymbols.length > 0 ? exportedSymbols : ['subject'];
    const testFileName = `${baseName}.generated.test.ts`;
    const imports = targetSymbols.join(', ');
    const body = `import { describe, expect, it } from 'vitest';\nimport { ${imports} } from './${baseName}';\n\n${targetSymbols.map((symbol: string) => `describe('${symbol}', () => {\n  it('handles the happy path', () => {\n    expect(${symbol}).toBeDefined();\n  });\n});`).join('\n\n')}\n`;

    return new Response(JSON.stringify({ fileName: testFileName, content: body }), {
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
