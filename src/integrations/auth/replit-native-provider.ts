import type { Session, User } from '@supabase/supabase-js';
import type { AuthProvider } from './provider';

interface ReplitUser {
  id: string;
  name: string;
  roles: string[];
  profileImage?: string;
}

type AuthStateCallback = (event: string, session: Session | null) => void;

const STORAGE_KEY = 'replit_auth_user';
const listeners: AuthStateCallback[] = [];

function makeSession(replitUser: ReplitUser): Session {
  const now = Math.floor(Date.now() / 1000);
  const user: User = {
    id: replitUser.id,
    email: `${replitUser.name}@replit.user`,
    user_metadata: {
      display_name: replitUser.name,
      avatar_url: replitUser.profileImage,
    },
    app_metadata: { provider: 'replit', roles: replitUser.roles },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    role: 'authenticated',
  };
  return {
    user,
    access_token: `replit-${replitUser.id}`,
    refresh_token: `replit-refresh-${replitUser.id}`,
    expires_in: 60 * 60 * 24,
    expires_at: now + 60 * 60 * 24,
    token_type: 'bearer',
  };
}

function notifyListeners(event: string, session: Session | null) {
  for (const cb of listeners) cb(event, session);
}

async function fetchReplitUser(): Promise<ReplitUser | null> {
  try {
    const res = await fetch('/api/replit/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Decode the JWT payload sent by Replit's auth_with_repl_site callback.
 * We read user info directly from the token — no signature verification
 * needed client-side; the server validates the x-replit-user-* headers.
 */
function decodeReplitToken(token: string): ReplitUser | null {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    if (!payload.sub || !payload.name) return null;
    return {
      id: String(payload.sub),
      name: String(payload.name),
      roles: payload.roles ? String(payload.roles).split(',').filter(Boolean) : [],
      profileImage: payload.profile_image ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * If the page loaded on the /__replauth callback path, extract the token,
 * store the session, and redirect to the app root so the user lands on a
 * real page after sign-in.
 */
function handleAuthCallbackIfNeeded(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname !== '/__replauth') return false;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (token) {
    const replitUser = decodeReplitToken(token);
    if (replitUser) {
      const session = makeSession(replitUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      cachedSession = session;
      initialized = true;
      notifyListeners('SIGNED_IN', session);
    }
  }

  // Redirect to app root regardless — don't leave the user on /__replauth
  window.location.replace('/');
  return true;
}

let cachedSession: Session | null = null;
let initialized = false;

async function init() {
  if (initialized) return cachedSession;

  // Handle the /__replauth callback first (full-page redirect flow)
  if (handleAuthCallbackIfNeeded()) {
    // Page is about to redirect; return whatever we have
    return cachedSession;
  }

  initialized = true;

  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    try {
      cachedSession = JSON.parse(stored);
    } catch {
      cachedSession = null;
    }
  }

  const replitUser = await fetchReplitUser();
  if (replitUser) {
    cachedSession = makeSession(replitUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSession));
    notifyListeners('SIGNED_IN', cachedSession);
  } else if (cachedSession) {
    const recheck = await fetchReplitUser();
    if (!recheck) {
      cachedSession = null;
      localStorage.removeItem(STORAGE_KEY);
      notifyListeners('SIGNED_OUT', null);
    }
  }

  return cachedSession;
}

export const replitNativeProvider: AuthProvider = {
  platform: 'replit',

  async getSession() {
    const session = await init();
    return { session, error: null };
  },

  onAuthStateChange(callback) {
    listeners.push(callback);
    init().then((session) => {
      callback('INITIAL_SESSION', session);
    });
    return {
      unsubscribe: () => {
        const idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
      },
    };
  },

  async signUp(email, password, displayName) {
    void email; void password; void displayName;
    return { error: new Error('Sign up is not supported with Replit auth. Use "Continue with Replit" to sign in.') };
  },

  async signIn(email, password) {
    void email; void password;
    return { error: new Error('Email sign-in is not supported with Replit auth. Use "Continue with Replit" to sign in.') };
  },

  async signOut() {
    cachedSession = null;
    initialized = false;
    localStorage.removeItem(STORAGE_KEY);
    notifyListeners('SIGNED_OUT', null);
  },

  async resetPassword(email) {
    void email;
    return { error: new Error('Password reset is not supported with Replit auth.') };
  },

  async getCurrentUser() {
    const session = await init();
    return { user: session?.user ?? null, error: null };
  },

  availableOAuthProviders: ['replit'],

  async signInWithOAuth(provider) {
    if (provider === 'replit') {
      window.location.href = '/api/replit/auth';
      return { error: null };
    }
    return { error: new Error(`Provider "${provider}" is not supported on Replit.`) };
  },
};
