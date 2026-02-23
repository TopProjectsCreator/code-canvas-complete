import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Body already parsed above

    let url: string;
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Lovable-IDE",
    };

    // Use user-provided GitHub token from request, or fall back to env
    const body = await req.json();
    const { action, owner, repo, branch, path, query, userToken } = body;
    const token = userToken || Deno.env.get("GITHUB_TOKEN");
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }

    switch (action) {
      case "repo-info":
        url = `https://api.github.com/repos/${owner}/${repo}`;
        break;
      case "tree":
        url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        break;
      case "file-content": {
        // Use raw.githubusercontent.com for file content (no rate limit)
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        const rawResp = await fetch(rawUrl, { headers: { "User-Agent": "Lovable-IDE" } });
        if (!rawResp.ok) {
          // Fallback to contents API
          const encodedPath = path.split('/').map((s: string) => encodeURIComponent(s)).join('/');
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`;
          headers["Accept"] = "application/vnd.github.v3.raw";
          const apiResp = await fetch(apiUrl, { headers });
          if (!apiResp.ok) {
            return new Response(JSON.stringify({ error: `Failed to fetch ${path}: ${apiResp.status}` }), {
              status: apiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const text = await apiResp.text();
          return new Response(JSON.stringify({ content: text }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const text = await rawResp.text();
        return new Response(JSON.stringify({ content: text }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "search":
        url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10&sort=stars`;
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const resp = await fetch(url, { headers });
    
    // Handle rate limiting with retry
    if (resp.status === 403) {
      const body = await resp.json();
      if (body.message?.includes("rate limit")) {
        return new Response(JSON.stringify({ error: "GitHub API rate limit exceeded. Try again later or add a GITHUB_TOKEN secret for higher limits." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GitHub proxy error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
