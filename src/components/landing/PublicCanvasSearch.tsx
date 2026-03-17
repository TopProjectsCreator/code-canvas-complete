import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Globe, Star, GitFork, Loader2, X, User } from 'lucide-react';
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
}

type Tab = 'all' | 'projects' | 'people';

export const PublicCanvasSearch = () => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [projectResults, setProjectResults] = useState<PublicProject[]>([]);
  const [profileResults, setProfileResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [featured, setFeatured] = useState<PublicProject[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  useEffect(() => {
    if (!query.trim()) {
      setProjectResults([]);
      setProfileResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const [projectsRes, profilesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, description, language, stars_count, forked_from, updated_at')
          .eq('is_public', true)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%,language.ilike.%${query}%`)
          .order('stars_count', { ascending: false })
          .limit(10),
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showProjects = tab === 'all' || tab === 'projects';
  const showPeople = tab === 'all' || tab === 'people';
  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && (showProjects ? projectResults.length === 0 : true) && (showPeople ? profileResults.length === 0 : true);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'projects', label: 'Projects' },
    { key: 'people', label: 'People' },
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
          placeholder="Search canvases, people..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {query && (
          <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-xl shadow-black/20 z-50 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* No query — show featured */}
            {!hasQuery && (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Popular Canvases</div>
                {featured.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No public canvases yet</div>
                ) : (
                  featured.map((p) => (
                    <ProjectRow key={p.id} project={p} onClick={() => { setOpen(false); navigate(`/project/${p.id}`); }} />
                  ))
                )}
              </>
            )}

            {/* Has query */}
            {hasQuery && noResults && !loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">No results found</div>
            )}
            {hasQuery && loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">Searching...</div>
            )}

            {hasQuery && !loading && showPeople && profileResults.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">People</div>
                {profileResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setOpen(false); navigate(`/profile/${p.user_id}`); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-secondary">
                        <User className="w-3.5 h-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{p.display_name || 'Anonymous'}</span>
                  </button>
                ))}
              </>
            )}

            {hasQuery && !loading && showProjects && projectResults.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Projects</div>
                {projectResults.map((p) => (
                  <ProjectRow key={p.id} project={p} onClick={() => { setOpen(false); navigate(`/project/${p.id}`); }} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectRow = ({ project: p, onClick }: { project: PublicProject; onClick: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors">
    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate">{p.name}</span>
        {p.forked_from && <GitFork className="w-3 h-3 text-muted-foreground shrink-0" />}
      </div>
      {p.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>}
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
);
