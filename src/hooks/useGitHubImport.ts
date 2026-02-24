import { useState, useCallback } from 'react';
import { FileNode } from '@/types/ide';
import { getFileLanguage } from '@/data/defaultFiles';

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
  sha: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  default_branch: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const ALLOWED_HIDDEN_NAMES = new Set(['.gitignore', '.tutorial']);

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

const isLikelyTextFile = (name: string) => {
  const lower = name.toLowerCase();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot === -1) return true;
  const extension = lower.slice(lastDot);
  return !BINARY_EXTENSIONS.has(extension);
};

export const useGitHubImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const parseGitHubUrl = (url: string): { owner: string; repo: string; branch?: string } | null => {
    // Support various GitHub URL formats
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\s#?]+)/,
      /^([^\/]+)\/([^\/\s#?]+)$/, // owner/repo format
    ];

    for (const pattern of patterns) {
      const match = url.trim().match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
        };
      }
    }
    return null;
  };

  const fetchRepoInfo = async (owner: string, repo: string): Promise<GitHubRepo | null> => {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository not found. Make sure it exists and is public.');
        }
        throw new Error(`Failed to fetch repository: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      throw err;
    }
  };

  const fetchDirectoryContents = async (
    owner: string,
    repo: string,
    path: string = '',
    branch: string = 'main'
  ): Promise<GitHubFile[]> => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      // Try with 'master' branch if 'main' fails
      if (branch === 'main') {
        const masterUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=master`;
        const masterResponse = await fetch(masterUrl);
        if (masterResponse.ok) {
          return await masterResponse.json();
        }
      }
      throw new Error(`Failed to fetch contents: ${response.statusText}`);
    }
    
    return await response.json();
  };

  const fetchFileContent = async (downloadUrl: string): Promise<string> => {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    return await response.text();
  };

  const buildFileTree = async (
    owner: string,
    repo: string,
    path: string,
    branch: string,
    depth: number = 0
  ): Promise<FileNode[]> => {
    // Limit depth to prevent infinite recursion and rate limiting
    if (depth > 5) {
      return [];
    }

    const contents = await fetchDirectoryContents(owner, repo, path, branch);
    const nodes: FileNode[] = [];

    for (const item of contents) {
      // Skip hidden files and common non-essential files, but allow supported hidden entries
      if (item.name.startsWith('.') && !ALLOWED_HIDDEN_NAMES.has(item.name)) {
        continue;
      }
      
      // Skip node_modules, dist, build folders
      if (['node_modules', 'dist', 'build', '.git', '__pycache__', 'venv'].includes(item.name)) {
        continue;
      }

      if (item.type === 'dir') {
        setImportProgress(`Scanning ${item.path}...`);
        const children = await buildFileTree(owner, repo, item.path, branch, depth + 1);
        nodes.push({
          id: generateId(),
          name: item.name,
          type: 'folder',
          children,
        });
      } else if (item.type === 'file' && item.download_url) {
        if (isLikelyTextFile(item.name)) {
          setImportProgress(`Fetching ${item.name}...`);
          try {
            const content = await fetchFileContent(item.download_url);
            nodes.push({
              id: generateId(),
              name: item.name,
              type: 'file',
              language: getFileLanguage(item.name),
              content,
            });
          } catch {
            // Skip files that fail to fetch
            console.warn(`Skipped ${item.name}: failed to fetch`);
          }
        } else {
          // Add non-text files without content
          nodes.push({
            id: generateId(),
            name: item.name,
            type: 'file',
            language: getFileLanguage(item.name),
            content: `// Binary file: ${item.name}\n// This file type is not editable in the browser.`,
          });
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return nodes;
  };

  const importRepository = useCallback(async (urlOrPath: string): Promise<FileNode[] | null> => {
    setIsImporting(true);
    setError(null);
    setImportProgress('Parsing URL...');

    try {
      const parsed = parseGitHubUrl(urlOrPath);
      if (!parsed) {
        throw new Error('Invalid GitHub URL. Use format: github.com/owner/repo or owner/repo');
      }

      const { owner, repo } = parsed;

      setImportProgress('Fetching repository info...');
      const repoInfo = await fetchRepoInfo(owner, repo);
      if (!repoInfo) {
        throw new Error('Could not fetch repository information');
      }

      setImportProgress('Building file tree...');
      const children = await buildFileTree(owner, repo, '', repoInfo.default_branch);

      // Create root folder with repo name
      const rootNode: FileNode = {
        id: 'root',
        name: repoInfo.name,
        type: 'folder',
        children,
      };

      setImportProgress('Import complete!');
      return [rootNode];

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import repository';
      setError(message);
      return null;
    } finally {
      setIsImporting(false);
    }
  }, []);

  const searchRepositories = useCallback(async (query: string): Promise<GitHubRepo[]> => {
    if (!query.trim()) return [];
    
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10&sort=stars`
      );
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      return data.items || [];
    } catch {
      return [];
    }
  }, []);

  return {
    importRepository,
    searchRepositories,
    isImporting,
    importProgress,
    error,
    clearError: () => setError(null),
  };
};
