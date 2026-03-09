import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl API key not set in environment. Please connect Firecrawl.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://ai-skills.io/',
        formats: ['markdown'],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error || 'Failed to scrape' }), { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const markdown = data.data?.markdown || data.markdown || '';
    
    // Parse the markdown
    const skills = [];
    
    // Simple fallback data if scraping fails or returns empty
    const fallbackSkills = [
      { name: "Python Expert", description: "Expert at writing, debugging, and explaining Python code.", category: "Programming", instruction: "Act as an expert Python developer. Always use best practices, type hints, and write modular code." },
      { name: "React Developer", description: "Specialist in React, hooks, and modern frontend architecture.", category: "Web", instruction: "Act as a Senior React Developer. Write clean, accessible, and performant functional components using hooks." },
      { name: "UX Designer", description: "Helps design intuitive and beautiful user interfaces.", category: "Design", instruction: "Act as a UX/UI Designer. Provide advice on layout, typography, accessibility, and color theory." },
      { name: "Technical Writer", description: "Creates clear and concise technical documentation.", category: "Writing", instruction: "Act as a Technical Writer. Write clear, concise, and easy-to-understand documentation with well-structured Markdown." },
      { name: "Data Scientist", description: "Analyzes data and provides insights using pandas and SQL.", category: "Data", instruction: "Act as a Data Scientist. Provide code and explanations for data cleaning, analysis, and visualization." }
    ];

    // Attempt to extract from markdown (assuming some generic list structure)
    // We look for patterns like `### [Name](link)` or `**Name**` followed by description
    const lines = markdown.split('\n');
    let currentSkill = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for a heading that might be a skill
      const headingMatch = line.match(/^###\s+(?:\[(.*?)\]\(.*?\)|\*\*(.*?)\*\*|(.*))/);
      if (headingMatch) {
        if (currentSkill && currentSkill.name && currentSkill.description) {
          skills.push(currentSkill);
        }
        const name = headingMatch[1] || headingMatch[2] || headingMatch[3];
        currentSkill = { name: name.trim(), description: '', category: 'Community Skill' };
        continue;
      }
      
      if (currentSkill && line.length > 0 && !line.startsWith('#') && !line.startsWith('![')) {
        if (!currentSkill.description) {
           currentSkill.description = line;
        } else if (currentSkill.description.length < 200) {
           currentSkill.description += ' ' + line;
        }
      }
    }
    if (currentSkill && currentSkill.name && currentSkill.description) {
      skills.push(currentSkill);
    }

    // If we couldn't parse anything meaningful, use fallbacks
    const finalSkills = skills.length > 3 ? skills : fallbackSkills;

    return new Response(JSON.stringify({ skills: finalSkills }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
