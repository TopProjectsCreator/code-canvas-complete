import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Globe, Star, GitFork, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PublicProject {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  stars_count: number | null;
  forked_from: string | null;
  updated_at: string;
}

export const PublicCanvasSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [featured, setFeatured] = useState<PublicProject[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load featured projects on mount
  useEffect(() => {
    const loadFeatured = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, description, language, stars_count, forked_from, updated_at')
        .eq('is_public', true)
        .order('stars_count', { ascending: false })
        .limit(5);
      if (data) setFeatured(data);
    };
    loadFeatured();
  }, []);

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('projects')
        .select('id, name, description, language, stars_count, forked_from, updated_at')
        .eq('is_public', true)
        .ilike('name', `%${query}%`)
        .order('stars_count', { ascending: false })
        .limit(10);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayItems = query.trim() ? results : featured;

  const openProject = (id: string) => {
    setOpen(false);
    navigate(`/project/${id}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className={cn(
        "flex items-center gap-2 px-4 h-12 rounded-xl border bg-card/80 backdrop-blur-sm transition-all",
        open ? "border-primary/40 ring-2 ring-primary/10" : "border-border"
      )}>
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search public canvases..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {query && (
          <button onClick={() => { setQuery(''); }} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-xl shadow-black/20 z-50 overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
            {query.trim() ? `Results for "${query}"` : 'Popular Canvases'}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {displayItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {loading ? 'Searching...' : query.trim() ? 'No canvases found' : 'No public canvases yet'}
              </div>
            ) : (
              displayItems.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {p.forked_from && <GitFork className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {p.language && <span className="capitalize">{p.language}</span>}
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  {(p.stars_count ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-warning shrink-0">
                      <Star className="w-3 h-3 fill-current" />
                      {p.stars_count}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
