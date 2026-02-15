import { useState, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import { getFileLanguage } from '@/data/defaultFiles';

export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

interface RepoInfo {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  default_branch: string;
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

// ---- GitHub: uses Git Trees API for full-repo fetch ----

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
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!r.ok) throw new Error(r.status === 404 ? 'Repository not found. Make sure it exists and is public.' : r.statusText);
    const d = await r.json();
    return { name: d.name, full_name: d.full_name, description: d.description, stargazers_count: d.stargazers_count, language: d.language, default_branch: d.default_branch };
  },
  async fetchFullTree(owner: string, repo: string, branch: string): Promise<{ path: string; type: 'blob' | 'tree'; url: string; size?: number }[]> {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    if (!r.ok) {
      // Fallback: try master
      if (branch === 'main') {
        const r2 = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
        if (r2.ok) {
          const d = await r2.json();
          return d.tree || [];
        }
      }
      throw new Error(`Failed to fetch repository tree: ${r.statusText}`);
    }
    const d = await r.json();
    return d.tree || [];
  },
  async fetchFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
    // Encode each path segment individually (don't encode slashes)
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    // Use GitHub Contents API with raw media type (has CORS support)
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`;
    const r = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3.raw' } });
    if (r.ok) return r.text();
    // Fallback to raw.githubusercontent.com
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
    const r2 = await fetch(rawUrl);
    if (!r2.ok) throw new Error(`Failed to fetch ${path}: ${r.status} / ${r2.status}`);
    return r2.text();
  },
  async searchRepos(query: string): Promise<SearchResult[]> {
    const r = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10&sort=stars`);
    if (!r.ok) return [];
    const d = await r.json();
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

const adapters = { github, gitlab, bitbucket };

export const detectProvider = (url: string): GitProvider | null => {
  if (/github\.com/i.test(url)) return 'github';
  if (/gitlab\.com/i.test(url)) return 'gitlab';
  if (/bitbucket\.org/i.test(url)) return 'bitbucket';
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

    // Skip hidden files (except .gitignore) and skip directories
    if (name.startsWith('.') && name !== '.gitignore') continue;
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
      const adapter = adapters[provider];
      const parsed = adapter.parseUrl(urlOrPath);
      if (!parsed) {
        throw new Error(provider === 'github'
          ? 'Invalid URL. Use format: github.com/owner/repo or owner/repo'
          : `Invalid ${provider} URL.`);
      }

      const { owner, repo } = parsed;

      setImportProgress('Fetching repository info...');
      const repoInfo = await adapter.fetchRepoInfo(owner, repo);

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
