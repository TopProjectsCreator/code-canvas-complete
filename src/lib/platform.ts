export type DeploymentPlatform = 'replit' | 'lovable' | 'generic';

const REPLIT_HOST_PATTERNS = ['.replit.dev', '.repl.co', '.replit.app'];
const LOVABLE_HOST_PATTERNS = ['.lovable.app', '.lovable.dev'];

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

  if (LOVABLE_HOST_PATTERNS.some((pattern) => normalizedHost.endsWith(pattern))) {
    return 'lovable';
  }

  return null;
};

export const detectDeploymentPlatform = (): DeploymentPlatform => {
  const explicit = import.meta.env.VITE_DEPLOY_PLATFORM as string | undefined;
  if (explicit === 'replit' || explicit === 'lovable' || explicit === 'generic') {
    return explicit;
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const hostDetected = host ? getHostPlatform(host) : null;
  if (hostDetected) return hostDetected;

  if (import.meta.env.VITE_REPLIT_AUTH_ENABLED === 'true') {
    return 'replit';
  }

  if (import.meta.env.VITE_LOVABLE_AUTH_ENABLED === 'true') {
    return 'lovable';
  }

  return 'generic';
};
