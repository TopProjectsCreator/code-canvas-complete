import { useEffect, useState } from 'react';
import { Navigate, Link } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, TrendingUp, Users, MessagesSquare, FolderGit2, Sparkles, Star } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DailyRow = { date: string; count: number };
type UsageByModel = { tier: string; requests: number };
type CategoryRow = { name: string; value: number };

interface UsageData {
  projectsByDay: DailyRow[];
  threadsByDay: DailyRow[];
  usersByDay: DailyRow[];
  aiByDay: DailyRow[];
  aiByTier: UsageByModel[];
  threadsByCategory: CategoryRow[];
  totals: {
    projects: number;
    threads: number;
    users: number;
    aiRequests: number;
    stars: number;
    comments: number;
  };
}

const DAYS = 30;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const buildRange = (days: number): DailyRow[] => {
  const rows: DailyRow[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    rows.push({ date: dayKey(d), count: 0 });
  }
  return rows;
};

const bucketByDay = (rows: { created_at: string }[] | null, days: number): DailyRow[] => {
  const range = buildRange(days);
  const map = new Map(range.map((r) => [r.date, r]));
  for (const r of rows || []) {
    const key = r.created_at.slice(0, 10);
    const bucket = map.get(key);
    if (bucket) bucket.count += 1;
  }
  return range;
};

const COLORS = ['hsl(var(--primary))', '#60a5fa', '#f59e0b', '#ef4444', '#10b981', '#a78bfa', '#ec4899', '#14b8a6'];

const UsageAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - (DAYS - 1));
      since.setUTCHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();
      const sinceDate = dayKey(since);

      try {
        const [
          projectsRes,
          threadsRes,
          profilesRes,
          aiRes,
          starsRes,
          commentsRes,
          categoriesRes,
          totalsProjects,
          totalsThreads,
          totalsUsers,
          totalsStars,
          totalsComments,
        ] = await Promise.all([
          supabase.from('projects').select('created_at').gte('created_at', sinceIso),
          supabase.from('threads').select('created_at, category').gte('created_at', sinceIso),
          supabase.from('profiles').select('created_at').gte('created_at', sinceIso),
          supabase
            .from('ai_usage_tracking')
            .select('usage_date, model_tier, request_count')
            .gte('usage_date', sinceDate),
          supabase.from('project_stars').select('created_at').gte('created_at', sinceIso),
          supabase.from('comments').select('created_at').gte('created_at', sinceIso),
          supabase.from('thread_categories').select('name'),
          supabase.from('projects').select('id', { count: 'exact', head: true }),
          supabase.from('threads').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('project_stars').select('id', { count: 'exact', head: true }),
          supabase.from('comments').select('id', { count: 'exact', head: true }),
        ]);

        for (const res of [projectsRes, threadsRes, profilesRes, aiRes, starsRes, commentsRes, categoriesRes]) {
          if (res.error) throw res.error;
        }

        // AI by day (respect request_count) + by tier
        const aiRange = buildRange(DAYS);
        const aiMap = new Map(aiRange.map((r) => [r.date, r]));
        const tierMap = new Map<string, number>();
        for (const row of (aiRes.data as { usage_date: string; model_tier: string; request_count: number }[]) || []) {
          const bucket = aiMap.get(row.usage_date);
          if (bucket) bucket.count += row.request_count || 0;
          tierMap.set(row.model_tier, (tierMap.get(row.model_tier) || 0) + (row.request_count || 0));
        }
        const aiByTier: UsageByModel[] = [...tierMap.entries()]
          .map(([tier, requests]) => ({ tier, requests }))
          .sort((a, b) => b.requests - a.requests);

        // Threads by category
        const catCount = new Map<string, number>();
        for (const t of (threadsRes.data as { category: string | null }[]) || []) {
          const k = t.category || 'uncategorized';
          catCount.set(k, (catCount.get(k) || 0) + 1);
        }
        const threadsByCategory: CategoryRow[] = [...catCount.entries()]
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);

        if (cancelled) return;
        setData({
          projectsByDay: bucketByDay(projectsRes.data as any, DAYS),
          threadsByDay: bucketByDay(threadsRes.data as any, DAYS),
          usersByDay: bucketByDay(profilesRes.data as any, DAYS),
          aiByDay: aiRange,
          aiByTier,
          threadsByCategory,
          totals: {
            projects: totalsProjects.count || 0,
            threads: totalsThreads.count || 0,
            users: totalsUsers.count || 0,
            aiRequests: aiByTier.reduce((a, b) => a + b.requests, 0),
            stars: totalsStars.count || 0,
            comments: totalsComments.count || 0,
          },
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-2">Usage Analytics</h1>
        <p className="text-muted-foreground">You don't have admin access.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
        <header className="flex items-center gap-3">
          <Link
            to="/admin"
            className="w-9 h-9 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Back to admin"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Usage Analytics</h1>
            <p className="text-sm text-muted-foreground">Activity across the platform (last {DAYS} days)</p>
          </div>
        </header>

        {error && (
          <Card className="border-destructive">
            <CardContent className="p-4 text-sm text-destructive">Failed to load analytics: {error}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard icon={FolderGit2} label="Projects" value={data?.totals.projects} loading={loading} />
          <MetricCard icon={MessagesSquare} label="Threads" value={data?.totals.threads} loading={loading} />
          <MetricCard icon={Users} label="Users" value={data?.totals.users} loading={loading} />
          <MetricCard icon={Sparkles} label="AI requests" value={data?.totals.aiRequests} loading={loading} />
          <MetricCard icon={Star} label="Stars" value={data?.totals.stars} loading={loading} />
          <MetricCard icon={TrendingUp} label="Comments" value={data?.totals.comments} loading={loading} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="New projects per day" loading={loading}>
            {data && (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.projectsByDay}>
                  <defs>
                    <linearGradient id="gProjects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip content={<TooltipContent />} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#gProjects)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="New threads per day" loading={loading}>
            {data && (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.threadsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip content={<TooltipContent />} />
                  <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="New user signups per day" loading={loading}>
            {data && (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.usersByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip content={<TooltipContent />} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="AI requests per day" loading={loading}>
            {data && (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.aiByDay}>
                  <defs>
                    <linearGradient id="gAi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip content={<TooltipContent />} />
                  <Area type="monotone" dataKey="count" stroke="#a78bfa" fill="url(#gAi)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="AI requests by model tier" loading={loading}>
            {data && data.aiByTier.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.aiByTier} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis dataKey="tier" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip content={<TooltipContent />} />
                  <Bar dataKey="requests" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart loading={loading} label="No AI usage recorded" />
            )}
          </ChartCard>

          <ChartCard title="Threads by category" loading={loading}>
            {data && data.threadsByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.threadsByCategory}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {data.threadsByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart loading={loading} label="No threads in range" />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

const fmtDate = (v: string) => {
  const d = new Date(v);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  loading: boolean;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (value ?? 0).toLocaleString()}
      </div>
    </CardContent>
  </Card>
);

const ChartCard = ({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="h-[260px] flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

const EmptyChart = ({ loading, label }: { loading: boolean; label: string }) => (
  <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : label}
  </div>
);

export default UsageAnalytics;
