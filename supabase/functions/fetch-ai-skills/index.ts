import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CATEGORIES = [
  'frontend-development', 'backend-development', 'general', 'data-science-ai',
  'ai-ml', 'javascript', 'cloud', 'mobile-development', 'testing-qa',
  'devops', 'security', 'database', 'design', 'documentation',
  'python', 'rust', 'go', 'java', 'typescript',
  'infrastructure', 'networking', 'blockchain', 'gaming', 'iot',
];

interface ParsedSkill {
  name: string;
  description: string;
  category: string;
  stars: number;
  author: string;
  url: string;
}

function parseSkillsFromMarkdown(markdown: string, categoryLabel: string): ParsedSkill[] {
  const skills: ParsedSkill[] = [];

  // Pattern: [**skill-name** \n\n stars \n\n description \n\n author \n\n date](url)
  // The markdown has skills as link blocks like:
  // [**name** \\ \\ 12345 \\ \\ description text \\ \\ author \\ \\ date](url)
  const skillBlocks = markdown.split(/\[(?=\*\*[a-z0-9])/i);

  for (const block of skillBlocks) {
    try {
      // Extract name
      const nameMatch = block.match(/\*\*([^*]+)\*\*/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();

      // Extract URL
      const urlMatch = block.match(/\]\((https:\/\/ai-skills\.io\/skill\/[^)]+)\)/);
      const url = urlMatch ? urlMatch[1] : '';

      // Extract star count (a number on its own line)
      const starsMatch = block.match(/\\?\n\\?\n([\d,]+)\\?\n/);
      const stars = starsMatch ? parseInt(starsMatch[1].replace(/,/g, ''), 10) : 0;

      // Extract description - text between stars count and author
      // Clean up the block text
      const cleanBlock = block.replace(/\\\\/g, '').replace(/\\n/g, '\n').replace(/\n+/g, '\n');
      const lines = cleanBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Find description: typically the longest line that's not the name, not a number, not a short author
      let description = '';
      for (const line of lines) {
        if (line.startsWith('**') || line.startsWith('[') || line.startsWith(']')) continue;
        if (/^[\d,]+$/.test(line)) continue;
        if (/^\d{4}-\d{2}-\d{2}/.test(line)) continue;
        if (line.length > description.length && line.length > 10) {
          description = line;
        }
      }

      // Extract author - usually a short word before the date
      let author = '';
      for (const line of lines) {
        if (/^[a-zA-Z0-9_-]{2,30}$/.test(line) && !line.startsWith('**')) {
          author = line;
        }
      }

      if (name && description) {
        skills.push({
          name,
          description: description.slice(0, 300),
          category: categoryLabel,
          stars,
          author,
          url,
        });
      }
    } catch {
      // skip malformed blocks
    }
  }

  return skills;
}

function categorySlugToLabel(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl not configured. Connect Firecrawl in settings.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let search = '';
    let category = '';
    let mode = 'categories'; // 'categories' | 'category' | 'search' | 'top'
    try {
      const body = await req.json();
      search = body?.search || '';
      category = body?.category || '';
      mode = body?.mode || 'categories';
    } catch { /* no body */ }

    // Mode: browse categories (homepage)
    if (mode === 'categories') {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://ai-skills.io/', formats: ['markdown'], waitFor: 3000 }),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.error || 'Firecrawl scrape failed' }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const md = data.data?.markdown || data.markdown || '';
      // Parse categories from the homepage markdown
      const categories: { slug: string; label: string; description: string; count: number }[] = [];
      const catRegex = /\[?\*\*([^*]+)\*\*[^]*?(\d[\d,]*)\s*skills\]\(https:\/\/ai-skills\.io\/category\/([a-z0-9-]+)\)/g;
      let match;
      while ((match = catRegex.exec(md)) !== null) {
        categories.push({
          label: match[1].trim(),
          count: parseInt(match[2].replace(/,/g, ''), 10),
          slug: match[3],
          description: '',
        });
      }
      
      // Fallback: simpler pattern
      if (categories.length === 0) {
        const simpleRegex = /\*\*([^*]+)\*\*[\s\\]*([^\n[]+?)[\s\\]*(\d[\d,]*)\s*skills/g;
        while ((match = simpleRegex.exec(md)) !== null) {
          const label = match[1].trim();
          const desc = match[2].replace(/\\/g, '').trim();
          const count = parseInt(match[3].replace(/,/g, ''), 10);
          const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
          categories.push({ label, description: desc, count, slug });
        }
      }

      return new Response(JSON.stringify({ categories }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mode: top starred
    if (mode === 'top') {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://ai-skills.io/top-starred', formats: ['markdown'], waitFor: 5000 }),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.error || 'Scrape failed' }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const md = data.data?.markdown || data.markdown || '';
      const skills = parseSkillsFromMarkdown(md, 'Top Starred');
      return new Response(JSON.stringify({ skills }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mode: browse a specific category
    if (mode === 'category' && category) {
      const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://ai-skills.io/category/${slug}`, formats: ['markdown'], waitFor: 5000 }),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.error || 'Scrape failed' }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const md = data.data?.markdown || data.markdown || '';
      const skills = parseSkillsFromMarkdown(md, categorySlugToLabel(slug));
      return new Response(JSON.stringify({ skills }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mode: search using Firecrawl search
    if (mode === 'search' && search.trim()) {
      const res = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `site:ai-skills.io ${search}`,
          limit: 20,
          scrapeOptions: { formats: ['markdown'] },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.error || 'Search failed' }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const results = data.data || [];
      const skills: ParsedSkill[] = [];
      for (const result of results) {
        const url = result.url || '';
        // Only include skill detail pages
        if (!url.includes('/skill/')) continue;
        const md = result.markdown || '';
        
        // Parse from skill detail page format
        const nameMatch = md.match(/\|\s*name\s*\|\s*([^|]+)\|/);
        const descMatch = md.match(/\|\s*description\s*\|\s*([^|]+)\|/);
        const authorMatch = md.match(/\|\s*author\s*\|\s*([^|]+)\|/);
        
        const name = nameMatch ? nameMatch[1].trim() : (result.title || '').replace(/ - ai-skills.io.*/, '');
        const description = descMatch ? descMatch[1].trim() : (result.description || '');
        const author = authorMatch ? authorMatch[1].trim() : '';

        if (name && description) {
          skills.push({ name, description: description.slice(0, 300), category: 'Search Result', stars: 0, author, url });
        }
      }
      
      return new Response(JSON.stringify({ skills }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Default: return empty
    return new Response(JSON.stringify({ skills: [], categories: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
