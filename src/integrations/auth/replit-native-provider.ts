import type { AuthProvider } from './provider';

interface ReplitUser {
  id: string;
  name: string;
  roles: string[];
}

type AuthStateCallback = (event: string, session: SyntheticSession | null) => void;

interface SyntheticSession {
  user: SyntheticUser;
  access_token: string;
}

interface SyntheticUser {
  id: string;
  email: string;
  user_metadata: { display_name: string; avatar_url?: string };
  app_metadata: Record<string, unknown>;
  aud: string;
  created_at: string;
  role: string;
}

const STORAGE_KEY = 'replit_auth_user';
const listeners: AuthStateCallback[] = [];

function makeSession(replitUser: ReplitUser): SyntheticSession {
  const user: SyntheticUser = {
    id: replitUser.id,
    email: `${replitUser.name}@replit.user`,
    user_metadata: { display_name: replitUser.name },
    app_metadata: { provider: 'replit', roles: replitUser.roles },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    role: 'authenticated',
  };
  return { user, access_token: `replit-${replitUser.id}` };
}

function notifyListeners(event: string, session: SyntheticSession | null) {
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

let cachedSession: SyntheticSession | null = null;
let initialized = false;

async function init() {
  if (initialized) return cachedSession;
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
    return { session: session as never, error: null };
  },

  onAuthStateChange(callback) {
    listeners.push(callback as AuthStateCallback);
    init().then((session) => {
      callback('INITIAL_SESSION', session as never);
    });
    return {
      unsubscribe: () => {
        const idx = listeners.indexOf(callback as AuthStateCallback);
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
    return { user: session?.user as never ?? null, error: null };
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
