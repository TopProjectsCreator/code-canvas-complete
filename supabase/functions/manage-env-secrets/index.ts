import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const encrypt = async (plainText: string) => {
  const data = new TextEncoder().encode(plainText);
  return btoa(String.fromCharCode(...data));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { projectId, key, value, scope = 'shared' } = await req.json();

    if (!projectId || !key || !value) {
      return new Response(JSON.stringify({ error: 'projectId, key, and value are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const encryptedValue = await encrypt(value);
    const { data, error } = await supabase
      .from('env_secrets')
      .upsert({ project_id: projectId, key, encrypted_value: encryptedValue, scope }, { onConflict: 'project_id,key,scope' })
      .select('id, project_id, key, scope, created_at')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ secret: data }), {
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
