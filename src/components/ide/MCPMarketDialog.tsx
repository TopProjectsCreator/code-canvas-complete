import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Loader2, Server, AlertCircle, ArrowLeft, Trophy, Star, Grid3X3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MarketServer {
  name: string;
  slug: string;
  description: string;
  category: string;
  installs: number;
  url: string;
}

interface MarketCategory {
  slug: string;
  label: string;
  description: string;
  count: number;
}

type ViewMode = 'categories' | 'category' | 'search' | 'top' | 'official';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (server: MarketServer) => void;
}

async function callMcpMarket(params: Record<string, string>): Promise<{ servers?: MarketServer[]; categories?: MarketCategory[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke('fetch-mcp-servers', { body: params });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export function MCPMarketDialog({ open, onOpenChange, onPick }: Props) {
  const [view, setView] = useState<ViewMode>('categories');
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [servers, setServers] = useState<MarketServer[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setView('categories');
    setSearch('');
    setError(null);
    setServers([]);
    void loadCategories();
  }, [open]);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callMcpMarket({ mode: 'categories' });
      setCategories(data.categories || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const loadCategory = async (slug: string) => {
    setView('category');
    setActiveCategory(slug);
    setLoading(true);
    setError(null);
    setServers([]);
    try {
      const data = await callMcpMarket({ mode: 'category', category: slug });
      setServers(data.servers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  const loadCollection = async (mode: 'top' | 'official') => {
    setView(mode);
    setLoading(true);
    setError(null);
    setServers([]);
    try {
      const data = await callMcpMarket({ mode });
      setServers(data.servers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return;
    setView('search');
    setLoading(true);
    setError(null);
    setServers([]);
    try {
      const data = await callMcpMarket({ mode: 'search', search: search.trim() });
      setServers(data.servers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const goBack = () => {
    setView('categories');
    setServers([]);
    setError(null);
  };

  const title =
    view === 'categories' ? 'MCP Marketplace'
    : view === 'top' ? 'Top MCP Servers'
    : view === 'official' ? 'Official MCP Servers'
    : view === 'search' ? `Search: "${search}"`
    : activeCategory.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            {view !== 'categories' && (
              <button onClick={goBack} className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Server className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Discover MCP servers from{' '}
            <a href="https://mcpmarket.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              mcpmarket.com
            </a>
          </p>
        </DialogHeader>

        <div className="p-4 border-b border-border/50 bg-muted/20 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search MCP servers…"
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
              <p className="text-sm">Fetching from mcpmarket.com…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive text-center px-6">
              <AlertCircle className="w-10 h-10 mb-4 opacity-80" />
              <p className="font-medium mb-2">Could not load servers</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => view === 'categories' ? loadCategories() : goBack()} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : view === 'categories' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  onClick={() => loadCollection('top')}
                  className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Top Servers</h4>
                    <p className="text-xs text-muted-foreground">Leaderboard rankings</p>
                  </div>
                </button>
                <button
                  onClick={() => loadCollection('official')}
                  className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Official</h4>
                    <p className="text-xs text-muted-foreground">Vendor-maintained servers</p>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => loadCategory(cat.slug)}
                    className="p-3.5 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium">{cat.label}</h4>
                      {cat.count > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          {cat.count.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                    {cat.description && <p className="text-xs text-muted-foreground line-clamp-2">{cat.description}</p>}
                  </button>
                ))}
              </div>

              {categories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Grid3X3 className="w-10 h-10 mb-4 opacity-20" />
                  <p className="text-sm">No categories loaded</p>
                  <Button variant="outline" size="sm" onClick={loadCategories} className="mt-3">Reload</Button>
                </div>
              )}
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
              <Server className="w-10 h-10 mb-4 opacity-20" />
              <p className="text-sm">No servers found</p>
              <Button variant="outline" size="sm" onClick={goBack} className="mt-3">Back</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((s) => (
                <div key={s.slug} className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-medium truncate">{s.name}</h4>
                      {s.installs > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                          <Star className="w-3 h-3" /> {s.installs.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {s.category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{s.category}</Badge>}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">
                        View on mcpmarket.com →
                      </a>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 gap-1 h-8 text-xs"
                    onClick={() => { onPick(s); onOpenChange(false); }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
