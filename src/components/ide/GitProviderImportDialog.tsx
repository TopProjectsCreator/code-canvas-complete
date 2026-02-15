import { useState, useEffect } from 'react';
import { Search, Star, Loader2, AlertCircle, ExternalLink, FolderGit2, GitBranch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGitProviderImport, GitProvider, detectProvider } from '@/hooks/useGitProviderImport';
import { FileNode } from '@/types/ide';

interface GitProviderImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (files: FileNode[], repoName: string) => void;
}

interface SearchResult {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
}

const PROVIDERS: { id: GitProvider; label: string; icon: string; placeholder: string }[] = [
  { id: 'github', label: 'GitHub', icon: '⬛', placeholder: 'github.com/owner/repo or owner/repo' },
  { id: 'gitlab', label: 'GitLab', icon: '🦊', placeholder: 'gitlab.com/owner/repo' },
  { id: 'bitbucket', label: 'Bitbucket', icon: '🪣', placeholder: 'bitbucket.org/owner/repo' },
];

export const GitProviderImportDialog = ({ open, onOpenChange, onImport }: GitProviderImportDialogProps) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'url' | 'search'>('url');
  const [provider, setProvider] = useState<GitProvider>('github');

  const { importRepository, searchRepositories, isImporting, importProgress, error, clearError } = useGitProviderImport();

  // Auto-detect provider from URL
  useEffect(() => {
    const detected = detectProvider(repoUrl);
    if (detected) setProvider(detected);
  }, [repoUrl]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'search') {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchRepositories(searchQuery, provider);
      setSearchResults(results);
      setIsSearching(false);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, activeTab, searchRepositories, provider]);

  const handleImport = async (urlOrFullName: string) => {
    clearError();
    const files = await importRepository(urlOrFullName, provider);
    if (files && files.length > 0) {
      onImport(files, files[0].name);
      onOpenChange(false);
      setRepoUrl('');
      setSearchQuery('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim()) handleImport(repoUrl);
  };

  const currentProvider = PROVIDERS.find(p => p.id === provider)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Import from Git
          </DialogTitle>
        </DialogHeader>

        {/* Provider selector */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => { setProvider(p.id); setSearchResults([]); }}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5",
                provider === p.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveTab('url')}
            className={cn(
              "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === 'url' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Enter URL
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={cn(
              "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === 'search' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Search
          </button>
        </div>

        {/* URL Input Tab */}
        {activeTab === 'url' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Repository URL{provider === 'github' ? ' or owner/repo' : ''}
              </label>
              <Input
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder={currentProvider.placeholder}
                disabled={isImporting}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isImporting && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 text-primary text-sm">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{importProgress}</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
                Cancel
              </Button>
              <Button type="submit" disabled={!repoUrl.trim() || isImporting}>
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importing...</>
                ) : (
                  <><FolderGit2 className="w-4 h-4 mr-2" />Import</>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search public ${currentProvider.label} repositories...`}
                className="pl-9"
                disabled={isImporting}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isImporting && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 text-primary text-sm">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{importProgress}</span>
              </div>
            )}

            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {searchResults.map((repo) => (
                  <button
                    key={repo.full_name}
                    onClick={() => handleImport(repo.full_name)}
                    disabled={isImporting}
                    className={cn(
                      "w-full p-3 rounded-lg border border-border text-left transition-colors",
                      "hover:bg-accent hover:border-primary/30",
                      isImporting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{repo.full_name}</span>
                        </div>
                        {repo.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {repo.language && <span className="text-xs text-muted-foreground">{repo.language}</span>}
                          {repo.stargazers_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="w-3 h-3" />
                              {repo.stargazers_count.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isSearching && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No repositories found for "{searchQuery}"
              </div>
            )}

            {!searchQuery && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Search for public {currentProvider.label} repositories</p>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Only public repositories can be imported. Large repos may take longer.
        </p>
      </DialogContent>
    </Dialog>
  );
};
