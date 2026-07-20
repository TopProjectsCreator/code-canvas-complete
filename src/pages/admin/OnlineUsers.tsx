import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldOff, User as UserIcon, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PresenceMeta {
  user_id: string;
  email?: string;
  display_name?: string;
  online_at?: string;
  path?: string;
}

type AppRole = 'admin' | 'user';
const ALL_ROLES: AppRole[] = ['admin', 'user'];

export default function OnlineUsers() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [online, setOnline] = useState<Record<string, PresenceMeta>>({});
  const [roles, setRoles] = useState<Record<string, Set<AppRole>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Join presence channel to observe all online users.
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase.channel('online-users', {
      config: { presence: { key: user?.id ?? 'admin-observer' } },
    });

    const sync = () => {
      const state = channel.presenceState<PresenceMeta>();
      const flat: Record<string, PresenceMeta> = {};
      for (const key of Object.keys(state)) {
        const metas = state[key];
        if (metas && metas.length) flat[key] = metas[metas.length - 1];
      }
      setOnline(flat);
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({
            user_id: user.id,
            email: user.email,
            display_name: 'Admin',
            online_at: new Date().toISOString(),
            path: window.location.pathname,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, user?.id]);

  const userIds = useMemo(() => Object.keys(online), [online]);

  // Load roles for currently-online users.
  useEffect(() => {
    if (!isAdmin || userIds.length === 0) return;
    let cancelled = false;
    supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, Set<AppRole>> = {};
        for (const r of data) {
          const set = map[r.user_id] ?? new Set<AppRole>();
          set.add(r.role as AppRole);
          map[r.user_id] = set;
        }
        setRoles(map);
      });
    return () => { cancelled = true; };
  }, [isAdmin, userIds.join(',')]);

  const toggleRole = async (targetUserId: string, role: AppRole, hasIt: boolean) => {
    setBusy(`${targetUserId}:${role}`);
    try {
      if (hasIt) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', targetUserId)
          .eq('role', role);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: targetUserId, role });
        if (error) throw error;
      }
      setRoles((prev) => {
        const next = { ...prev };
        const set = new Set(next[targetUserId] ?? []);
        if (hasIt) set.delete(role); else set.add(role);
        next[targetUserId] = set;
        return next;
      });
      toast({ title: 'Roles updated' });
    } catch (e) {
      toast({
        title: 'Failed to update role',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">You must sign in to access this page.</p>
        <Link to="/" className="underline">Go home</Link>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldOff className="w-5 h-5" /> Admins only
        </div>
      </div>
    );
  }

  const entries = Object.values(online).sort((a, b) =>
    (a.display_name || a.email || '').localeCompare(b.display_name || b.email || '')
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Wifi className="w-6 h-6 text-primary" /> Online Users
          </h1>
          <p className="text-sm text-muted-foreground">
            Live presence across the app. Toggle roles to change a user's permissions instantly.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          {entries.length} online
        </Badge>
      </header>

      {entries.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No users are online right now.
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const userRoles = roles[entry.user_id] ?? new Set<AppRole>();
            const isSelf = entry.user_id === user.id;
            return (
              <Card key={entry.user_id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {entry.display_name || entry.email || entry.user_id}
                      </span>
                      {isSelf && <Badge variant="secondary" className="text-[10px]">you</Badge>}
                      {userRoles.has('admin') && (
                        <Badge className="gap-1"><Shield className="w-3 h-3" /> admin</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {entry.email} · {entry.path || '/'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {ALL_ROLES.map((role) => {
                    const has = userRoles.has(role);
                    const key = `${entry.user_id}:${role}`;
                    return (
                      <label key={role} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={has}
                          disabled={busy === key || (isSelf && role === 'admin')}
                          onCheckedChange={() => toggleRole(entry.user_id, role, has)}
                        />
                        <span className="capitalize">{role}</span>
                      </label>
                    );
                  })}
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/profile/${entry.user_id}`}>Profile</Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Note: you cannot remove your own admin role here — do that from the database if needed to avoid locking yourself out.
      </p>
    </div>
  );
}
