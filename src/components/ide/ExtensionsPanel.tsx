import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, ChevronLeft, Code2, Copy, Download, Loader2,
  PackagePlus, Play, Rocket, Search, Sparkles, Store, Terminal,
  Trash2, WandSparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { buildContext, executeExtension, type ExtensionContext } from '@/lib/extensionRuntime';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ExtensionRuntime = 'widget' | 'command' | 'chat-tool';

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

const makeSlug = (v: string) =>
  v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const CODE_STORAGE_KEY = 'ext-code-';

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ExtensionCodeEditor({
  code,
  onChange,
}: {
  code: string;
  onChange: (c: string) => void;
}) {
  return (
    <textarea
      value={code}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      className="w-full min-h-[200px] max-h-[400px] rounded border border-border bg-muted font-mono text-[11px] p-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
      placeholder={`// Extension code — receives a \`ctx\` object\n// ctx.showUI(html) — render a widget\n// ctx.ai.complete(prompt) — call AI\n// ctx.storage.get/set — persist data\n\nconst result = await ctx.ai.complete("Hello!");\nctx.showUI(\`<div style="padding:8px">\${result}</div>\`);\nreturn { ok: true };`}
    />
  );
}

function ExtensionPreview({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const doc = ref.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: system-ui, sans-serif; font-size: 13px; padding: 8px; color: #e0e0e0; background: #1a1a2e; }
      input, select, textarea { font-size: 12px; padding: 4px 8px; border-radius: 4px; border: 1px solid #333; background: #252540; color: #e0e0e0; }
      button { font-size: 12px; padding: 4px 12px; border-radius: 4px; border: none; background: #6366f1; color: white; cursor: pointer; }
      button:hover { background: #4f46e5; }
      a { color: #818cf8; }
    </style></head><body>${html}</body></html>`);
    doc.close();
  }, [html]);

  return (
    <iframe
      ref={ref}
      sandbox="allow-scripts"
      className="w-full h-40 rounded border border-border bg-muted"
      title="Extension preview"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */

type View = 'list' | 'create' | 'store' | 'edit';

export const ExtensionsPanel = () => {
  const { user } = useAuth();

  /* data */
  const [myExtensions, setMyExtensions] = useState<ExtensionRecord[]>([]);
  const [storeExtensions, setStoreExtensions] = useState<ExtensionRecord[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  /* create/edit form */
  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [runtimeType, setRuntimeType] = useState<ExtensionRuntime>('widget');
  const [code, setCode] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  /* ui state */
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [runOutput, setRunOutput] = useState('');

  const slug = useMemo(() => makeSlug(name), [name]);

  /* ---- data fetching ---- */

  const fetchMyExtensions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('extensions').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    if (data) setMyExtensions(data as unknown as ExtensionRecord[]);
  }, [user]);

  const fetchStore = useCallback(async () => {
    const { data } = await supabase.from('extensions').select('*').eq('status', 'published').order('install_count', { ascending: false });
    if (data) setStoreExtensions(data as unknown as ExtensionRecord[]);
  }, []);

  const fetchInstalled = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('installed_extensions' as any).select('extension_id').eq('user_id', user.id);
    if (data) setInstalledIds(new Set((data as any[]).map((r: any) => r.extension_id)));
  }, [user]);

  useEffect(() => { fetchMyExtensions(); fetchStore(); fetchInstalled(); }, [fetchMyExtensions, fetchStore, fetchInstalled]);

  /* ---- AI generation ---- */

  const generateCode = async () => {
    if (!name.trim() || !description.trim()) {
      toast.error('Enter a name and description first');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-extension', {
        body: { name: name.trim(), description: description.trim(), runtime_type: runtimeType },
      });
      if (error) throw new Error(error.message);
      if (data?.code) {
        setCode(data.code);
        toast.success('Code generated! Review and edit as needed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  /* ---- run / test ---- */

  const runExtension = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setPreviewHtml('');
    setRunOutput('');

    const ctx = buildContext(slug || 'test', {
      onUI: (html) => setPreviewHtml(html),
      getSelection: () => '',
      replaceSelection: () => {},
      notify: (msg) => toast.info(msg),
    });

    try {
      const result = await executeExtension(code, ctx);
      if (result && typeof result === 'object') {
        setRunOutput(JSON.stringify(result, null, 2));
      } else if (typeof result === 'string') {
        setRunOutput(result);
      }
    } catch (err: any) {
      setRunOutput(`Error: ${err.message}`);
      toast.error(`Extension error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  /* ---- CRUD ---- */

  const saveExtension = async () => {
    if (!name.trim() || !slug || !user || !code.trim()) return;
    setSaving(true);
    try {
      const manifest = {
        name: name.trim(), slug, description: description.trim(),
        version: '0.1.0', icon: 'package', runtime: runtimeType,
        permissions: ['project.read', 'project.write'], entrypoint: 'index.ts',
      };

      if (editingId) {
        await supabase.from('extensions').update({
          name: name.trim(), description: description.trim(), manifest,
        }).eq('id', editingId);
      } else {
        const { data: resp, error } = await supabase.functions.invoke('create-extension', {
          body: { name: name.trim(), slug, description: description.trim(), manifest, runtime: runtimeType },
        });
        if (error) throw new Error(error.message);
        if (resp?.id) setEditingId(resp.id);
      }

      // Persist code locally (keyed by slug)
      localStorage.setItem(`${CODE_STORAGE_KEY}${slug}`, code);
      toast.success('Extension saved');
      await fetchMyExtensions();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const publishExtension = async (ext: ExtensionRecord) => {
    setSaving(true);
    await supabase.functions.invoke('publish-extension', {
      body: { extension_id: ext.id, version: ext.version, source_bundle_url: `extensions/${ext.slug}/${ext.version}/bundle.zip` },
    });
    toast.success('Published to store!');
    await fetchMyExtensions();
    await fetchStore();
    setSaving(false);
  };

  const deleteExtension = async (id: string) => {
    await supabase.from('extensions').delete().eq('id', id);
    await fetchMyExtensions();
  };

  const installExtension = async (extId: string) => {
    await supabase.functions.invoke('install-extension', { body: { extension_id: extId } });
    await fetchInstalled();
    toast.success('Installed');
  };

  const uninstallExtension = async (extId: string) => {
    await supabase.functions.invoke('install-extension', { body: { extension_id: extId, action: 'uninstall' } });
    await fetchInstalled();
  };

  const openEditor = (ext?: ExtensionRecord) => {
    if (ext) {
      setEditingId(ext.id);
      setName(ext.name);
      setDescription((ext.manifest as any)?.description || ext.description || '');
      setRuntimeType(((ext.manifest as any)?.runtime as ExtensionRuntime) || 'widget');
      setCode(localStorage.getItem(`${CODE_STORAGE_KEY}${ext.slug}`) || '');
    } else {
      setEditingId(null);
      setName('');
      setDescription('');
      setRuntimeType('widget');
      setCode('');
    }
    setPreviewHtml('');
    setRunOutput('');
    setView('edit');
  };

  const copyText = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const filteredStore = storeSearch
    ? storeExtensions.filter(e => e.name.toLowerCase().includes(storeSearch.toLowerCase()) || e.slug.includes(storeSearch.toLowerCase()))
    : storeExtensions;

  /* ---- render ---- */

  return (
    <div className="h-full overflow-auto ide-scrollbar">
      {/* Header */}
      <div className="h-9 px-3 border-b border-border flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {view !== 'list' && (
          <button onClick={() => setView('list')} className="hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
        )}
        <Store className="h-3.5 w-3.5" />
        <span>{view === 'edit' ? (editingId ? 'Edit' : 'New') + ' Extension' : view === 'store' ? 'Extension Store' : 'Extensions'}</span>
      </div>

      {/* =========== LIST VIEW =========== */}
      {view === 'list' && (
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <button onClick={() => openEditor()} className="flex-1 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-1.5">
              <PackagePlus className="h-3.5 w-3.5" /> New Extension
            </button>
            <button onClick={() => setView('store')} className="flex-1 px-3 py-2 rounded-md border border-border text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-accent">
              <Search className="h-3.5 w-3.5" /> Browse Store
            </button>
          </div>

          {myExtensions.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
              <WandSparkles className="h-8 w-8 mx-auto opacity-40" />
              <p>No extensions yet</p>
              <p>Create a URL shortener, CSS palette, CSV tool, or anything else!</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">My Extensions</p>
              {myExtensions.map(ext => (
                <div key={ext.id} className="rounded-md border border-border bg-card p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => openEditor(ext)} className="text-left flex-1 min-w-0">
                      <p className="font-medium truncate">{ext.name}</p>
                      <p className="text-muted-foreground truncate">{ext.slug} · v{ext.version} · {(ext.manifest as any)?.runtime || 'widget'}</p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {ext.status === 'published' ? (
                        <span className="text-emerald-500 inline-flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /></span>
                      ) : (
                        <button onClick={() => publishExtension(ext)} className="px-1.5 py-0.5 rounded border border-border hover:bg-accent text-[10px]">Publish</button>
                      )}
                      <button onClick={() => deleteExtension(ext.id)} className="p-0.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========== EDIT / CREATE VIEW =========== */}
      {view === 'edit' && (
        <div className="p-3 space-y-3">
          {/* Meta */}
          <div className="space-y-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Extension name (e.g. URL Shortener)" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
            {slug && <p className="text-[10px] text-muted-foreground px-1">Slug: {slug}</p>}
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this extension does — be specific! AI will use this to generate the code." rows={3} className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs resize-none" />
          </div>

          {/* Runtime type */}
          <div className="flex gap-1.5">
            {(['widget', 'command', 'chat-tool'] as ExtensionRuntime[]).map(rt => (
              <button key={rt} onClick={() => setRuntimeType(rt)} className={`px-2 py-1 rounded text-[11px] border transition-colors ${runtimeType === rt ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {rt === 'widget' && '🧩 Widget'}
                {rt === 'command' && '⌘ Command'}
                {rt === 'chat-tool' && '🤖 Chat Tool'}
              </button>
            ))}
          </div>

          {/* AI Generate */}
          <button onClick={generateCode} disabled={generating || !name.trim() || !description.trim()} className="w-full px-3 py-2 rounded-md bg-accent text-accent-foreground text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-accent/80">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? 'Generating…' : 'Generate with AI'}
          </button>

          {/* Code editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Code2 className="h-3 w-3" /> Extension Code</p>
              <button onClick={() => copyText(code, 'code')} disabled={!code} className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-0.5">
                <Copy className="h-3 w-3" /> {copied === 'code' ? '✓' : 'Copy'}
              </button>
            </div>
            <ExtensionCodeEditor code={code} onChange={setCode} />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={runExtension} disabled={running || !code.trim()} className="flex-1 px-3 py-1.5 rounded-md border border-border text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50 hover:bg-accent">
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Test
            </button>
            <button onClick={saveExtension} disabled={saving || !name.trim() || !code.trim()} className="flex-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Update' : 'Save Draft'}
            </button>
          </div>

          {/* Preview */}
          {previewHtml && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">Widget Preview</p>
              <ExtensionPreview html={previewHtml} />
            </div>
          )}

          {/* Output */}
          {runOutput && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Terminal className="h-3 w-3" /> Output</p>
              <pre className="text-[11px] max-h-32 overflow-auto bg-muted rounded p-2 whitespace-pre-wrap">{runOutput}</pre>
            </div>
          )}
        </div>
      )}

      {/* =========== STORE VIEW =========== */}
      {view === 'store' && (
        <div className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="Search extensions…" className="w-full rounded border border-border bg-background pl-7 pr-2 py-1.5 text-xs" />
          </div>
          {filteredStore.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No published extensions found.</p>}
          {filteredStore.map(ext => (
            <div key={ext.id} className="rounded-md border border-border bg-card p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium truncate">{ext.name}</p>
                  <p className="text-muted-foreground truncate">{ext.description || ext.slug}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{ext.install_count} installs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{(ext.manifest as any)?.runtime || 'widget'}</span>
                {user && (
                  installedIds.has(ext.id) ? (
                    <button onClick={() => uninstallExtension(ext.id)} className="px-2 py-0.5 rounded border border-destructive text-destructive text-[10px]">Uninstall</button>
                  ) : (
                    <button onClick={() => installExtension(ext.id)} className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] inline-flex items-center gap-0.5">
                      <Download className="h-3 w-3" /> Install
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
