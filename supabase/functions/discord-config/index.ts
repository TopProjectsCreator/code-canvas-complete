const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const clientId = Deno.env.get("DISCORD_CLIENT_ID") ?? null;
  return new Response(JSON.stringify({ clientId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
