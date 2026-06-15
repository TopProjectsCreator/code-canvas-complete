import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { createAuthProvider, OAuthProvider } from '@/integrations/auth/provider';
import { DeploymentPlatform } from '@/lib/platform';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deletion_scheduled_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  platform: DeploymentPlatform;
  availableOAuthProviders: OAuthProvider[];
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => Promise<{ error: Error | null }>;
  scheduleDeletion: (password: string) => Promise<{ error: Error | null; scheduledDeletion: string | null }>;
  cancelDeletion: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      session: null,
      profile: null,
      loading: true,
      platform: 'generic',
      availableOAuthProviders: [] as OAuthProvider[],
      signUp: async () => ({ error: new Error('Auth is not ready') }),
      signIn: async () => ({ error: new Error('Auth is not ready') }),
      signInWithOAuth: async (_provider: OAuthProvider) => ({ error: new Error('Auth is not ready') }),
      resetPassword: async () => ({ error: new Error('Auth is not ready') }),
      signOut: async () => {},
      updateProfile: async () => ({ error: new Error('Auth is not ready') }),
      scheduleDeletion: async () => ({ error: new Error('Auth is not ready'), scheduledDeletion: null }),
      cancelDeletion: async () => ({ error: new Error('Auth is not ready') }),
    };
  }
  return context;
};

export const useOptionalAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const authProvider = useMemo(() => createAuthProvider(), []);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = authProvider.onAuthStateChange(async (event, nextSession) => {
      try {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', nextSession.user.id)
            .single();

          const pd = profileData as Profile | null;

          // Auto-cancel scheduled deletion on explicit sign-in
          if (event === 'SIGNED_IN' && pd?.deletion_scheduled_at) {
            await supabase
              .from('profiles')
              .update({ deletion_scheduled_at: null } as never)
              .eq('user_id', nextSession.user.id);
            pd.deletion_scheduled_at = null;
          }

          setProfile(pd);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } finally {
        setLoading(false);
      }
    });

    authProvider.getSession().then(({ session: initialSession }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', initialSession.user.id)
          .single()
          .then(
            (result: any) => {
              setProfile(result.data as Profile | null);
              setLoading(false);
            },
            (err: unknown) => {
              console.error('Failed to fetch profile:', err);
              setLoading(false);
            }
          );
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Failed to get session:', err);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [authProvider]);

  const signOut = async () => {
    await authProvider.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, ...updates });
    }

    return { error };
  };

  const scheduleDeletion = async (password: string) => {
    if (!user) return { error: new Error('No user logged in'), scheduledDeletion: null as string | null };

    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { password },
    });

    if (error) return { error: new Error(error.message), scheduledDeletion: null };
    if (data?.error) return { error: new Error(data.error), scheduledDeletion: null };

    if (data?.scheduledDeletion && profile) {
      setProfile({ ...profile, deletion_scheduled_at: data.scheduledDeletion });
    }

    return { error: null, scheduledDeletion: data?.scheduledDeletion ?? null };
  };

  const cancelDeletion = async () => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update({ deletion_scheduled_at: null } as never)
      .eq('user_id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, deletion_scheduled_at: null });
    }

    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        platform: authProvider.platform,
        availableOAuthProviders: authProvider.availableOAuthProviders,
        signUp: authProvider.signUp,
        signIn: authProvider.signIn,
        signInWithOAuth: authProvider.signInWithOAuth,
        resetPassword: authProvider.resetPassword,
        signOut,
        updateProfile,
        scheduleDeletion,
        cancelDeletion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
