import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Check, X, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HostRow {
  host: string;
  app_name: string;
  logo_url: string | null;
  public_description: string | null;
  admin_notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  owner_id: string | null;
  created_at: string;
}

const normalizeHost = (raw: string) =>
  raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const OAuthHostsAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<HostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ host: '', app_name: '', logo_url: '', public_description: '', admin_notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      const { data } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, authLoading]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('allowed_oauth_return_hosts')
      .select('host, app_name, logo_url, public_description, admin_notes, status, owner_id, created_at')
      .order('status').order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast({ title: 'Failed to load', description: error.message, variant: 'destructive' }); return; }
    setRows((data || []) as HostRow[]);
  };

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const host = normalizeHost(form.host);
    if (!host || !form.app_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('allowed_oauth_return_hosts').insert({
      host,
      app_name: form.app_name.trim(),
      logo_url: form.logo_url.trim() || null,
      public_description: form.public_description.trim() || null,
      admin_notes: form.admin_notes.trim() || null,
      status: 'approved',
      owner_id: user!.id,
    });
    setSaving(false);
    if (error) { toast({ title: 'Failed to add', description: error.message, variant: 'destructive' }); return; }
    setForm({ host: '', app_name: '', logo_url: '', public_description: '', admin_notes: '' });
    setShowAdd(false);
    refresh();
  };

  const setStatus = async (host: string, status: HostRow['status']) => {
    const { error } = await supabase.from('allowed_oauth_return_hosts').update({ status }).eq('host', host);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    refresh();
  };

  const handleDelete = async (h: string) => {
    if (!confirm(`Delete ${h}?`)) return;
    const { error } = await supabase.from('allowed_oauth_return_hosts').delete().eq('host', h);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    refresh();
  };

  const saveNotes = async (host: string, admin_notes: string) => {
    const { error } = await supabase.from('allowed_oauth_return_hosts').update({ admin_notes }).eq('host', host);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Saved' });
  };

  if (authLoading || isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <p className="text-sm text-muted-foreground">You need the admin role to manage OAuth integrations.</p>
          <Link to="/oauth-apps" className="text-sm text-primary underline">View public directory</Link>
        </div>
      </div>
    );
  }

  const pending = rows.filter(r => r.status === 'pending');
  const approved = rows.filter(r => r.status === 'approved');
  const rejected = rows.filter(r => r.status === 'rejected');

  const Row = ({ r }: { r: HostRow }) => {
    const [notes, setNotes] = useState(r.admin_notes || '');
    return (
      <div className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {r.logo_url ? <img src={r.logo_url} alt="" className="w-10 h-10 rounded object-cover border border-border" /> : <div className="w-10 h-10 rounded bg-muted" />}
            <div className="min-w-0">
              <div className="font-medium truncate">{r.app_name}</div>
              <code className="text-xs text-muted-foreground">{r.host}</code>
              {r.public_description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.public_description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={r.status === 'approved' ? 'default' : r.status === 'pending' ? 'secondary' : 'destructive'}>{r.status}</Badge>
            {r.status !== 'approved' && <Button size="icon" variant="ghost" onClick={() => setStatus(r.host, 'approved')} title="Approve"><Check className="w-4 h-4" /></Button>}
            {r.status !== 'rejected' && <Button size="icon" variant="ghost" onClick={() => setStatus(r.host, 'rejected')} title="Reject"><X className="w-4 h-4" /></Button>}
            <Button size="icon" variant="ghost" onClick={() => handleDelete(r.host)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs">Admin notes (private)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px] text-xs" />
          </div>
          <Button size="sm" variant="outline" onClick={() => saveNotes(r.host, notes)}>Save notes</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">OAuth integrations — admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Approve requests, add your own, and manage the return-host allowlist.{' '}
              <Link to="/oauth-apps" className="text-primary underline">Public directory</Link>
            </p>
          </div>
          <Button onClick={() => setShowAdd(v => !v)} className="gap-2"><Plus className="w-4 h-4" />Add</Button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="rounded-lg border border-border p-4 grid gap-3 sm:grid-cols-2">
            <div><Label>App name *</Label><Input value={form.app_name} onChange={e => setForm({ ...form, app_name: e.target.value })} required /></div>
            <div><Label>Host *</Label><Input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="myapp.example.com" required /></div>
            <div className="sm:col-span-2"><Label>Logo URL</Label><Input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Public description</Label><Textarea value={form.public_description} onChange={e => setForm({ ...form, public_description: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Admin notes (private)</Label><Textarea value={form.admin_notes} onChange={e => setForm({ ...form, admin_notes: e.target.value })} /></div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add & approve</Button>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading…</div>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending requests ({pending.length})</h2>
                {pending.map(r => <Row key={r.host} r={r} />)}
              </section>
            )}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Approved ({approved.length})</h2>
              {approved.length === 0 ? <p className="text-sm text-muted-foreground">No approved integrations.</p> : approved.map(r => <Row key={r.host} r={r} />)}
            </section>
            {rejected.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Rejected ({rejected.length})</h2>
                {rejected.map(r => <Row key={r.host} r={r} />)}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthHostsAdmin;
