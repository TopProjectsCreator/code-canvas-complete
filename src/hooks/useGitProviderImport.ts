import { useState, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import { getFileLanguage } from '@/data/defaultFiles';
import { supabase } from '@/integrations/supabase/client';

export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'replit' | 'bolt' | 'firebase';

interface RepoInfo {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  default_branch: string;
  resolvedProvider?: GitProvider;
  resolvedOwner?: string;
  resolvedRepo?: string;
}

interface SearchResult {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// Binary extensions that should NOT be fetched as text
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.avif',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
  '.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv', '.flv',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.pyc', '.pyo', '.class', '.o', '.obj', '.a', '.lib',
  '.db', '.sqlite', '.sqlite3',
]);

const isTextFile = (name: string) => {
  const lower = name.toLowerCase();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot === -1) return true; // No extension = likely text (Makefile, Dockerfile, etc.)
  const ext = lower.slice(lastDot);
  return !BINARY_EXTENSIONS.has(ext);
};

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '__pycache__', 'venv', '.venv', 'vendor', 'target', '.next', '.nuxt', 'coverage']);
const ALLOWED_HIDDEN_NAMES = new Set(['.gitignore', '.tutorial']);

// Helper to get user's GitHub token from BYOK
const getUserGithubToken = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('provider', 'github')
      .maybeSingle();
    return data?.api_key || null;
  } catch {
    return null;
  }
};

const fetchReplitOEmbedMetadata = async (owner: string, repo: string) => {
  const url = `https://replit.com/data/oembed?url=${encodeURIComponent(`https://replit.com/@${owner}/${repo}`)}`;
  const r = await fetch(url);
  if (!r.ok) return { exists: false };
  const d = await r.json();
  return {
    exists: true,
    title: typeof d?.title === 'string' ? d.title : repo,
    description: typeof d?.author_name === 'string' ? `By ${d.author_name}` : null,
    githubOwner: null,
    githubRepo: null,
  };
};

// Helper to call the github-proxy edge function
const ghProxy = async (body: Record<string, unknown>) => {
  const userToken = await getUserGithubToken();
  const payload = userToken ? { ...body, userToken } : body;
  const { data, error } = await supabase.functions.invoke('github-proxy', { body: payload });
  if (error) throw new Error(error.message || 'Proxy request failed');
  if (data?.error === 'Unknown action') {
    if (body.action === 'replit-metadata' && typeof body.owner === 'string' && typeof body.repo === 'string') {
      return fetchReplitOEmbedMetadata(body.owner, body.repo);
    }
    if (body.action === 'replit-download-zip') {
      throw new Error('Replit download proxy is not deployed yet. Please deploy supabase/functions/github-proxy before importing Replit zips.');
    }
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

const github = {
  parseUrl(url: string) {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\s#?]+)/,
      /^([^\/\s#?]+)\/([^\/\s#?]+)$/,
    ];
    for (const p of patterns) {
      const m = url.trim().match(p);
      if (m) return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
    }
    return null;
  },
  async fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    const d = await ghProxy({ action: 'repo-info', owner, repo });
    if (!d.name) throw new Error('Repository not found. Make sure it exists and is public.');
    return { name: d.name, full_name: d.full_name, description: d.description, stargazers_count: d.stargazers_count, language: d.language, default_branch: d.default_branch };
  },
  async fetchFullTree(owner: string, repo: string, branch: string): Promise<{ path: string; type: 'blob' | 'tree'; url: string; size?: number }[]> {
    const d = await ghProxy({ action: 'tree', owner, repo, branch });
    if (!d.tree && branch === 'main') {
      // Fallback: try master
      const d2 = await ghProxy({ action: 'tree', owner, repo, branch: 'master' });
      return d2.tree || [];
    }
    return d.tree || [];
  },
  async fetchFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
    const d = await ghProxy({ action: 'file-content', owner, repo, path, branch });
    if (d.content !== undefined) return d.content;
    throw new Error(`Failed to fetch ${path}`);
  },
  async searchRepos(query: string): Promise<SearchResult[]> {
    const d = await ghProxy({ action: 'search', query });
    return (d.items || []).map((i: any) => ({ name: i.name, full_name: i.full_name, description: i.description, stargazers_count: i.stargazers_count, language: i.language }));
  },
};

// ---- GitLab ----

const gitlab = {
  parseUrl(url: string) {
    const m = url.trim().match(/gitlab\.com\/(.+?)(?:\.git)?$/);
    if (m) {
      const parts = m[1].split('/');
      if (parts.length >= 2) return { owner: parts.slice(0, -1).join('/'), repo: parts[parts.length - 1] };
    }
    return null;
  },
  async fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    const id = encodeURIComponent(`${owner}/${repo}`);
    const r = await fetch(`https://gitlab.com/api/v4/projects/${id}`);
    if (!r.ok) throw new Error(r.status === 404 ? 'Repository not found. Make sure it exists and is public.' : r.statusText);
    const d = await r.json();
    return { name: d.name, full_name: d.path_with_namespace, description: d.description, stargazers_count: d.star_count || 0, language: null, default_branch: d.default_branch || 'main' };
  },
  async fetchFullTree(owner: string, repo: string, branch: string): Promise<{ path: string; type: 'blob' | 'tree' }[]> {
    const id = encodeURIComponent(`${owner}/${repo}`);
    const allItems: { path: string; type: 'blob' | 'tree' }[] = [];
    let page = 1;
    while (true) {
      const r = await fetch(`https://gitlab.com/api/v4/projects/${id}/repository/tree?ref=${branch}&recursive=true&per_page=100&page=${page}`);
      if (!r.ok) throw new Error(`Failed to fetch tree: ${r.statusText}`);
      const items: any[] = await r.json();
      if (items.length === 0) break;
      allItems.push(...items.map(i => ({ path: i.path, type: (i.type === 'tree' ? 'tree' : 'blob') as 'blob' | 'tree' })));
      if (items.length < 100) break;
      page++;
    }
    return allItems;
  },
  async fetchFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
    const id = encodeURIComponent(`${owner}/${repo}`);
    const filePath = encodeURIComponent(path);
    const r = await fetch(`https://gitlab.com/api/v4/projects/${id}/repository/files/${filePath}/raw?ref=${branch}`);
    if (!r.ok) throw new Error(`Failed to fetch ${path}`);
    return r.text();
  },
  async searchRepos(query: string): Promise<SearchResult[]> {
    const r = await fetch(`https://gitlab.com/api/v4/projects?search=${encodeURIComponent(query)}&order_by=stars&per_page=10&visibility=public`);
    if (!r.ok) return [];
    const items: any[] = await r.json();
    return items.map(i => ({ name: i.name, full_name: i.path_with_namespace, description: i.description, stargazers_count: i.star_count || 0, language: null }));
  },
};

// ---- Bitbucket ----

const bitbucket = {
  parseUrl(url: string) {
    const m = url.trim().match(/bitbucket\.org\/([^\/]+)\/([^\/\s#?]+)/);
    if (m) return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
    return null;
  },
  async fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    const r = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}`);
    if (!r.ok) throw new Error(r.status === 404 ? 'Repository not found. Make sure it exists and is public.' : r.statusText);
    const d = await r.json();
    return { name: d.name, full_name: d.full_name, description: d.description || null, stargazers_count: 0, language: d.language || null, default_branch: d.mainbranch?.name || 'main' };
  },
  async fetchFullTree(owner: string, repo: string, branch: string): Promise<{ path: string; type: 'blob' | 'tree' }[]> {
    // Bitbucket doesn't have a recursive tree endpoint, so we use src listing with max depth
    const allItems: { path: string; type: 'blob' | 'tree' }[] = [];
    let url: string | null = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${branch}/?pagelen=100&max_depth=10`;
    while (url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch tree: ${r.statusText}`);
      const d = await r.json();
      for (const v of (d.values || [])) {
        allItems.push({
          path: v.path,
          type: v.type === 'commit_directory' ? 'tree' : 'blob',
        });
      }
      url = d.next || null;
    }
    return allItems;
  },
  async fetchFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
    const r = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${branch}/${path}`);
    if (!r.ok) throw new Error(`Failed to fetch ${path}`);
    return r.text();
  },
  async searchRepos(query: string): Promise<SearchResult[]> {
    const r = await fetch(`https://api.bitbucket.org/2.0/repositories?q=name~"${encodeURIComponent(query)}"&pagelen=10&sort=-updated_on`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.values || []).map((i: any) => ({ name: i.name, full_name: i.full_name, description: i.description || null, stargazers_count: 0, language: i.language || null }));
  },
};

const extractWrappedGitRepo = (url: string): { provider: 'github' | 'gitlab' | 'bitbucket'; owner: string; repo: string } | null => {
  const decoded = (() => {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  })();
  const normalized = decoded.replace(/^https?:\/\//i, '');
  const parsers: Array<{ provider: 'github' | 'gitlab' | 'bitbucket'; matcher: RegExp }> = [
    { provider: 'github', matcher: /github\.com\/([^\/\s#?]+)\/([^\/\s#?]+)/i },
    { provider: 'gitlab', matcher: /gitlab\.com\/([^\/\s#?]+(?:\/[^\/\s#?]+)*)\/([^\/\s#?]+)/i },
    { provider: 'bitbucket', matcher: /bitbucket\.org\/([^\/\s#?]+)\/([^\/\s#?]+)/i },
  ];

  for (const { provider, matcher } of parsers) {
    const m = normalized.match(matcher);
    if (m) {
      return { provider, owner: m[1], repo: m[2].replace(/\.git$/, '') };
    }
  }
  return null;
};

const replit = {
  parseUrl(url: string) {
    const trimmed = url.trim();
    // replit.com/github/owner/repo → delegate to github
    const ghMatch = trimmed.match(/replit\.com\/github\/([^\/\s#?]+)\/([^\/\s#?]+)/i);
    if (ghMatch) return { owner: ghMatch[1], repo: ghMatch[2].replace(/\.git$/, ''), isGithub: true };
    // replit.com/@user/repl
    const replMatch = trimmed.match(/replit\.com\/@([^\/\s#?]+)\/([^\/\s#?]+)/i);
    if (replMatch) return { owner: replMatch[1], repo: replMatch[2].replace(/[#?].*$/, ''), isGithub: false };
    return null;
  },
  async fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    const metadata = await ghProxy({ action: 'replit-metadata', owner, repo });
    if (!metadata?.exists) {
      throw new Error('Repl not found. Make sure it exists and is public.');
    }

    if (metadata?.githubOwner && metadata?.githubRepo) {
      return {
        name: metadata.githubRepo,
        full_name: `${metadata.githubOwner}/${metadata.githubRepo}`,
        description: metadata.description ?? null,
        stargazers_count: 0,
        language: null,
        default_branch: 'main',
        resolvedProvider: 'github',
        resolvedOwner: metadata.githubOwner,
        resolvedRepo: metadata.githubRepo,
      };
    }

    return {
      name: metadata?.title || repo,
      full_name: `@${owner}/${repo}`,
      description: metadata?.description ?? null,
      stargazers_count: 0,
      language: null,
      default_branch: 'main',
    };
  },
  async fetchFullTree(owner: string, repo: string, _branch: string): Promise<{ path: string; type: 'blob' | 'tree' }[]> {
    // Replit provides a zip download at /@user/repl.zip
    const zipUrl = `https://replit.com/@${owner}/${repo}.zip`;
    const r = await fetch(zipUrl);
    if (!r.ok) {
      throw new Error('This Replit project cannot be downloaded directly. If this repl is GitHub-backed, import the GitHub repository URL instead.');
    }
    const bytes = await r.arrayBuffer();
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(bytes);
    const items: { path: string; type: 'blob' | 'tree' }[] = [];
    zip.forEach((relativePath, entry) => {
      if (entry.dir) {
        items.push({ path: relativePath.replace(/\/$/, ''), type: 'tree' });
      } else {
        items.push({ path: relativePath, type: 'blob' });
      }
    });
    // Also store zip ref for fetchFileContent
    (replit as any)._lastZip = zip;
    return items;
  },
  async fetchFileContent(_owner: string, _repo: string, path: string, _branch: string): Promise<string> {
    const zip = (replit as any)._lastZip;
    if (!zip) throw new Error('Zip not loaded');
    const file = zip.file(path);
    if (!file) throw new Error(`File not found in zip: ${path}`);
    return file.async('string');
  },
  searchRepos: github.searchRepos,
};

const bolt = {
  parseUrl(url: string) {
    const trimmed = url.trim();
    if (!/bolt\.new/i.test(trimmed)) return null;
    const wrapped = extractWrappedGitRepo(trimmed);
    if (!wrapped) return null;
    return { owner: wrapped.owner, repo: wrapped.repo, resolvedProvider: wrapped.provider };
  },
  async fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    return github.fetchRepoInfo(owner, repo);
  },
  async fetchFullTree(owner: string, repo: string, branch: string) {
    return github.fetchFullTree(owner, repo, branch);
  },
  async fetchFileContent(owner: string, repo: string, path: string, branch: string) {
    return github.fetchFileContent(owner, repo, path, branch);
  },
  searchRepos: github.searchRepos,
};

const firebase = {
  parseUrl(url: string) {
    const trimmed = url.trim();
    if (!/firebase\.google\.com|studio\.firebase\.google\.com/i.test(trimmed)) return null;
    const wrapped = extractWrappedGitRepo(trimmed);
    if (!wrapped) return null;
    return { owner: wrapped.owner, repo: wrapped.repo, resolvedProvider: wrapped.provider };
  },
  async fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    return github.fetchRepoInfo(owner, repo);
  },
  async fetchFullTree(owner: string, repo: string, branch: string) {
    return github.fetchFullTree(owner, repo, branch);
  },
  async fetchFileContent(owner: string, repo: string, path: string, branch: string) {
    return github.fetchFileContent(owner, repo, path, branch);
  },
  searchRepos: github.searchRepos,
};

const adapters = { github, gitlab, bitbucket, replit, bolt, firebase };

export const detectProvider = (url: string): GitProvider | null => {
  if (/bolt\.new/i.test(url)) return 'bolt';
  if (/firebase\.google\.com|studio\.firebase\.google\.com/i.test(url)) return 'firebase';
  if (/github\.com/i.test(url)) return 'github';
  if (/gitlab\.com/i.test(url)) return 'gitlab';
  if (/bitbucket\.org/i.test(url)) return 'bitbucket';
  if (/replit\.com/i.test(url)) return 'replit';
  return null;
};

// Build a nested FileNode tree from a flat list of paths
const buildTreeFromPaths = (
  items: { path: string; type: 'blob' | 'tree' }[],
  fileContents: Map<string, string>
): FileNode[] => {
  const root: FileNode[] = [];
  const folderMap = new Map<string, FileNode>();

  // Sort so directories come before their contents
  const sorted = [...items].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sorted) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];

    // Skip hidden files except explicitly-supported entries
    if (name.startsWith('.') && !ALLOWED_HIDDEN_NAMES.has(name)) continue;
    if (SKIP_DIRS.has(name)) continue;

    // Check if any ancestor is a skipped directory
    const hasSkippedAncestor = parts.some(p => SKIP_DIRS.has(p));
    if (hasSkippedAncestor) continue;

    if (item.type === 'tree') {
      const folder: FileNode = { id: generateId(), name, type: 'folder', children: [] };
      folderMap.set(item.path, folder);

      if (parts.length === 1) {
        root.push(folder);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = folderMap.get(parentPath);
        if (parent?.children) parent.children.push(folder);
        else root.push(folder); // orphan folder, put at root
      }
    } else {
      const content = fileContents.get(item.path);
      const isText = isTextFile(name);
      const node: FileNode = {
        id: generateId(),
        name,
        type: 'file',
        language: getFileLanguage(name),
        content: content ?? (isText
          ? `// Failed to fetch file content for: ${name}\n// Try re-importing the repository.`
          : `// Binary file: ${name}\n// This file type is not editable in the browser.`),
      };

      if (parts.length === 1) {
        root.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = folderMap.get(parentPath);
        if (parent?.children) parent.children.push(node);
        else root.push(node);
      }
    }
  }

  return root;
};

export const useGitProviderImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const importRepository = useCallback(async (urlOrPath: string, provider: GitProvider): Promise<FileNode[] | null> => {
    setIsImporting(true);
    setError(null);
    setImportProgress('Parsing URL...');

    try {
      let adapter = adapters[provider];
      const parsed = adapter.parseUrl(urlOrPath);
      if (!parsed) {
        throw new Error(
          provider === 'github'
            ? 'Invalid URL. Use format: github.com/owner/repo or owner/repo'
            : provider === 'replit'
              ? 'Invalid Replit URL. Use format: replit.com/@owner/repo or replit.com/github/owner/repo'
              : provider === 'bolt'
                ? 'Invalid Bolt URL. Include a Git URL in your Bolt link (for example: bolt.new/~/github.com/owner/repo).'
                : provider === 'firebase'
                  ? 'Invalid Firebase Studio URL. Include a Git URL in your import link (GitHub/GitLab/Bitbucket).'
              : `Invalid ${provider} URL.`,
        );
      }

      // If Replit URL is GitHub-backed, use GitHub adapter
      if (provider === 'replit' && (parsed as any).isGithub) {
        adapter = adapters.github;
      }
      if ((provider === 'bolt' || provider === 'firebase') && (parsed as any).resolvedProvider) {
        adapter = adapters[(parsed as any).resolvedProvider as 'github' | 'gitlab' | 'bitbucket'];
      }

      let { owner, repo } = parsed;

      setImportProgress('Fetching repository info...');
      const repoInfo = await adapter.fetchRepoInfo(owner, repo);

      // Replit URLs can map to an underlying GitHub repository.
      if (provider === 'replit' && repoInfo.resolvedProvider === 'github' && repoInfo.resolvedOwner && repoInfo.resolvedRepo) {
        adapter = adapters.github;
        owner = repoInfo.resolvedOwner;
        repo = repoInfo.resolvedRepo;
        setImportProgress('Resolved Replit project to GitHub source...');
      }

      setImportProgress('Fetching file tree...');
      const tree = await adapter.fetchFullTree(owner, repo, repoInfo.default_branch);

      // Identify text files to fetch content for
      const textFiles = tree.filter(t => t.type === 'blob' && isTextFile(t.path));
      const fileContents = new Map<string, string>();

      // Fetch file contents in batches of 5 to avoid rate limiting
      const BATCH_SIZE = 5;
      for (let i = 0; i < textFiles.length; i += BATCH_SIZE) {
        const batch = textFiles.slice(i, i + BATCH_SIZE);
        setImportProgress(`Fetching files... (${Math.min(i + BATCH_SIZE, textFiles.length)}/${textFiles.length})`);

        const results = await Promise.allSettled(
          batch.map(async f => {
            const content = await adapter.fetchFileContent(owner, repo, f.path, repoInfo.default_branch);
            return { path: f.path, content };
          })
        );

        for (const r of results) {
          if (r.status === 'fulfilled') {
            fileContents.set(r.value.path, r.value.content);
          } else {
            console.warn('File fetch failed:', r.reason?.message || r.reason);
          }
        }

        // Small delay between batches
        if (i + BATCH_SIZE < textFiles.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      setImportProgress('Building file tree...');
      const children = buildTreeFromPaths(tree, fileContents);

      setImportProgress('Import complete!');
      return [{ id: 'root', name: repoInfo.name, type: 'folder', children }];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import repository');
      return null;
    } finally {
      setIsImporting(false);
    }
  }, []);

  const searchRepositories = useCallback(async (query: string, provider: GitProvider): Promise<SearchResult[]> => {
    if (!query.trim()) return [];
    try {
      return await adapters[provider].searchRepos(query);
    } catch {
      return [];
    }
  }, []);

  return { importRepository, searchRepositories, isImporting, importProgress, error, clearError: () => setError(null) };
};
