import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, PackagePlus, Rocket, Store, WandSparkles } from 'lucide-react';

type ExtensionRuntime = 'edge-function' | 'client-only';
type ExtensionStatus = 'draft' | 'published';

type ExtensionRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  runtime: ExtensionRuntime;
  status: ExtensionStatus;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = 'ide-extensions-v1';

const makeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const baseTemplate = (extension: Pick<ExtensionRecord, 'name' | 'slug' | 'description' | 'runtime'>) => ({
  manifest: {
    name: extension.name,
    slug: extension.slug,
    description: extension.description,
    version: '0.1.0',
    icon: 'package',
    runtime: extension.runtime,
    permissions: ['project.read', 'project.write'],
    entrypoint: 'index.ts',
  },
  files: {
    'index.ts': `export default async function run(ctx) {\n  const files = await ctx.project.listFiles();\n  return { ok: true, fileCount: files.length };\n}`,
    'README.md': `# ${extension.name}\n\nGenerated extension template for ${extension.slug}.\n`,
  },
});

export const ExtensionsPanel = () => {
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [runtime, setRuntime] = useState<ExtensionRuntime>('edge-function');
  const [copied, setCopied] = useState<'template' | 'schema' | 'functions' | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ExtensionRecord[];
      setExtensions(parsed);
    } catch {
      setExtensions([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(extensions));
  }, [extensions]);

  const slug = useMemo(() => makeSlug(name), [name]);

  const activeTemplate = useMemo(() => {
    if (!name.trim() || !slug) return '';
    return JSON.stringify(baseTemplate({ name: name.trim(), slug, description: description.trim(), runtime }), null, 2);
  }, [description, name, runtime, slug]);

  const createExtension = () => {
    if (!name.trim() || !slug) return;
    const now = new Date().toISOString();
    const existing = extensions.find((item) => item.slug === slug);

    if (existing) {
      setExtensions((prev) =>
        prev.map((item) =>
          item.slug === slug
            ? {
                ...item,
                name: name.trim(),
                description: description.trim(),
                runtime,
                updatedAt: now,
              }
            : item,
        ),
      );
      return;
    }

    setExtensions((prev) => [
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        slug,
        description: description.trim(),
        runtime,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
      ...prev,
    ]);
  };

  const deployToStore = (id: string) => {
    const now = new Date().toISOString();
    setExtensions((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'published', updatedAt: now } : item)));
  };

  const copyText = async (value: string, key: 'template' | 'schema' | 'functions') => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const schemaSql = `create table if not exists public.extensions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  manifest jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version text not null default '0.1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.extension_versions (
  id uuid primary key default gen_random_uuid(),
  extension_id uuid not null references public.extensions(id) on delete cascade,
  version text not null,
  source_bundle_url text not null,
  changelog text,
  created_at timestamptz not null default now(),
  unique(extension_id, version)
);

alter table public.extensions enable row level security;
alter table public.extension_versions enable row level security;`;

  const functionPlan = `Suggested Supabase Edge Functions:
1) create-extension
   - Validates manifest + inserts into public.extensions.
2) publish-extension
   - Creates extension_versions row + marks extension as published.
3) list-store-extensions
   - Public endpoint returning published extensions.
4) install-extension
   - Adds installed extension row for the current user/team.
5) submit-extension-review (optional)
   - Queues moderation before store visibility.`;

  return (
    <div className="h-full overflow-auto ide-scrollbar">
      <div className="h-9 px-3 border-b border-border flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <Store className="h-3.5 w-3.5" />
        <span>Extensions</span>
      </div>

      <div className="p-3 space-y-4">
        <section className="rounded-md border border-border bg-card p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PackagePlus className="h-4 w-4 text-primary" /> Create extension
          </div>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Extension name"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          />
          <input value={slug} readOnly placeholder="slug" className="w-full rounded border border-border bg-muted px-2 py-1.5 text-xs" />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what this extension does"
            className="w-full min-h-[70px] rounded border border-border bg-background px-2 py-1.5 text-xs"
          />
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setRuntime('edge-function')}
              className={`px-2 py-1 rounded border ${runtime === 'edge-function' ? 'border-primary text-primary bg-primary/10' : 'border-border'}`}
            >
              Edge function
            </button>
            <button
              onClick={() => setRuntime('client-only')}
              className={`px-2 py-1 rounded border ${runtime === 'client-only' ? 'border-primary text-primary bg-primary/10' : 'border-border'}`}
            >
              Client only
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={createExtension} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs">
              Save draft
            </button>
            <button
              onClick={() => copyText(activeTemplate, 'template')}
              disabled={!activeTemplate}
              className="px-3 py-1.5 rounded border border-border text-xs disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Copy className="h-3.5 w-3.5" /> Copy template {copied === 'template' ? '✓' : ''}
            </button>
          </div>
          {activeTemplate && <pre className="text-[11px] max-h-52 overflow-auto bg-muted rounded p-2">{activeTemplate}</pre>}
        </section>

        <section className="rounded-md border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Rocket className="h-4 w-4 text-primary" /> Deploy to store
          </div>
          {extensions.length === 0 && <p className="text-xs text-muted-foreground">No extensions yet. Create your first draft above.</p>}
          <div className="space-y-2">
            {extensions.map((extension) => (
              <div key={extension.id} className="rounded border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{extension.name}</p>
                    <p className="text-muted-foreground">{extension.slug}</p>
                  </div>
                  {extension.status === 'published' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Published</span>
                  ) : (
                    <button onClick={() => deployToStore(extension.id)} className="px-2 py-1 rounded border border-border hover:bg-accent">
                      Deploy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium"><WandSparkles className="h-4 w-4 text-primary" /> Supabase backend setup</div>
          <p className="text-xs text-muted-foreground">Add this schema + edge functions to support extension publishing and store installs.</p>
          <div className="flex gap-2">
            <button onClick={() => copyText(schemaSql, 'schema')} className="px-2 py-1 rounded border border-border text-xs inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Copy schema {copied === 'schema' ? '✓' : ''}</button>
            <button onClick={() => copyText(functionPlan, 'functions')} className="px-2 py-1 rounded border border-border text-xs inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Copy edge functions {copied === 'functions' ? '✓' : ''}</button>
          </div>
          <pre className="text-[11px] max-h-56 overflow-auto bg-muted rounded p-2">{schemaSql}</pre>
          <pre className="text-[11px] max-h-44 overflow-auto bg-muted rounded p-2">{functionPlan}</pre>
        </section>
      </div>
    </div>
  );
};
