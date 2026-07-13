import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, ExternalLink } from 'lucide-react';
import { Seo } from '@/components/Seo';

interface PublicApp {
  host: string;
  app_name: string;
  logo_url: string | null;
  public_description: string | null;
}

interface OwnedApp extends PublicApp {
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
}

const normalizeHost = (raw: string) =>
  raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const OAuthAppsPublic = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apps, setApps] = useState<PublicApp[]>([]);
  const [mine, setMine] = useState<OwnedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PublicApp | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<string | null>(null);
  const [form, setForm] = useState({ host: '', app_name: '', logo_url: '', public_description: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pub, own] = await Promise.all([
      supabase.from('oauth_apps_public').select('*').order('app_name'),
      user
        ? supabase.from('allowed_oauth_return_hosts')
            .select('host, app_name, logo_url, public_description, status, admin_notes')
            .eq('owner_id', user.id)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    setLoading(false);
    if (pub.error) toast({ title: 'Failed to load', description: pub.error.message, variant: 'destructive' });
    setApps((pub.data || []) as PublicApp[]);
    setMine((own.data || []) as OwnedApp[]);
  };

  useEffect(() => { load(); }, [user]);

  const openSubmit = () => {
    setEditingHost(null);
    setForm({ host: '', app_name: '', logo_url: '', public_description: '' });
    setSubmitOpen(true);
  };

  const openEdit = (row: OwnedApp) => {
    setEditingHost(row.host);
    setForm({
      host: row.host,
      app_name: row.app_name,
      logo_url: row.logo_url || '',
      public_description: row.public_description || '',
    });
    setSubmitOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) { toast({ title: 'Sign in required' }); return; }
    setSaving(true);
    if (editingHost) {
      const { error } = await supabase.from('allowed_oauth_return_hosts').update({
        app_name: form.app_name.trim(),
        logo_url: form.logo_url.trim() || null,
        public_description: form.public_description.trim() || null,
      }).eq('host', editingHost);
      setSaving(false);
      if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Updated' });
    } else {
      const host = normalizeHost(form.host);
      if (!host || !form.app_name.trim()) { setSaving(false); return; }
      const { error } = await supabase.from('allowed_oauth_return_hosts').insert({
        host,
        app_name: form.app_name.trim(),
        logo_url: form.logo_url.trim() || null,
        public_description: form.public_description.trim() || null,
        status: 'pending',
        owner_id: user.id,
      });
      setSaving(false);
      if (error) { toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Request submitted', description: 'An admin will review your integration.' });
    }
    setSubmitOpen(false);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo title="OAuth integrations directory" description="Apps and services approved to use the CodeCanvas auth bridge." />
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">OAuth integrations</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Third-party apps that use CodeCanvas as their auth bridge. Click any app to learn more, or submit your own for review.
            </p>
          </div>
          <Button onClick={openSubmit} className="gap-2"><Plus className="w-4 h-4" />Submit integration</Button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <section>
            {apps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No integrations yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {apps.map(app => (
                  <button
                    key={app.host}
                    onClick={() => setSelected(app)}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent transition-colors text-center"
                  >
                    {app.logo_url ? (
                      <img src={app.logo_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground">
                        {app.app_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-sm font-medium truncate w-full">{app.app_name}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {user && mine.length > 0 && (
          <section className="space-y-3 pt-4 border-t border-border">
            <h2 className="text-lg font-semibold">Your integrations</h2>
            <div className="grid gap-2">
              {mine.map(row => (
                <div key={row.host} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {row.logo_url ? <img src={row.logo_url} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-muted" />}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{row.app_name}</div>
                      <code className="text-xs text-muted-foreground">{row.host}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={row.status === 'approved' ? 'default' : row.status === 'pending' ? 'secondary' : 'destructive'}>{row.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Public detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {selected.logo_url ? (
                    <img src={selected.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center font-semibold">{selected.app_name.charAt(0)}</div>
                  )}
                  <DialogTitle>{selected.app_name}</DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-3">
                {selected.public_description ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{selected.public_description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description provided.</p>
                )}
                <a
                  href={`https://${selected.host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  {selected.host} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit / edit dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHost ? 'Edit your integration' : 'Submit an integration'}</DialogTitle>
          </DialogHeader>
          {!user ? (
            <p className="text-sm text-muted-foreground">You need to sign in to submit an integration.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>App name *</Label><Input value={form.app_name} onChange={e => setForm({ ...form, app_name: e.target.value })} required /></div>
              <div>
                <Label>Host *</Label>
                <Input value={form.host} disabled={!!editingHost} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="myapp.example.com" required />
                {editingHost && <p className="text-xs text-muted-foreground mt-1">Host cannot be changed. Ask an admin if needed.</p>}
              </div>
              <div><Label>Logo URL</Label><Input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…/logo.png" /></div>
              <div><Label>Public description</Label><Textarea value={form.public_description} onChange={e => setForm({ ...form, public_description: e.target.value })} placeholder="What does your app do?" /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingHost ? 'Save' : 'Submit for review'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OAuthAppsPublic;
