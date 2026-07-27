import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { acquirePresence } from '@/lib/onlineUsersPresence';

/**
 * Joins the global "online-users" presence channel while the user is signed in.
 * Mount once (e.g., in App) to advertise this session to admins.
 */
export function usePresenceTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const release = acquirePresence(user.id, {
      user_id: user.id,
      email: user.email,
      display_name:
        (user.user_metadata as { display_name?: string })?.display_name ||
        user.email?.split('@')[0] ||
        'User',
      online_at: new Date().toISOString(),
      path: window.location.pathname,
    });
    return release;
  }, [user?.id]);
}
