import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LandingStats {
  totalUsers: number;
  onlineUsers: number;
  totalCanvases: number;
}

export function useLandingStats() {
  const [stats, setStats] = useState<LandingStats>({ totalUsers: 0, onlineUsers: 0, totalCanvases: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const [profilesRes, projectsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('projects').select('id', { count: 'exact', head: true }),
        ]);

        if (cancelled) return;

        const totalUsers = profilesRes.count ?? 0;
        const totalCanvases = projectsRes.count ?? 0;

        // Track online presence via a channel
        const channel = supabase.channel('landing-presence', {
          config: { presence: { key: 'anon-' + Math.random().toString(36).slice(2) } },
        });

        channel
          .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const online = Object.keys(state).length;
            setStats(prev => ({ ...prev, onlineUsers: Math.max(online, 1) }));
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await channel.track({ online_at: new Date().toISOString() });
            }
          });

        setStats({ totalUsers, onlineUsers: 1, totalCanvases });
        setLoading(false);

        return () => {
          channel.unsubscribe();
        };
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    let cleanup: (() => void) | undefined;
    fetchStats().then(fn => { cleanup = fn; });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return { stats, loading };
}
