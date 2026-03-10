const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const PREVIEW_HOST_PATTERN = /^id-preview--[a-f0-9-]+\.lovable\.app$/i;

export const sanitizePublishSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

export const resolvePublishBaseDomain = (host?: string): string => {
  const envBase = import.meta.env.VITE_PUBLISH_BASE_DOMAIN as string | undefined;
  if (envBase) return envBase.trim().toLowerCase();

  const hostname = (host ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (!hostname || LOCAL_HOSTS.has(hostname)) return hostname || 'localhost';

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts.slice(1).join('.');
  }

  return hostname;
};

export const buildPublishedProjectUrl = (publishSlug: string, host?: string): string => {
  const slug = sanitizePublishSlug(publishSlug);
  if (!slug) return '';

  const baseDomain = resolvePublishBaseDomain(host);
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';

  if (!baseDomain || LOCAL_HOSTS.has(baseDomain)) {
    return `${protocol}//${baseDomain || 'localhost'}/project/${slug}`;
  }

  return `${protocol}//${slug}.${baseDomain}`;
};

export const isPublishedHost = (host?: string): boolean => {
  const hostname = (host ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (PREVIEW_HOST_PATTERN.test(hostname)) return false;
  const baseDomain = resolvePublishBaseDomain(hostname);
  return !!(hostname && baseDomain && hostname !== baseDomain && hostname.endsWith(`.${baseDomain}`));
};

export const getPublishSlugFromHost = (host?: string): string | null => {
  const hostname = (host ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  const baseDomain = resolvePublishBaseDomain(hostname);

  if (!hostname || !baseDomain || hostname === baseDomain) return null;
  if (!hostname.endsWith(`.${baseDomain}`)) return null;

  const label = hostname.slice(0, -(baseDomain.length + 1));
  if (!label || label.includes('.')) return null;

  return sanitizePublishSlug(label);
};

export const buildProjectShareUrl = (projectId: string): string =>
  `${window.location.origin}/project/${projectId}`;
