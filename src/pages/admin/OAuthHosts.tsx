import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';

interface HostRow {
  host: string;
  note: string | null;
  created_at: string;
}

const OAuthHostsAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<HostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!error && !!data);
    })();
  }, [user, authLoading]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('allowed_oauth_return_hosts')
      .select('host, note, created_at')
      .order('host');
    setLoading(false);
    if (error) {
      toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((data || []) as HostRow[]);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!normalized) return;
    setAdding(true);
    const { error } = await supabase
      .from('allowed_oauth_return_hosts')
      .insert({ host: normalized, note: note || null });
    setAdding(false);
    if (error) {
      toast({ title: 'Failed to add', description: error.message, variant: 'destructive' });
      return;
    }
    setHost('');
    setNote('');
    await refresh();
  };

  const handleDelete = async (h: string) => {
    if (!confirm(`Remove ${h} from allowlist?`)) return;
    const { error } = await supabase.from('allowed_oauth_return_hosts').delete().eq('host', h);
    if (error) {
      toast({ title: 'Failed to remove', description: error.message, variant: 'destructive' });
      return;
    }
    await refresh();
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <p className="text-sm text-muted-foreground">
            You need the admin role to manage the OAuth return host allowlist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">OAuth return host allowlist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hosts on this list can receive auth tokens from the bridge at <code>{window.location.origin}</code>.
          </p>
        </div>

        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="host">Host</Label>
            <Input
              id="host"
              placeholder="myapp.up.railway.app"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              placeholder="What is this host?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={adding}>
            {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add
          </Button>
        </form>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Host</th>
                <th className="text-left px-4 py-2 font-medium">Note</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No hosts yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.host} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{r.host}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.note || '—'}</td>
                  <td className="px-2 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(r.host)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OAuthHostsAdmin;
