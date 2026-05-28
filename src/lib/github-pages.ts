let savedRedirectPath: string | null = null;

export function setGithubPagesRedirectPath(path: string) {
  savedRedirectPath = path;
}

export function getGitHubPagesBasename(): string {
  if (typeof window === 'undefined') return '';
  if (!window.location.hostname.endsWith('.github.io')) return '';

  const script = document.querySelector('script[src*="/assets/"]');
  if (script) {
    const src = script.getAttribute('src');
    if (src) {
      try {
        const resolved = new URL(src, window.location.href).pathname;
        const idx = resolved.indexOf('/assets/');
        if (idx > 0) return resolved.substring(0, idx);
      } catch { }
    }
  }

  if (savedRedirectPath) {
    const parts = savedRedirectPath.split('/').filter(Boolean);
    if (parts.length > 1) return '/' + parts[0];
  }

  return '';
}
