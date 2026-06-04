export type DeploymentPlatform = 'replit' | 'lovable' | 'generic' | 'github_codespaces' | 'github_pages';

const REPLIT_HOST_PATTERNS = ['.replit.dev', '.repl.co', '.replit.app'];
const LOVABLE_HOST_PATTERNS = ['.lovable.app', '.lovable.dev'];
// Railway and custom domains that point to a long-running Node server with pty support.
// Same architecture as Replit (server + WS /api/replit/pty), so map them to 'replit'.
const REPLIT_LIKE_HOST_PATTERNS = ['.up.railway.app', '.railway.app', '.codecanvas.app'];

const getHostPlatform = (host: string): DeploymentPlatform | null => {
  const normalizedHost = host.toLowerCase();

  // Lovable preview hosts can be embedded cross-origin and trigger OAuth postMessage origin errors.
  // Treat them as generic unless explicitly overridden by env.
  if (normalizedHost.includes('preview--') && normalizedHost.endsWith('.lovable.app')) {
    return 'generic';
  }

  if (REPLIT_HOST_PATTERNS.some((pattern) => normalizedHost.endsWith(pattern))) {
    return 'replit';
  }

  if (REPLIT_LIKE_HOST_PATTERNS.some((pattern) => normalizedHost.endsWith(pattern))) {
    return 'replit';
  }

  if (LOVABLE_HOST_PATTERNS.some((pattern) => normalizedHost.endsWith(pattern))) {
    return 'lovable';
  }

  if (normalizedHost.endsWith('.github.io')) {
    return 'github_pages';
  }

  return null;
};

export const detectDeploymentPlatform = (): DeploymentPlatform => {
  const explicit = import.meta.env.VITE_DEPLOY_PLATFORM as string | undefined;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const hostDetected = host ? getHostPlatform(host) : null;

  // Railway/custom server deployments must win over a stale build-time
  // VITE_DEPLOY_PLATFORM=lovable; otherwise OAuth uses Lovable's broker and
  // fails with "Unsupported provider: missing OAuth secret" outside Lovable.
  if (hostDetected && hostDetected !== 'lovable') return hostDetected;

  if (explicit === 'replit' || explicit === 'lovable' || explicit === 'generic' || explicit === 'github_codespaces' || explicit === 'github_pages') {
    return explicit;
  }

  if (hostDetected) return hostDetected;

  if (import.meta.env.VITE_REPLIT_AUTH_ENABLED === 'true') {
    return 'replit';
  }

  if (import.meta.env.VITE_LOVABLE_AUTH_ENABLED === 'true') {
    return 'lovable';
  }

  return 'generic';
};

export const isReplitLikePlatform = (platform?: DeploymentPlatform): boolean => {
  const p = platform || detectDeploymentPlatform();
  return p === 'replit' || p === 'github_codespaces';
};
