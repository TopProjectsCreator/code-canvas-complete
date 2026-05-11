import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedServer {
  name: string;
  slug: string;
  description: string;
  category: string;
  installs: number;
  url: string;
}

interface ParsedCategory {
  slug: string;
  label: string;
  description: string;
  count: number;
}

const slugToLabel = (slug: string) =>
  slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

// Parse server cards from mcpmarket.com markdown listings.
// Cards look like: [**Name**\\ \\ Description\\ \\ Category\\ \\ 1234](https://mcpmarket.com/server/<slug>)
function parseServers(markdown: string): ParsedServer[] {
  const servers: ParsedServer[] = [];
  const seen = new Set<string>();
  // Cards may include rank prefix like "#1\\\n\\\n" before the bolded name.
  const re =
    /\[(?:[^\]]*?)\*\*([^*\n]+)\*\*([\s\S]*?)\]\((https:\/\/mcpmarket\.com\/server\/[a-z0-9-]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const name = m[1].trim();
    const url = m[3];
    const slug = url.split("/server/")[1] || "";
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const inner = m[2].replace(/\\\\/g, "").replace(/\\/g, "");
    const lines = inner
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let description = "";
    let category = "";
    let installs = 0;
    for (const line of lines) {
      if (/^[\d,]+$/.test(line)) {
        installs = parseInt(line.replace(/,/g, ""), 10) || 0;
      } else if (line.length > description.length && line.length > 12) {
        if (description) category = description; // previous longest becomes category candidate
        description = line;
      } else if (!category && line !== "Sponsored" && line.length < 60) {
        category = line;
      }
    }
    // Heuristic: if description ended up shorter than category, swap.
    if (category && category.length > description.length) {
      const tmp = description;
      description = category;
      category = tmp;
    }
    if (category === "Sponsored") category = "";

    servers.push({
      name,
      slug,
      description: description.slice(0, 300),
      category,
      installs,
      url,
    });
  }
  return servers;
}

function parseCategories(markdown: string): ParsedCategory[] {
  const cats: ParsedCategory[] = [];
  const seen = new Set<string>();
  const re =
    /\[([^\]]+)\]\(https:\/\/mcpmarket\.com\/categories\/([a-z0-9-]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const slug = m[2];
    if (slug === "official" || slug === "featured") continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    cats.push({ slug, label: m[1].trim() || slugToLabel(slug), description: "", count: 0 });
  }
  return cats;
}

async function directFetchMarkdown(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CodeCanvas-MCP-Browser/1.0; +https://codecanvas.dev)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Convert to a markdown-ish representation by stripping tags but preserving anchor href + text
    // Simple converter: replace <a href="...">text</a> with [text](href), then strip tags.
    const md = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(
        /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        (_, href, text) => `[${text.replace(/<[^>]+>/g, "").trim()}](${href})`,
      )
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
      .replace(/<br\s*\/?>(\n)?/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"');
    return md;
  } catch {
    return null;
  }
}

async function firecrawlFetchMarkdown(url: string): Promise<string | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], waitFor: 2500 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.markdown || data?.markdown || null;
  } catch {
    return null;
  }
}

async function fetchMarkdown(url: string): Promise<string | null> {
  // Hybrid: try direct fetch (free) first, fallback to Firecrawl if it doesn't look fully rendered.
  const direct = await directFetchMarkdown(url);
  const directServerCount = direct ? (direct.match(/mcpmarket\.com\/server\//g) || []).length : 0;
  if (direct && direct.length > 6000 && directServerCount >= 5) {
    return direct;
  }
  const fc = await firecrawlFetchMarkdown(url);
  return fc || direct;
}

async function firecrawlSearch(query: string): Promise<ParsedServer[]> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `site:mcpmarket.com/server ${query}`,
        limit: 20,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results = data?.data || [];
    const out: ParsedServer[] = [];
    for (const r of results) {
      const url: string = r.url || "";
      if (!/mcpmarket\.com\/server\//.test(url)) continue;
      const slug = url.split("/server/")[1]?.split(/[/?#]/)[0] || "";
      if (!slug) continue;
      const name = (r.title || slugToLabel(slug)).replace(/\s*[-|]\s*MCP Market.*$/i, "").trim();
      const description = (r.description || "").slice(0, 300);
      out.push({ name, slug, description, category: "Search Result", installs: 0, url });
    }
    return out;
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let mode = "categories";
    let category = "";
    let search = "";
    try {
      const body = await req.json();
      mode = body?.mode || "categories";
      category = body?.category || "";
      search = body?.search || "";
    } catch { /* no body */ }

    if (mode === "categories") {
      const md = await fetchMarkdown("https://mcpmarket.com/");
      if (!md) {
        return new Response(JSON.stringify({ error: "Failed to load mcpmarket.com" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const categories = parseCategories(md);
      return new Response(JSON.stringify({ categories }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "top" || mode === "official" || mode === "featured") {
      const path =
        mode === "top"
          ? "https://mcpmarket.com/leaderboards"
          : `https://mcpmarket.com/categories/${mode}`;
      const md = await fetchMarkdown(path);
      const servers = md ? parseServers(md) : [];
      console.log(`[${mode}] md len=${md?.length || 0} servers=${servers.length}`);
      return new Response(JSON.stringify({ servers, _debug: { mdLen: md?.length || 0, sample: md?.slice(0, 500) } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "category" && category) {
      const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const md = await fetchMarkdown(`https://mcpmarket.com/categories/${slug}`);
      const servers = md ? parseServers(md) : [];
      return new Response(JSON.stringify({ servers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "search" && search.trim()) {
      // Try the homepage scrape filtered locally first (cheap), then Firecrawl search.
      const results = await firecrawlSearch(search.trim());
      return new Response(JSON.stringify({ servers: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ servers: [], categories: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("fetch-mcp-servers error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
