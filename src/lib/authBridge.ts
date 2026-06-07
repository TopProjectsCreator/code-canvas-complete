import { supabase } from '@/integrations/supabase/client';

export const BRIDGE_ORIGIN =
  (import.meta.env.VITE_AUTH_BRIDGE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://replitclone.lovable.app';

export const BRIDGE_HOST = (() => {
  try {
    return new URL(BRIDGE_ORIGIN).hostname.toLowerCase();
  } catch {
    return 'replitclone.lovable.app';
  }
})();

const STATE_KEY = 'auth-bridge:state';
const RETURN_KEY = 'auth-bridge:return';
const INTENDED_KEY = 'auth-bridge:intended-path';

export const randomState = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const isHostAllowed = async (host: string): Promise<boolean> => {
  const normalized = host.toLowerCase();
  // Bridge host is always allowed.
  if (normalized === BRIDGE_HOST) return true;
  try {
    const { data, error } = await supabase
      .from('allowed_oauth_return_hosts')
      .select('host')
      .eq('host', normalized)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
};

export const validateReturnUrl = async (raw: string | null): Promise<URL | null> => {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // Only allow http for localhost (dev convenience).
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    return null;
  }
  const allowed = await isHostAllowed(url.hostname);
  return allowed ? url : null;
};

export const stashOutbound = (state: string, returnUrl: string, intendedPath?: string) => {
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_KEY, returnUrl);
    if (intendedPath) sessionStorage.setItem(INTENDED_KEY, intendedPath);
  } catch {
    // ignore
  }
};

export const readOutbound = (): { state: string | null; returnUrl: string | null; intendedPath: string | null } => {
  try {
    return {
      state: sessionStorage.getItem(STATE_KEY),
      returnUrl: sessionStorage.getItem(RETURN_KEY),
      intendedPath: sessionStorage.getItem(INTENDED_KEY),
    };
  } catch {
    return { state: null, returnUrl: null, intendedPath: null };
  }
};

export const clearOutbound = () => {
  try {
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    sessionStorage.removeItem(INTENDED_KEY);
  } catch {
    // ignore
  }
};

export const buildHashHandoff = (params: {
  accessToken: string;
  refreshToken: string;
  state?: string | null;
  type?: string | null;
  expiresIn?: number | null;
}): string => {
  const search = new URLSearchParams();
  search.set('access_token', params.accessToken);
  search.set('refresh_token', params.refreshToken);
  search.set('token_type', 'bearer');
  if (params.expiresIn != null) search.set('expires_in', String(params.expiresIn));
  if (params.state) search.set('state', params.state);
  if (params.type) search.set('type', params.type);
  return `#${search.toString()}`;
};
