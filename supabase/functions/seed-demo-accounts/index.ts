import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const demoAccounts = [
      { email: "demo1@demos.com", password: "Demo1!", displayName: "Demo1" },
      { email: "demo2@demos.com", password: "Demo2!", displayName: "Demo2" },
      { email: "demo3@demos.com", password: "Demo3!", displayName: "Demo3" },
      { email: "demo4@demos.com", password: "Demo4!", displayName: "Demo4" },
      { email: "demo5@demos.com", password: "Demo5!", displayName: "Demo5" },
      { email: "demo6@demos.com", password: "Demo6!", displayName: "Demo6" },
      { email: "demo7@demos.com", password: "Demo7!", displayName: "Demo7" },
      { email: "demo8@demos.com", password: "Demo8!", displayName: "Demo8" },
    ];

    const results = [];

    for (const account of demoAccounts) {
      // Check if user already exists by trying to get them
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === account.email);
      
      if (existingUser) {
        results.push({ email: account.email, status: "already exists" });
        continue;
      }

      // Create the user
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true, // Auto-confirm email for demo accounts
        user_metadata: {
          display_name: account.displayName,
        },
      });

      if (userError) {
        results.push({ email: account.email, status: "error", error: userError.message });
      } else {
        results.push({ email: account.email, status: "created", userId: userData.user?.id });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Demo accounts processed",
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating demo accounts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
