import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const targets = [
    "https://alb.neural4d.com:3000/api/generateModelWithText",
    "https://alb.neural4d.com/api/generateModelWithText",
    "https://api.neural4d.com/api/generateModelWithText",
    "https://www.neural4d.com/api/generateModelWithText",
  ];
  const out: Record<string, string> = {};
  for (const u of targets) {
    try {
      const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) });
      const t = await r.text();
      out[u] = `${r.status}: ${t.slice(0, 200)}`;
    } catch (e) {
      out[u] = `ERR: ${(e as Error).message}`;
    }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
