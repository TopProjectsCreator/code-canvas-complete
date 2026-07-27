import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Check, X, Plus, Pencil, Upload } from 'lucide-react';
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

async function uploadLogo(file: File, hostHint: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const safe = hostHint.replace(/[^a-z0-9-]/gi, '-') || 'logo';
  const path = `oauth-logos/${safe}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

interface RowProps {
  r: HostRow;
  onSetStatus: (host: string, status: HostRow['status']) => void;
  onDelete: (host: string) => void;
  onSaveNotes: (host: string, notes: string) => void;
  onSaveEdit: (host: string, patch: { app_name: string; logo_url: string | null; public_description: string | null }) => Promise<void>;
}

const Row = ({ r, onSetStatus, onDelete, onSaveNotes, onSaveEdit }: RowProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState(r.admin_notes || '');
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ app_name: r.app_name, logo_url: r.logo_url || '', public_description: r.public_description || '' });
  const [uploading, setUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const dirty = notes !== (r.admin_notes || '');

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadLogo(file, r.host);
      setEdit(e => ({ ...e, logo_url: url }));
      toast({ title: 'Logo uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    await onSaveEdit(r.host, {
      app_name: edit.app_name.trim(),
      logo_url: edit.logo_url.trim() || null,
      public_description: edit.public_description.trim() || null,
    });
    setSavingEdit(false);
    setEditing(false);
  };

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
          <Button size="icon" variant="ghost" onClick={() => setEditing(v => !v)} title="Edit"><Pencil className="w-4 h-4" /></Button>
          {r.status !== 'approved' && <Button size="icon" variant="ghost" onClick={() => onSetStatus(r.host, 'approved')} title="Approve"><Check className="w-4 h-4" /></Button>}
          {r.status !== 'rejected' && <Button size="icon" variant="ghost" onClick={() => onSetStatus(r.host, 'rejected')} title="Reject"><X className="w-4 h-4" /></Button>}
          <Button size="icon" variant="ghost" onClick={() => onDelete(r.host)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      {editing && (
        <div className="grid gap-3 sm:grid-cols-2 rounded-md border border-border p-3 bg-muted/30">
          <div><Label className="text-xs">App name</Label><Input value={edit.app_name} onChange={e => setEdit({ ...edit, app_name: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Logo URL</Label>
            <div className="flex gap-2">
              <Input value={edit.logo_url} onChange={e => setEdit({ ...edit, logo_url: e.target.value })} placeholder="https://…" />
              <Button type="button" size="sm" variant="outline" asChild disabled={uploading}>
                <label className="cursor-pointer gap-1 inline-flex items-center">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} />
                </label>
              </Button>
            </div>
            {edit.logo_url && <img src={edit.logo_url} alt="" className="mt-2 w-10 h-10 rounded object-cover border border-border" />}
          </div>
          <div className="sm:col-span-2"><Label className="text-xs">Public description</Label><Textarea value={edit.public_description} onChange={e => setEdit({ ...edit, public_description: e.target.value })} /></div>
          <div className="sm:col-span-2 flex gap-2">
            <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit || !edit.app_name.trim()}>
              {savingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEdit({ app_name: r.app_name, logo_url: r.logo_url || '', public_description: r.public_description || '' }); setEditing(false); }}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs flex items-center gap-2">
            Admin notes (private)
            {dirty && <span className="text-[10px] text-amber-500 font-normal">• unsaved</span>}
          </Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px] text-xs" />
        </div>
        <Button size="sm" variant="outline" disabled={!dirty} onClick={() => onSaveNotes(r.host, notes)}>Save notes</Button>
      </div>
    </div>
  );
};

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

  const saveEdit = async (host: string, patch: { app_name: string; logo_url: string | null; public_description: string | null }) => {
    const { error } = await supabase.from('allowed_oauth_return_hosts').update(patch).eq('host', host);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Saved' });
    refresh();
  };

  const handleFormUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await uploadLogo(file, form.host || form.app_name || 'app');
      setForm(f => ({ ...f, logo_url: url }));
      toast({ title: 'Logo uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
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

  const renderRow = (r: HostRow) => (
    <Row key={r.host} r={r} onSetStatus={setStatus} onDelete={handleDelete} onSaveNotes={saveNotes} onSaveEdit={saveEdit} />
  );


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
            <div className="sm:col-span-2">
              <Label>Logo URL</Label>
              <div className="flex gap-2">
                <Input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} />
                <Button type="button" size="sm" variant="outline" asChild>
                  <label className="cursor-pointer gap-1 inline-flex items-center">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFormUpload(e.target.files?.[0])} />
                  </label>
                </Button>
              </div>
              {form.logo_url && <img src={form.logo_url} alt="" className="mt-2 w-10 h-10 rounded object-cover border border-border" />}
            </div>
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
                {pending.map(renderRow)}
              </section>
            )}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Approved ({approved.length})</h2>
              {approved.length === 0 ? <p className="text-sm text-muted-foreground">No approved integrations.</p> : approved.map(renderRow)}
            </section>
            {rejected.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Rejected ({rejected.length})</h2>
                {rejected.map(renderRow)}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthHostsAdmin;
