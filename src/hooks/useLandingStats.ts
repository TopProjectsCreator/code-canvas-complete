import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LandingStats {
  totalUsers: number;
  onlineUsers: number;
  totalCanvases: number;
  latencyMs: number;
  activeAgents: number;
  totalPrompts: number;
}

export function useLandingStats() {
  const [stats, setStats] = useState<LandingStats>({
    totalUsers: 0,
    onlineUsers: 0,
    totalCanvases: 0,
    latencyMs: 0,
    activeAgents: 0,
    totalPrompts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
    let agentsChannel: ReturnType<typeof supabase.channel> | null = null;
    let latencyTimer: ReturnType<typeof setInterval> | null = null;

    const measureLatency = async () => {
      const start = performance.now();
      try {
        await supabase.rpc('get_total_canvases_count');
        const ms = Math.round(performance.now() - start);
        if (!cancelled) setStats(prev => ({ ...prev, latencyMs: ms }));
      } catch {
        // ignore
      }
    };

    const init = async () => {
      try {
        const [profilesRes, canvasCountRes, promptCountRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.rpc('get_total_canvases_count'),
          supabase.from('prompt_history').select('id', { count: 'exact', head: true }),
        ]);

        if (cancelled) return;

        const totalUsers = profilesRes.count ?? 0;
        const totalCanvases = (canvasCountRes.data as number | null) ?? 0;
        const totalPrompts = promptCountRes.count ?? 0;

        // Presence: online visitors
        presenceChannel = supabase.channel('landing-presence', {
          config: { presence: { key: 'anon-' + Math.random().toString(36).slice(2) } },
        });
        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel!.presenceState();
            const online = Object.keys(state).length;
            setStats(prev => ({ ...prev, onlineUsers: Math.max(online, 1) }));
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel!.track({ online_at: new Date().toISOString() });
            }
          });

        // Presence: active AI agents (joined by useAgentChat while running)
        agentsChannel = supabase.channel('active-ai-agents');
        agentsChannel
          .on('presence', { event: 'sync' }, () => {
            const state = agentsChannel!.presenceState();
            const count = Object.keys(state).length;
            setStats(prev => ({ ...prev, activeAgents: count }));
          })
          .subscribe();

        setStats(prev => ({ ...prev, totalUsers, totalCanvases, totalPrompts, onlineUsers: 1 }));
        setLoading(false);

        // Latency: measure now and every 10s
        measureLatency();
        latencyTimer = setInterval(measureLatency, 10000);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      presenceChannel?.unsubscribe();
      agentsChannel?.unsubscribe();
      if (latencyTimer) clearInterval(latencyTimer);
    };
  }, []);

  return { stats, loading };
}
