import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Globe, Star, GitFork, Loader2, X, User, FileCode, Code2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PublicProject {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  stars_count: number | null;
  forked_from: string | null;
  updated_at: string;
}

interface PublicProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  project_count?: number;
}

type SearchTab = 'all' | 'projects' | 'profiles';

export const PublicCanvasSearch = () => {
  const [query, setQuery] = useState('');
  const [projectResults, setProjectResults] = useState<PublicProject[]>([]);
  const [profileResults, setProfileResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SearchTab>('all');
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
      setProjectResults([]);
      setProfileResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);

      const [projectsRes, profilesRes] = await Promise.all([
        // Search projects by name OR description
        supabase
          .from('projects')
          .select('id, name, description, language, stars_count, forked_from, updated_at')
          .eq('is_public', true)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%,language.ilike.%${query}%`)
          .order('stars_count', { ascending: false })
          .limit(10),
        // Search profiles by display_name
        supabase
          .from('profiles')
          .select('id, user_id, display_name, avatar_url')
          .ilike('display_name', `%${query}%`)
          .limit(8),
      ]);

      setProjectResults(projectsRes.data || []);
      setProfileResults(profilesRes.data || []);
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

  const hasQuery = query.trim().length > 0;

  const filteredProjects = hasQuery ? projectResults : featured;
  const filteredProfiles = hasQuery ? profileResults : [];

  const showProjects = tab === 'all' || tab === 'projects';
  const showProfiles = tab === 'all' || tab === 'profiles';

  const totalResults = filteredProjects.length + filteredProfiles.length;

  const openProject = (id: string) => {
    setOpen(false);
    navigate(`/project/${id}`);
  };

  const openProfile = (userId: string) => {
    setOpen(false);
    navigate(`/profile/${userId}`);
  };

  const tabs: { value: SearchTab; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'All', icon: <Search className="w-3 h-3" /> },
    { value: 'projects', label: 'Projects', icon: <Code2 className="w-3 h-3" /> },
    { value: 'profiles', label: 'People', icon: <User className="w-3 h-3" /> },
  ];

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
          placeholder="Search projects, people, code..."
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
          {/* Tabs */}
          {hasQuery && (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    tab === t.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
            {hasQuery ? `${totalResults} results for "${query}"` : 'Popular Canvases'}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* Profile Results */}
            {showProfiles && filteredProfiles.length > 0 && (
              <>
                {tab === 'all' && (
                  <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    People
                  </div>
                )}
                {filteredProfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openProfile(p.user_id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {(p.display_name || '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{p.display_name || 'Anonymous'}</span>
                    </div>
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </>
            )}

            {/* Project Results */}
            {showProjects && filteredProjects.length > 0 && (
              <>
                {tab === 'all' && hasQuery && (
                  <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Projects
                  </div>
                )}
                {filteredProjects.map((p) => (
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
                ))}
              </>
            )}

            {/* Empty state */}
            {((showProjects && filteredProjects.length === 0) && (showProfiles && filteredProfiles.length === 0) && !loading) && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {hasQuery ? 'No results found' : 'No public canvases yet'}
              </div>
            )}
            {loading && totalResults === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">Searching...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
