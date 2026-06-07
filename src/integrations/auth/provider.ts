import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { DeploymentPlatform, detectDeploymentPlatform } from '@/lib/platform';
import { BRIDGE_ORIGIN, randomState, stashOutbound } from '@/lib/authBridge';

export type OAuthProvider = 'google' | 'apple' | 'microsoft';

export interface AuthProvider {
  platform: DeploymentPlatform;
  getSession: () => Promise<{ session: Session | null; error: Error | null }>;
  onAuthStateChange: (
    callback: (event: string, session: Session | null) => void
  ) => { unsubscribe: () => void };
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: Error | null }>;
  availableOAuthProviders: OAuthProvider[];
  getCurrentUser: () => Promise<{ user: User | null; error: Error | null }>;
}

const common = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error: error ?? null };
  },
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
    return {
      unsubscribe: () => data.subscription.unsubscribe(),
    };
  },
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error: error ?? null };
  },
};

const lovableProvider: AuthProvider = {
  platform: 'lovable',
  ...common,
  availableOAuthProviders: ['google', 'apple', 'microsoft'],
  async signUp(email, password, displayName) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName || email.split('@')[0] },
      },
    });
    return { error };
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  },
  async signInWithOAuth(provider) {
    if (!['google', 'apple', 'microsoft'].includes(provider)) {
      return { error: new Error(`Provider ${provider} is not available on Lovable auth`) };
    }
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    return { error: result.error ?? null };
  },
};

const buildBridgeUrl = (path: string, params: Record<string, string>): string => {
  const url = new URL(path, BRIDGE_ORIGIN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
};

const bridgedProvider: AuthProvider = {
  platform: detectDeploymentPlatform(),
  ...common,
  availableOAuthProviders: ['google', 'apple', 'microsoft'],
  async signUp(email, password, displayName) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildBridgeUrl('/auth-link', {
          next: `${window.location.origin}/auth-callback`,
        }),
        data: { display_name: displayName || email.split('@')[0] },
      },
    });
    return { error };
  },
  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — we still redirect through the bridge to clear the lovable session
    }
    const logoutUrl = buildBridgeUrl('/auth-logout', {
      return: `${window.location.origin}/`,
    });
    window.location.assign(logoutUrl);
  },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildBridgeUrl('/auth-link', {
        next: `${window.location.origin}/auth-callback`,
        type: 'recovery',
      }),
    });
    return { error };
  },
  async signInWithOAuth(provider) {
    if (!['google', 'apple', 'microsoft'].includes(provider)) {
      return { error: new Error(`Provider ${provider} is not available`) };
    }
    const state = randomState();
    const returnUrl = `${window.location.origin}/auth-callback`;
    const intended = window.location.pathname + window.location.search;
    stashOutbound(state, returnUrl, intended);
    const bridgeUrl = buildBridgeUrl('/auth-bridge', {
      return: returnUrl,
      state,
      provider,
    });
    window.location.assign(bridgeUrl);
    return { error: null };
  },
};

export const createAuthProvider = (): AuthProvider => {
  const platform = detectDeploymentPlatform();
  return platform === 'lovable' ? lovableProvider : bridgedProvider;
};
