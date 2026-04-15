import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Loader2, Brain, Sparkles, Zap, FileCode, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsageStat {
  label: string;
  icon: React.ReactNode;
  count: number;
  color: string;
}

export function AIUsageStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Load stats from localStorage (session-scoped tracking)
    const raw = localStorage.getItem(`ai_usage_stats_${user.id}`);
    const data = raw ? JSON.parse(raw) : {};

    const built: UsageStat[] = [
      { label: 'Pro AI Requests', icon: <Brain className="w-4 h-4" />, count: data.pro || 0, color: 'text-purple-500' },
      { label: 'Flash AI Requests', icon: <Zap className="w-4 h-4" />, count: data.flash || 0, color: 'text-amber-500' },
      { label: 'Lite AI Requests', icon: <Sparkles className="w-4 h-4" />, count: data.lite || 0, color: 'text-green-500' },
      { label: 'BYOK AI Requests', icon: <Brain className="w-4 h-4" />, count: data.byok || 0, color: 'text-blue-500' },
      { label: 'Code Changes Applied', icon: <FileCode className="w-4 h-4" />, count: data.code_changes || 0, color: 'text-cyan-500' },
      { label: 'Widgets Used', icon: <LayoutGrid className="w-4 h-4" />, count: data.widgets || 0, color: 'text-pink-500' },
      { label: 'Images Generated', icon: <Sparkles className="w-4 h-4" />, count: data.images || 0, color: 'text-indigo-500' },
      { label: 'Music Generated', icon: <Sparkles className="w-4 h-4" />, count: data.music || 0, color: 'text-rose-500' },
    ];

    setStats(built);
    setLoading(false);
  }, [user]);

  const total = useMemo(() => stats.reduce((sum, s) => sum + s.count, 0), [stats]);
  const maxCount = useMemo(() => Math.max(...stats.map(s => s.count), 1), [stats]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">Sign in to view usage stats</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-1 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          Session Usage Stats
        </h4>
        <p className="text-xs text-muted-foreground">
          Total interactions this session: <span className="font-medium text-foreground">{total}</span>
        </p>
      </div>

      <div className="space-y-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3">
            <div className={cn("shrink-0", stat.color)}>{stat.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs truncate">{stat.label}</span>
                <span className="text-xs font-medium tabular-nums">{stat.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", 
                    stat.color.replace('text-', 'bg-')
                  )}
                  style={{ width: `${Math.max((stat.count / maxCount) * 100, stat.count > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Stats are tracked per session in your browser. Use BYOK keys for unlimited AI access.
      </p>
    </div>
  );
}

// Helper to increment a stat from anywhere
export function trackAIUsage(userId: string, key: string, amount = 1) {
  const storageKey = `ai_usage_stats_${userId}`;
  const raw = localStorage.getItem(storageKey);
  const data = raw ? JSON.parse(raw) : {};
  data[key] = (data[key] || 0) + amount;
  localStorage.setItem(storageKey, JSON.stringify(data));
}
