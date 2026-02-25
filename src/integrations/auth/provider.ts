import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { DeploymentPlatform, detectDeploymentPlatform } from '@/lib/platform';

export type OAuthProvider = 'google' | 'replit';

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
  async signUp(email: string, password: string, displayName?: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });
    return { error };
  },
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error };
  },
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error: error ?? null };
  },
};

const supabaseProvider: AuthProvider = {
  platform: 'generic',
  ...common,
  availableOAuthProviders: ['google'],
  async signInWithOAuth(provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error };
  },
};

const lovableProvider: AuthProvider = {
  platform: 'lovable',
  ...common,
  availableOAuthProviders: ['google'],
  async signInWithOAuth(provider) {
    if (provider !== 'google') {
      return { error: new Error(`Provider ${provider} is not available on Lovable auth`) };
    }

    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });

    return { error: result.error ?? null };
  },
};

const replitProvider: AuthProvider = {
  platform: 'replit',
  ...common,
  availableOAuthProviders: ['replit', 'google'],
  async signInWithOAuth(provider) {
    const resolvedProvider = provider === 'replit' ? 'replit' : 'google';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: resolvedProvider as 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error };
  },
};

export const createAuthProvider = (): AuthProvider => {
  const platform = detectDeploymentPlatform();

  if (platform === 'lovable') return lovableProvider;
  if (platform === 'replit') return replitProvider;

  return supabaseProvider;
};
