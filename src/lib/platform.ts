export type DeploymentPlatform = 'replit' | 'lovable' | 'generic' | 'github_codespaces' | 'github_pages' | 'discord';

const REPLIT_HOST_PATTERNS = ['.replit.dev', '.repl.co', '.replit.app'];
const LOVABLE_HOST_PATTERNS = ['.lovable.app', '.lovable.dev'];
// Railway and custom domains that point to a long-running Node server with pty support.
// Same architecture as Replit (server + WS /api/replit/pty), so map them to 'replit'.
const REPLIT_LIKE_HOST_PATTERNS = ['.up.railway.app', '.railway.app', '.codecanvas.app'];

const hostMatches = (host: string, pattern: string) =>
  host === pattern.slice(1) || host.endsWith(pattern);

const getHostPlatform = (host: string): DeploymentPlatform | null => {
  const normalizedHost = host.toLowerCase();

  if (REPLIT_HOST_PATTERNS.some((pattern) => hostMatches(normalizedHost, pattern))) {
    return 'replit';
  }

  if (REPLIT_LIKE_HOST_PATTERNS.some((pattern) => hostMatches(normalizedHost, pattern))) {
    return 'replit';
  }

  if (LOVABLE_HOST_PATTERNS.some((pattern) => hostMatches(normalizedHost, pattern))) {
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

  // Concrete runtime hosts must win over stale build-time VITE_DEPLOY_PLATFORM.
  // Otherwise Lovable hosts can accidentally use direct /authorize OAuth and
  // Railway/custom server deployments can miss the real pty-backed terminal.
  if (hostDetected) return hostDetected;

  if (explicit === 'replit' || explicit === 'lovable' || explicit === 'generic' || explicit === 'github_codespaces' || explicit === 'github_pages') {
    return explicit;
  }

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
