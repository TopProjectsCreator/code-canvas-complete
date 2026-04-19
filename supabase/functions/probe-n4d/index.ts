import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const results: any = {};
  for (let i = 0; i < 3; i++) {
    try {
      const t0 = Date.now();
      const r = await fetch("https://alb.neural4d.com:3000/api/generateModelWithText", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test" },
        body: JSON.stringify({ prompt: "apple", modelCount: 1, disablePbr: 0 }),
        signal: AbortSignal.timeout(15000),
      });
      results[`attempt_${i}`] = { ms: Date.now() - t0, status: r.status, body: (await r.text()).slice(0, 200) };
    } catch (e) {
      results[`attempt_${i}`] = { error: (e as Error).message };
    }
  }
  return new Response(JSON.stringify(results, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
