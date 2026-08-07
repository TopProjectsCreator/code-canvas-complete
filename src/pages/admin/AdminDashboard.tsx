import { useEffect, useState } from 'react';
import { Link, Navigate } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AppWindow, Users, MessagesSquare, FolderGit2, ShieldCheck, ArrowRight, BarChart3 } from 'lucide-react';

interface Stats {
  apps: number;
  approvedApps: number;
  pendingApps: number;
  projects: number;
  threads: number;
  admins: number;
}

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const [apps, approved, pending, projects, threads, admins] = await Promise.all([
        supabase.from('allowed_oauth_return_hosts').select('host', { count: 'exact', head: true }),
        supabase.from('allowed_oauth_return_hosts').select('host', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('allowed_oauth_return_hosts').select('host', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('threads').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      ]);
      if (cancelled) return;
      setStats({
        apps: apps.count || 0,
        approvedApps: approved.count || 0,
        pendingApps: pending.count || 0,
        projects: projects.count || 0,
        threads: threads.count || 0,
        admins: admins.count || 0,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-2">Admin</h1>
        <p className="text-muted-foreground">You don't have admin access.</p>
      </div>
    );
  }

  const tiles = [
    { to: '/admin/oauth-hosts', icon: AppWindow, title: 'OAuth Apps', desc: 'Manage app icons, names, descriptions, and approvals.', badge: stats ? `${stats.approvedApps} approved · ${stats.pendingApps} pending` : '' },
    { to: '/admin/online-users', icon: Users, title: 'Online Users', desc: 'See who is online and manage roles in realtime.', badge: stats ? `${stats.admins} admins` : '' },
    { to: '/threads', icon: MessagesSquare, title: 'Community Threads', desc: 'Pin threads, manage categories, moderate content.', badge: stats ? `${stats.threads} threads` : '' },
    { to: '/admin/usage', icon: BarChart3, title: 'Usage Analytics', desc: 'Charts and graphs of platform activity, projects, threads, and AI usage.', badge: '' },
    { to: '/oauth-apps', icon: FolderGit2, title: 'Public App Directory', desc: 'View the public-facing OAuth apps page.', badge: '' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="OAuth Apps" value={stats?.apps} loading={loading} />
          <StatCard label="Projects" value={stats?.projects} loading={loading} />
          <StatCard label="Threads" value={stats?.threads} loading={loading} />
          <StatCard label="Admins" value={stats?.admins} loading={loading} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {tiles.map(t => (
            <Link key={t.to} to={t.to} className="group">
              <Card className="h-full transition-colors hover:border-primary/60">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center">
                    <t.icon className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base flex-1">{t.title}</CardTitle>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                  {t.badge && <p className="text-xs text-muted-foreground/80">{t.badge}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) => (
  <Card>
    <CardContent className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : value ?? 0}
      </div>
    </CardContent>
  </Card>
);

export default AdminDashboard;
