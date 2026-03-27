import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download, PackagePlus, Rocket, Search, Store, Trash2, WandSparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type ExtensionRuntime = 'edge-function' | 'client-only';

type ExtensionRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  manifest: Record<string, unknown>;
  status: string;
  version: string;
  install_count: number;
  created_at: string;
  updated_at: string;
  owner_id: string;
};

const makeSlug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const ExtensionsPanel = () => {
  const { user } = useAuth();
  const [myExtensions, setMyExtensions] = useState<ExtensionRecord[]>([]);
  const [storeExtensions, setStoreExtensions] = useState<ExtensionRecord[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [runtime, setRuntime] = useState<ExtensionRuntime>('edge-function');
  const [copied, setCopied] = useState<string | null>(null);
  const [storeSearch, setStoreSearch] = useState('');
  const [tab, setTab] = useState<'create' | 'store'>('create');
  const [loading, setLoading] = useState(false);

  const slug = useMemo(() => makeSlug(name), [name]);

  const fetchMyExtensions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('extensions').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    if (data) setMyExtensions(data as unknown as ExtensionRecord[]);
  }, [user]);

  const fetchStoreExtensions = useCallback(async () => {
    const { data } = await supabase.from('extensions').select('*').eq('status', 'published').order('install_count', { ascending: false });
    if (data) setStoreExtensions(data as unknown as ExtensionRecord[]);
  }, []);

  const fetchInstalled = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('installed_extensions' as any).select('extension_id').eq('user_id', user.id);
    if (data) setInstalledIds(new Set((data as any[]).map((r: any) => r.extension_id)));
  }, [user]);

  useEffect(() => {
    fetchMyExtensions();
    fetchStoreExtensions();
    fetchInstalled();
  }, [fetchMyExtensions, fetchStoreExtensions, fetchInstalled]);

  const createExtension = async () => {
    if (!name.trim() || !slug || !user) return;
    setLoading(true);
    const manifest = {
      name: name.trim(),
      slug,
      description: description.trim(),
      version: '0.1.0',
      icon: 'package',
      runtime,
      permissions: ['project.read', 'project.write'],
      entrypoint: 'index.ts',
    };
    await supabase.functions.invoke('create-extension', {
      body: { name: name.trim(), slug, description: description.trim(), manifest, runtime },
    });
    setName('');
    setDescription('');
    await fetchMyExtensions();
    setLoading(false);
  };

  const publishExtension = async (ext: ExtensionRecord) => {
    setLoading(true);
    await supabase.functions.invoke('publish-extension', {
      body: {
        extension_id: ext.id,
        version: ext.version,
        source_bundle_url: `extensions/${ext.slug}/${ext.version}/bundle.zip`,
      },
    });
    await fetchMyExtensions();
    await fetchStoreExtensions();
    setLoading(false);
  };

  const installExtension = async (extensionId: string) => {
    setLoading(true);
    await supabase.functions.invoke('install-extension', {
      body: { extension_id: extensionId },
    });
    await fetchInstalled();
    setLoading(false);
  };

  const uninstallExtension = async (extensionId: string) => {
    setLoading(true);
    await supabase.functions.invoke('install-extension', {
      body: { extension_id: extensionId, action: 'uninstall' },
    });
    await fetchInstalled();
    setLoading(false);
  };

  const deleteExtension = async (id: string) => {
    await supabase.from('extensions').delete().eq('id', id);
    await fetchMyExtensions();
  };

  const copyText = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const filteredStore = storeSearch
    ? storeExtensions.filter(e => e.name.toLowerCase().includes(storeSearch.toLowerCase()) || e.slug.includes(storeSearch.toLowerCase()))
    : storeExtensions;

  return (
    <div className="h-full overflow-auto ide-scrollbar">
      <div className="h-9 px-3 border-b border-border flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <Store className="h-3.5 w-3.5" />
        <span>Extensions</span>
      </div>

      <div className="flex border-b border-border">
        <button onClick={() => setTab('create')} className={`flex-1 px-3 py-1.5 text-xs font-medium ${tab === 'create' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
          My Extensions
        </button>
        <button onClick={() => setTab('store')} className={`flex-1 px-3 py-1.5 text-xs font-medium ${tab === 'store' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
          Store
        </button>
      </div>

      <div className="p-3 space-y-4">
        {tab === 'create' && (
          <>
            <section className="rounded-md border border-border bg-card p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PackagePlus className="h-4 w-4 text-primary" /> Create extension
              </div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Extension name" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <input value={slug} readOnly placeholder="slug" className="w-full rounded border border-border bg-muted px-2 py-1.5 text-xs" />
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this extension does" className="w-full min-h-[70px] rounded border border-border bg-background px-2 py-1.5 text-xs" />
              <div className="flex gap-2 text-xs">
                <button onClick={() => setRuntime('edge-function')} className={`px-2 py-1 rounded border ${runtime === 'edge-function' ? 'border-primary text-primary bg-primary/10' : 'border-border'}`}>Edge function</button>
                <button onClick={() => setRuntime('client-only')} className={`px-2 py-1 rounded border ${runtime === 'client-only' ? 'border-primary text-primary bg-primary/10' : 'border-border'}`}>Client only</button>
              </div>
              <button onClick={createExtension} disabled={!name.trim() || !slug || loading} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50">
                {loading ? 'Creating…' : 'Create draft'}
              </button>
            </section>

            <section className="rounded-md border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Rocket className="h-4 w-4 text-primary" /> My extensions
              </div>
              {myExtensions.length === 0 && <p className="text-xs text-muted-foreground">No extensions yet.</p>}
              {myExtensions.map(ext => (
                <div key={ext.id} className="rounded border border-border p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{ext.name}</p>
                      <p className="text-muted-foreground">{ext.slug} · v{ext.version}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {ext.status === 'published' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Published</span>
                      ) : (
                        <button onClick={() => publishExtension(ext)} disabled={loading} className="px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-50">Deploy</button>
                      )}
                      <button onClick={() => deleteExtension(ext.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <button onClick={() => copyText(JSON.stringify(ext.manifest, null, 2), ext.id)} className="px-2 py-1 rounded border border-border text-xs inline-flex items-center gap-1">
                    <Copy className="h-3 w-3" /> Copy manifest {copied === ext.id ? '✓' : ''}
                  </button>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === 'store' && (
          <section className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="Search extensions…" className="w-full rounded border border-border bg-background pl-7 pr-2 py-1.5 text-xs" />
            </div>
            {filteredStore.length === 0 && <p className="text-xs text-muted-foreground">No published extensions found.</p>}
            {filteredStore.map(ext => (
              <div key={ext.id} className="rounded-md border border-border bg-card p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{ext.name}</p>
                    <p className="text-muted-foreground">{ext.description || ext.slug}</p>
                  </div>
                  <span className="text-muted-foreground">{ext.install_count} installs</span>
                </div>
                {user && (
                  installedIds.has(ext.id) ? (
                    <button onClick={() => uninstallExtension(ext.id)} disabled={loading} className="px-2 py-1 rounded border border-destructive text-destructive text-xs disabled:opacity-50">Uninstall</button>
                  ) : (
                    <button onClick={() => installExtension(ext.id)} disabled={loading} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50">
                      <Download className="h-3 w-3 inline mr-1" /> Install
                    </button>
                  )
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};
