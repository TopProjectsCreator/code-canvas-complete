import { useState, useCallback, useRef, useEffect } from 'react';
import { FileNode } from '@/types/ide';
import { getFileLanguage } from '@/data/defaultFiles';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubFileContentResponse {
  content?: string;
  encoding?: string;
  size?: number;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  default_branch: string;
}

let idCounter = 0;
const generateId = () => `n${++idCounter}_${Math.random().toString(36).substring(2, 7)}`;

const decodeBase64Utf8 = (base64: string): string => {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
};

const ALLOWED_HIDDEN_NAMES = new Set(['.gitignore', '.tutorial']);

const SKIPPED_DIRECTORIES = new Set([
  'node_modules', 'dist', 'build', '.git', '__pycache__', 'venv',
]);

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

const VIEWABLE_BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
  '.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv', '.flv',
]);

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  wma: 'audio/x-ms-wma',
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
};

const CONCURRENT_FETCH_LIMIT = 10;

const isLikelyTextFile = (name: string) => {
  const lower = name.toLowerCase();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot === -1) return true;
  const extension = lower.slice(lastDot);
  return !BINARY_EXTENSIONS.has(extension);
};

const isViewableBinaryFile = (name: string) => {
  const lower = name.toLowerCase();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot === -1) return false;
  const ext = lower.slice(lastDot);
  return VIEWABLE_BINARY_EXTENSIONS.has(ext);
};

const getMimeType = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || 'application/octet-stream';
};

const shouldSkipPath = (segments: string[]): boolean => {
  return segments.some(s => SKIPPED_DIRECTORIES.has(s));
};

const shouldSkipFile = (name: string): boolean => {
  return name.startsWith('.') && !ALLOWED_HIDDEN_NAMES.has(name);
};

const buildAuthHeaders = (token?: string): Record<string, string> => {
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

const fetchFileTree = async (
  owner: string,
  repo: string,
  branch: string,
  token?: string,
  signal?: AbortSignal
): Promise<GitHubTreeItem[]> => {
  const headers = buildAuthHeaders(token);
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await fetch(url, { headers, signal });

  if (!response.ok) {
    if (branch === 'main') {
      const masterUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
      const masterResponse = await fetch(masterUrl, { headers, signal });
      if (masterResponse.ok) {
        const data: GitHubTreeResponse = await masterResponse.json();
        if (data.truncated) {
          console.warn('Repository tree was truncated by GitHub (>100k entries). Some files may be missing.');
        }
        return data.tree;
      }
      throw new Error(
        `Failed to fetch file tree: tried 'main' (${response.statusText}) and 'master' (${masterResponse.statusText})`
      );
    }
    throw new Error(`Failed to fetch file tree: ${response.statusText}`);
  }

  const data: GitHubTreeResponse = await response.json();
  if (data.truncated) {
    console.warn('Repository tree was truncated by GitHub (>100k entries). Some files may be missing.');
  }
  return data.tree;
};

const fetchFileContent = async (
  owner: string,
  repo: string,
  path: string,
  branch: string,
  asDataUrl?: boolean,
  token?: string,
  signal?: AbortSignal
): Promise<string> => {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const headers = buildAuthHeaders(token);
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`,
    { headers, signal }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  const data: GitHubFileContentResponse = await response.json();

  if (data.encoding === 'base64' && typeof data.content === 'string') {
    const rawBase64 = data.content.replace(/\n/g, '');
    if (asDataUrl) {
      const mime = getMimeType(path);
      return `data:${mime};base64,${rawBase64}`;
    }
    return decodeBase64Utf8(rawBase64);
  }

  if (typeof data.content === 'string') {
    return data.content;
  }

  throw new Error('Unsupported file content format');
};

interface TreeBuildResult {
  rootNodes: FileNode[];
  filesToFetch: { path: string; asDataUrl: boolean }[];
  nodeIdToPath: Map<string, string>;
}

const buildTreeFromFlatList = (items: GitHubTreeItem[]): TreeBuildResult => {
  const nodeMap = new Map<string, FileNode>();
  const rootNodes: FileNode[] = [];
  const filesToFetch: { path: string; asDataUrl: boolean }[] = [];
  const nodeIdToPath = new Map<string, string>();

  const sortedItems = [...items].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sortedItems) {
    const segments = item.path.split('/');
    const name = segments[segments.length - 1];

    if (shouldSkipPath(segments.slice(0, -1))) continue;
    if (item.type === 'blob' && shouldSkipFile(name)) continue;

    if (item.type === 'tree') {
      nodeMap.set(item.path, {
        id: generateId(),
        name,
        type: 'folder',
        children: [],
      });
    } else if (item.type === 'blob') {
      const isText = isLikelyTextFile(name);
      const isViewable = isViewableBinaryFile(name);
      const id = generateId();

      if (!isText && !isViewable) {
        nodeMap.set(item.path, {
          id,
          name,
          type: 'file',
          language: getFileLanguage(name),
          content: `// Binary file: ${name}\n// This file type is not editable in the browser.`,
        });
      } else {
        nodeMap.set(item.path, {
          id,
          name,
          type: 'file',
          language: getFileLanguage(name),
        });
        nodeIdToPath.set(id, item.path);
        filesToFetch.push({ path: item.path, asDataUrl: isViewable });
      }
    }
  }

  for (const item of sortedItems) {
    const node = nodeMap.get(item.path);
    if (!node) continue;

    const segments = item.path.split('/');
    if (segments.length === 1) {
      rootNodes.push(node);
    } else {
      const parentPath = segments.slice(0, -1).join('/');
      const parent = nodeMap.get(parentPath);
      if (parent && parent.type === 'folder') {
        parent.children!.push(node);
      }
    }
  }

  return { rootNodes, filesToFetch, nodeIdToPath };
};

const attachContentToTree = (
  rootNodes: FileNode[],
  contentMap: Map<string, string>,
  nodeIdToPath: Map<string, string>
): void => {
  const attach = (nodes: FileNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'file' && node.content === undefined) {
        const path = nodeIdToPath.get(node.id);
        if (path !== undefined) {
          const content = contentMap.get(path);
          if (content !== undefined) {
            node.content = content;
          }
        }
      } else if (node.type === 'folder' && node.children) {
        attach(node.children);
      }
    }
  };
  attach(rootNodes);
};

const fetchContentsBatch = async (
  owner: string,
  repo: string,
  branch: string,
  items: { path: string; asDataUrl: boolean }[],
  onProgress: (msg: string) => void,
  total: number,
  token?: string,
  signal?: AbortSignal
): Promise<{ contentMap: Map<string, string>; failed: string[] }> => {
  const contentMap = new Map<string, string>();
  const failed: string[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += CONCURRENT_FETCH_LIMIT) {
    const batch = items.slice(i, i + CONCURRENT_FETCH_LIMIT);
    const promises = batch.map(async (item) => {
      try {
        const content = await fetchFileContent(owner, repo, item.path, branch, item.asDataUrl, token, signal);
        return { path: item.path, content };
      } catch {
        return { path: item.path, error: true as const };
      }
    });

    const batchResults = await Promise.all(promises);
    for (const result of batchResults) {
      if ('error' in result) {
        failed.push(result.path);
      } else {
        contentMap.set(result.path, result.content);
      }
    }

    completed += batch.length;
    const lastName = batch[batch.length - 1]?.path.split('/').pop() || '';
    onProgress(`Fetching files (${Math.min(completed, total)}/${total}): ${lastName}...`);
  }

  return { contentMap, failed };
};

export const useGitHubImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\s#?]+)/,
      /^([^\/]+)\/([^\/\s#?]+)$/,
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

  const fetchRepoInfo = async (
    owner: string,
    repo: string,
    token?: string,
    signal?: AbortSignal
  ): Promise<GitHubRepo | null> => {
    const headers = buildAuthHeaders(token);
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      signal,
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Repository not found. Make sure it exists and is public.');
      }
      throw new Error(`Failed to fetch repository: ${response.statusText}`);
    }
    return await response.json();
  };

  const importRepository = useCallback(async (urlOrPath: string, token?: string): Promise<FileNode[] | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

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
      const repoInfo = await fetchRepoInfo(owner, repo, token, signal);
      if (!repoInfo) {
        throw new Error('Could not fetch repository information');
      }

      const branch = repoInfo.default_branch;

      setImportProgress('Fetching file tree...');
      const treeItems = await fetchFileTree(owner, repo, branch, token, signal);

      setImportProgress('Building file tree...');
      const { rootNodes, filesToFetch, nodeIdToPath } = buildTreeFromFlatList(treeItems);

      let failedFiles: string[] = [];
      if (filesToFetch.length > 0) {
        setImportProgress(`Fetching ${filesToFetch.length} files...`);
        const { contentMap, failed } = await fetchContentsBatch(
          owner, repo, branch, filesToFetch, setImportProgress, filesToFetch.length, token, signal
        );
        failedFiles = failed;
        attachContentToTree(rootNodes, contentMap, nodeIdToPath);
      }

      const rootNode: FileNode = {
        id: 'root',
        name: repoInfo.name,
        type: 'folder',
        children: rootNodes,
      };

      if (failedFiles.length > 0) {
        setImportProgress(`Import complete with ${failedFiles.length} file(s) skipped.`);
      } else {
        setImportProgress('Import complete!');
      }
      return [rootNode];

    } catch (err) {
      if (signal.aborted) return null;
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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
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
