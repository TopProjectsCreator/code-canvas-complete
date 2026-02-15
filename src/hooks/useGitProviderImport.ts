import { useState, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import { getFileLanguage } from '@/data/defaultFiles';

export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

interface RepoFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
}

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

const TEXT_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
  '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.cs', '.html', '.css',
  '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml', '.md',
  '.txt', '.sh', '.bash', '.sql', '.lua', '.r', '.pl', '.scala', '.hs',
  '.ex', '.exs', '.clj', '.dart', '.jl', '.nim', '.zig', '.f90', '.cob',
  '.fs', '.ml', '.erl', '.cr', '.lisp', '.pro', '.rkt', '.vue', '.svelte',
  '.toml', '.ini', '.cfg', '.env.example', '.gitignore', 'Makefile',
  'Dockerfile', 'README', 'LICENSE', '.prettierrc', '.eslintrc'
];

const SKIP_DIRS = ['node_modules', 'dist', 'build', '.git', '__pycache__', 'venv'];

// ---- Provider-specific API adapters ----

const providerAdapters = {
  github: {
    parseUrl(url: string) {
      const patterns = [
        /github\.com\/([^\/]+)\/([^\/\s#?]+)/,
        /^([^\/]+)\/([^\/\s#?]+)$/,
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
    async fetchDir(owner: string, repo: string, path: string, branch: string): Promise<RepoFile[]> {
      let r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
      if (!r.ok && branch === 'main') {
        r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=master`);
      }
      if (!r.ok) throw new Error(`Failed to fetch contents: ${r.statusText}`);
      const items: any[] = await r.json();
      return items.map(i => ({ name: i.name, path: i.path, type: i.type === 'dir' ? 'dir' : 'file', download_url: i.download_url }));
    },
    async searchRepos(query: string): Promise<SearchResult[]> {
      const r = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10&sort=stars`);
      if (!r.ok) return [];
      const d = await r.json();
      return (d.items || []).map((i: any) => ({ name: i.name, full_name: i.full_name, description: i.description, stargazers_count: i.stargazers_count, language: i.language }));
    },
  },

  gitlab: {
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
    async fetchDir(owner: string, repo: string, path: string, branch: string): Promise<RepoFile[]> {
      const id = encodeURIComponent(`${owner}/${repo}`);
      const r = await fetch(`https://gitlab.com/api/v4/projects/${id}/repository/tree?path=${encodeURIComponent(path)}&ref=${branch}&per_page=100`);
      if (!r.ok) throw new Error(`Failed to fetch contents: ${r.statusText}`);
      const items: any[] = await r.json();
      return items.map(i => ({
        name: i.name,
        path: i.path,
        type: i.type === 'tree' ? 'dir' : 'file',
        download_url: i.type === 'blob' ? `https://gitlab.com/api/v4/projects/${id}/repository/files/${encodeURIComponent(i.path)}/raw?ref=${branch}` : null,
      }));
    },
    async searchRepos(query: string): Promise<SearchResult[]> {
      const r = await fetch(`https://gitlab.com/api/v4/projects?search=${encodeURIComponent(query)}&order_by=stars&per_page=10&visibility=public`);
      if (!r.ok) return [];
      const items: any[] = await r.json();
      return items.map(i => ({ name: i.name, full_name: i.path_with_namespace, description: i.description, stargazers_count: i.star_count || 0, language: null }));
    },
  },

  bitbucket: {
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
    async fetchDir(owner: string, repo: string, path: string, branch: string): Promise<RepoFile[]> {
      const p = path ? `${path}/` : '';
      const r = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${branch}/${p}?pagelen=100`);
      if (!r.ok) throw new Error(`Failed to fetch contents: ${r.statusText}`);
      const d = await r.json();
      return (d.values || []).map((i: any) => ({
        name: i.path.split('/').pop() || i.path,
        path: i.path,
        type: i.type === 'commit_directory' ? 'dir' : 'file',
        download_url: i.type === 'commit_file' ? i.links?.self?.href : null,
      }));
    },
    async searchRepos(query: string): Promise<SearchResult[]> {
      const r = await fetch(`https://api.bitbucket.org/2.0/repositories?q=name~"${encodeURIComponent(query)}"&pagelen=10&sort=-updated_on`);
      if (!r.ok) return [];
      const d = await r.json();
      return (d.values || []).map((i: any) => ({ name: i.name, full_name: i.full_name, description: i.description || null, stargazers_count: 0, language: i.language || null }));
    },
  },
};

// Auto-detect provider from URL
export const detectProvider = (url: string): GitProvider | null => {
  if (/github\.com/i.test(url)) return 'github';
  if (/gitlab\.com/i.test(url)) return 'gitlab';
  if (/bitbucket\.org/i.test(url)) return 'bitbucket';
  return null;
};

export const useGitProviderImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchFileContent = async (url: string): Promise<string> => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to fetch file: ${r.statusText}`);
    return r.text();
  };

  const buildFileTree = async (
    adapter: typeof providerAdapters.github,
    owner: string, repo: string, path: string, branch: string, depth = 0
  ): Promise<FileNode[]> => {
    if (depth > 5) return [];
    const contents = await adapter.fetchDir(owner, repo, path, branch);
    const nodes: FileNode[] = [];

    for (const item of contents) {
      if (item.name.startsWith('.') && item.name !== '.gitignore') continue;
      if (SKIP_DIRS.includes(item.name)) continue;

      if (item.type === 'dir') {
        setImportProgress(`Scanning ${item.path}...`);
        const children = await buildFileTree(adapter, owner, repo, item.path, branch, depth + 1);
        nodes.push({ id: generateId(), name: item.name, type: 'folder', children });
      } else if (item.type === 'file' && item.download_url) {
        const hasTextExt = TEXT_EXTENSIONS.some(ext => item.name.toLowerCase().endsWith(ext) || item.name === ext.replace('.', ''));
        if (hasTextExt) {
          setImportProgress(`Fetching ${item.name}...`);
          try {
            const content = await fetchFileContent(item.download_url);
            nodes.push({ id: generateId(), name: item.name, type: 'file', language: getFileLanguage(item.name), content });
          } catch {
            console.warn(`Skipped ${item.name}: failed to fetch`);
          }
        } else {
          nodes.push({ id: generateId(), name: item.name, type: 'file', language: getFileLanguage(item.name), content: `// Binary file: ${item.name}\n// This file type is not editable in the browser.` });
        }
      }
      await new Promise(r => setTimeout(r, 50));
    }
    return nodes;
  };

  const importRepository = useCallback(async (urlOrPath: string, provider: GitProvider): Promise<FileNode[] | null> => {
    setIsImporting(true);
    setError(null);
    setImportProgress('Parsing URL...');

    try {
      const adapter = providerAdapters[provider];
      const parsed = adapter.parseUrl(urlOrPath);
      if (!parsed) {
        // For owner/repo shorthand, default to github-style parsing
        if (provider === 'github') {
          throw new Error('Invalid URL. Use format: github.com/owner/repo or owner/repo');
        }
        throw new Error(`Invalid ${provider} URL.`);
      }

      setImportProgress('Fetching repository info...');
      const repoInfo = await adapter.fetchRepoInfo(parsed.owner, parsed.repo);

      setImportProgress('Building file tree...');
      const children = await buildFileTree(adapter, parsed.owner, parsed.repo, '', repoInfo.default_branch);

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
      return await providerAdapters[provider].searchRepos(query);
    } catch {
      return [];
    }
  }, []);

  return { importRepository, searchRepositories, isImporting, importProgress, error, clearError: () => setError(null) };
};
