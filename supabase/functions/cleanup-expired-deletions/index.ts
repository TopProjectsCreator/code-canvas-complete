import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: expiredProfiles, error: queryError } = await adminClient
      .from("profiles")
      .select("user_id, id")
      .lt("deletion_scheduled_at", new Date().toISOString())
      .not("deletion_scheduled_at", "is", null);

    if (queryError) {
      return new Response(
        JSON.stringify({ error: queryError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const results: { userId: string; status: string; error?: string }[] = [];

    for (const profile of expiredProfiles || []) {
      try {
        // Clean up avatar files from storage
        const { data: avatarFiles } = await adminClient.storage
          .from("avatars")
          .list(profile.user_id);

        if (avatarFiles && avatarFiles.length > 0) {
          const paths = avatarFiles.map(
            (f: { name: string }) => `${profile.user_id}/${f.name}`,
          );
          await adminClient.storage.from("avatars").remove(paths);
        }
      } catch (storageErr) {
        // Non-fatal — continue to delete the user even if storage cleanup fails
        results.push({
          userId: profile.user_id,
          status: "storage_cleanup_failed",
          error: String(storageErr),
        });
      }

      try {
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(
          profile.user_id,
        );

        if (deleteError) {
          results.push({
            userId: profile.user_id,
            status: "failed",
            error: deleteError.message,
          });
        } else {
          results.push({ userId: profile.user_id, status: "deleted" });
        }
      } catch (deleteErr) {
        results.push({
          userId: profile.user_id,
          status: "failed",
          error: String(deleteErr),
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
