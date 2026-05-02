import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Loader2, Sparkles, AlertCircle, ArrowLeft, Star, Grid3X3, Trophy, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMCPAndSkills } from '@/hooks/useMCPAndSkills';
import { detectDeploymentPlatform } from '@/lib/platform';

interface SkillsLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExternalSkill {
  name: string;
  fullName?: string;
  description: string;
  category: string;
  stars?: number;
  author?: string;
  url?: string;
  instruction?: string | null;
}

interface CategoryInfo {
  slug: string;
  label: string;
  description: string;
  count: number;
}

type ViewMode = 'categories' | 'category' | 'search' | 'top';

async function fetchLibrary(params: Record<string, string>): Promise<{ categories?: CategoryInfo[]; skills?: ExternalSkill[] }> {
  const platform = detectDeploymentPlatform();
  if (platform === 'replit') {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/replit/ai/skills/library?${qs}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }
  const { data, error: fnError } = await supabase.functions.invoke('fetch-ai-skills', { body: params });
  if (fnError) throw new Error(fnError.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export function SkillsLibraryDialog({ open, onOpenChange }: SkillsLibraryDialogProps) {
  const [skills, setSkills] = useState<ExternalSkill[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('categories');
  const [activeCategory, setActiveCategory] = useState('');
  const [addedSkills, setAddedSkills] = useState<Set<string>>(new Set());

  const { addSkill } = useMCPAndSkills();
  const { toast } = useToast();

  const isReplit = detectDeploymentPlatform() === 'replit';

  useEffect(() => {
    if (open) {
      setView('categories');
      setSkills([]);
      setSearch('');
      setError(null);
      setAddedSkills(new Set());
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLibrary({ mode: 'categories' });
      setCategories(data?.categories || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategorySkills = async (slug: string) => {
    setView('category');
    setActiveCategory(slug);
    setLoading(true);
    setError(null);
    setSkills([]);
    try {
      const data = await fetchLibrary({ mode: 'category', category: slug });
      setSkills(data?.skills || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  const fetchTopStarred = async () => {
    setView('top');
    setLoading(true);
    setError(null);
    setSkills([]);
    try {
      const data = await fetchLibrary({ mode: 'top' });
      setSkills(data?.skills || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load top skills');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return;
    setView('search');
    setLoading(true);
    setError(null);
    setSkills([]);
    try {
      const data = await fetchLibrary({ mode: 'search', search: search.trim() });
      setSkills(data?.skills || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const handleAdd = async (skill: ExternalSkill) => {
    let instruction = skill.instruction || null;

    // On Replit: try to fetch the actual skill content from officialskills.sh
    if (!instruction && isReplit && skill.url) {
      try {
        const res = await fetch(`/api/replit/ai/skills/fetch-content?url=${encodeURIComponent(skill.url)}&description=${encodeURIComponent(skill.description)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.content) instruction = data.content;
        }
      } catch { /* fall through */ }
    }

    // Final fallback: generate a sensible instruction from description
    if (!instruction) {
      instruction = `You are an expert in ${skill.fullName || skill.name}.\n\n${skill.description}\n\nApply your expertise to help the user with any questions or tasks related to this domain.`;
    }

    const ok = await addSkill({
      name: skill.fullName || skill.name,
      description: skill.description,
      instruction,
      icon: 'sparkles',
    });
    if (ok) {
      setAddedSkills(prev => new Set(prev).add(skill.name));
      toast({ title: 'Skill Added', description: `${skill.fullName || skill.name} has been added to your agent.` });
    }
  };

  const goBack = () => {
    setView('categories');
    setSkills([]);
    setError(null);
  };

  const showBackButton = view !== 'categories';
  const title = view === 'categories' ? 'Skills Library'
    : view === 'top' ? 'Top Skills'
    : view === 'search' ? `Search: "${search}"`
    : activeCategory.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const sourceLabel = isReplit
    ? 'VoltAgent/awesome-agent-skills on GitHub'
    : 'ai-skills.io powered by Firecrawl';
  const loadingLabel = isReplit
    ? 'Fetching from VoltAgent/awesome-agent-skills…'
    : 'Fetching from ai-skills.io via Firecrawl…';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            {showBackButton && (
              <button onClick={goBack} className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Sparkles className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Browse real-world agent skills from{' '}
            <a
              href={isReplit ? 'https://github.com/VoltAgent/awesome-agent-skills' : 'https://ai-skills.io'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {sourceLabel}
            </a>
          </p>
        </DialogHeader>

        {/* Search bar */}
        <div className="p-4 border-b border-border/50 bg-muted/20 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 bg-background"
            />
          </div>
          <Button size="sm" onClick={handleSearch} disabled={!search.trim() || loading} className="gap-1.5">
            <Search className="w-3.5 h-3.5" /> Search
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-sm">{loadingLabel}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive text-center px-6">
              <AlertCircle className="w-10 h-10 mb-4 opacity-80" />
              <p className="font-medium mb-2">Could not load skills</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => view === 'categories' ? fetchCategories() : goBack()} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : view === 'categories' ? (
            <div className="space-y-4">
              {/* Top Starred / Top Skills button */}
              <button
                onClick={fetchTopStarred}
                className="w-full p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium">Top Skills</h4>
                  <p className="text-xs text-muted-foreground">The most popular community agent skills</p>
                </div>
                <Star className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Categories grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => fetchCategorySkills(cat.slug)}
                    className="p-3.5 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium">{cat.label}</h4>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {cat.count.toLocaleString()}
                      </Badge>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{cat.description}</p>
                    )}
                  </button>
                ))}
              </div>

              {categories.length === 0 && !loading && !error && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Grid3X3 className="w-10 h-10 mb-4 opacity-20" />
                  <p className="text-sm">No categories loaded yet</p>
                  <Button variant="outline" size="sm" onClick={fetchCategories} className="mt-3">Reload</Button>
                </div>
              )}
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
              <Sparkles className="w-10 h-10 mb-4 opacity-20" />
              <p className="text-sm">No skills found</p>
              <Button variant="outline" size="sm" onClick={goBack} className="mt-3">Back to Categories</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {skills.map((skill, idx) => {
                const isAdded = addedSkills.has(skill.name);
                return (
                  <div key={idx} className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-medium truncate">{skill.name}</h4>
                        {skill.stars != null && skill.stars > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                            <Star className="w-3 h-3" /> {skill.stars.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {skill.fullName && (
                        <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">{skill.fullName}</p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{skill.category}</Badge>
                        {skill.url && (
                          <a href={skill.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">
                            View on officialskills.sh →
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isAdded ? 'secondary' : 'default'}
                      className="shrink-0 gap-1 h-8 text-xs"
                      onClick={() => handleAdd(skill)}
                      disabled={isAdded}
                    >
                      {isAdded ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> Added</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" /> Add</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
