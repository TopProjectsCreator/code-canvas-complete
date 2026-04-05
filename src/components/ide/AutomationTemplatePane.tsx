import { type DragEvent, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CircleDot,
  MinusCircle,
  KeyRound,
  Logs,
  Play,
  Plus,
  Search,
  Trash2,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_AUTOMATION_BLOCKS,
  AUTOMATION_BLOCK_COUNT,
  AUTOMATION_INTEGRATION_REGISTRY,
  type AutomationAuthType,
} from '@/data/automationIntegrationRegistry';

interface AutomationBlockInstance {
  id: string;
  type: string;
  label: string;
  category: string;
  subcategory: string;
  auth: AutomationAuthType;
  config: Record<string, string>;
}

const createId = () => Math.random().toString(36).slice(2, 9);

const authLabel: Record<AutomationAuthType, string> = {
  api_key: 'API key needed',
  free: 'Free API',
  internal: 'Internal',
  local: 'Local runtime',
};

const authColor: Record<AutomationAuthType, string> = {
  api_key: 'text-amber-300 border-amber-500/50 bg-amber-500/10',
  free: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  internal: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  local: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
};

const defaultConfigForAuth = (auth: AutomationAuthType) => {
  switch (auth) {
    case 'api_key':
      return {
        credential_ref: '',
        action: 'configure-action',
        notes: 'Paste or map your provider API key from the credentials vault.',
      };
    case 'free':
      return {
        credential_ref: '',
        action: 'configure-action',
        notes: 'Usually OAuth-based. Connect account in credentials manager.',
      };
    case 'local':
      return {
        runtime: 'local',
        action: 'configure-action',
      };
    default:
      return {
        action: 'configure-action',
      };
  }
};

const starterFlow = (): AutomationBlockInstance[] => [
  {
    id: createId(),
    type: 'internal.internal-triggers.schedule-cron',
    label: 'Schedule (Cron)',
    category: 'System & Logic Blocks',
    subcategory: 'Local Triggers',
    auth: 'internal',
    config: { cron: '0 9 * * *', timezone: 'America/New_York' },
  },
  {
    id: createId(),
    type: 'dev-ops.code-cicd.github',
    label: 'GitHub',
    category: 'Developer Tools & DevOps',
    subcategory: 'Code & CI/CD',
    auth: 'free',
    config: { owner: 'vercel', repo: 'next.js', field: 'stargazers_count' },
  },
  {
    id: createId(),
    type: 'ai-ml.ai-providers.openai',
    label: 'OpenAI',
    category: 'AI & Machine Learning',
    subcategory: 'AI Intelligence Providers',
    auth: 'api_key',
    config: { model: 'gpt-4.1-mini', task: 'Summarize response payload for human-readable output.' },
  },
  {
    id: createId(),
    type: 'comm.team-chat.slack',
    label: 'Slack',
    category: 'Communication & Messaging',
    subcategory: 'Team Chat & Collaboration',
    auth: 'free',
    config: { mode: 'reply', channel: '#general' },
  },
];

export const AutomationTemplatePane = () => {
  const [query, setQuery] = useState('');
  const [blocks, setBlocks] = useState<AutomationBlockInstance[]>(starterFlow());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [jsonEditorValue, setJsonEditorValue] = useState('{}');
  const [jsonEditorError, setJsonEditorError] = useState<string | null>(null);

  const selectedBlock = useMemo(
    () => blocks.find((item) => item.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );

  const searchableBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_AUTOMATION_BLOCKS.filter((item) => {
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.categoryTitle.toLowerCase().includes(q) ||
        item.subcategoryTitle.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const visibleCategories = useMemo(() => {
    const visibleTypes = new Set(searchableBlocks.map((item) => item.type));

    return AUTOMATION_INTEGRATION_REGISTRY.map((category) => ({
      ...category,
      subcategories: category.subcategories
        .map((subcategory) => ({
          ...subcategory,
          blocks: subcategory.blocks.filter((block) => visibleTypes.has(`${category.id}.${subcategory.id}.${block.id}`)),
        }))
        .filter((subcategory) => subcategory.blocks.length > 0),
    })).filter((category) => category.subcategories.length > 0);
  }, [searchableBlocks]);

  const appendFromRegistry = (type: string) => {
    const entry = ALL_AUTOMATION_BLOCKS.find((item) => item.type === type);
    if (!entry) return;

    const instance: AutomationBlockInstance = {
      id: createId(),
      type: entry.type,
      label: entry.label,
      category: entry.categoryTitle,
      subcategory: entry.subcategoryTitle,
      auth: entry.auth,
      config: defaultConfigForAuth(entry.auth),
    };

    setBlocks((prev) => [...prev, instance]);
    setSelectedBlockId(instance.id);
  };

  const onCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('text/plain');
    appendFromRegistry(type);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((item) => item.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateSelectedConfig = (key: string, value: string) => {
    if (!selectedBlock) return;

    setBlocks((prev) =>
      prev.map((item) => (item.id === selectedBlock.id ? { ...item, config: { ...item.config, [key]: value } } : item)),
    );
  };

  const replaceSelectedConfig = (nextConfig: Record<string, string>) => {
    if (!selectedBlock) return;
    setBlocks((prev) =>
      prev.map((item) =>
        item.id === selectedBlock.id
          ? {
              ...item,
              config: nextConfig,
            }
          : item,
      ),
    );
  };

  const upsertQuickConfig = (updates: Record<string, string>) => {
    if (!selectedBlock) return;
    replaceSelectedConfig({ ...selectedBlock.config, ...updates });
  };

  const updateConfigEntry = (oldKey: string, newKey: string, value: string) => {
    if (!selectedBlock) return;
    const trimmedNewKey = newKey.trim();
    if (!trimmedNewKey) return;

    const updatedConfig: Record<string, string> = {};
    Object.entries(selectedBlock.config).forEach(([entryKey, entryValue]) => {
      if (entryKey === oldKey) {
        updatedConfig[trimmedNewKey] = value;
      } else {
        updatedConfig[entryKey] = entryValue;
      }
    });
    replaceSelectedConfig(updatedConfig);
  };

  const removeConfigKey = (key: string) => {
    if (!selectedBlock) return;
    const updatedConfig = Object.fromEntries(Object.entries(selectedBlock.config).filter(([entryKey]) => entryKey !== key));
    replaceSelectedConfig(updatedConfig);
  };

  const addCustomParam = () => {
    if (!selectedBlock) return;
    let idx = 1;
    let key = `param_${idx}`;
    while (Object.prototype.hasOwnProperty.call(selectedBlock.config, key)) {
      idx += 1;
      key = `param_${idx}`;
    }
    upsertQuickConfig({ [key]: '' });
  };

  useEffect(() => {
    if (!selectedBlock) {
      setJsonEditorValue('{}');
      setJsonEditorError(null);
      return;
    }
    setJsonEditorValue(JSON.stringify(selectedBlock.config, null, 2));
    setJsonEditorError(null);
  }, [selectedBlock]);

  const applyJsonConfig = () => {
    if (!selectedBlock) return;
    try {
      const parsed = JSON.parse(jsonEditorValue) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonEditorError('Config JSON must be an object (key/value map).');
        return;
      }
      const normalized = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')]));
      replaceSelectedConfig(normalized);
      setJsonEditorError(null);
    } catch {
      setJsonEditorError('Invalid JSON. Please fix syntax and try again.');
    }
  };

  return (
    <div className="grid h-full grid-cols-[290px_1fr_300px] overflow-hidden">
      <aside className="border-r border-border bg-background/70">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Add Block</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{AUTOMATION_BLOCK_COUNT} blocks available</p>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search integrations..."
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="h-[calc(100%-78px)] overflow-y-auto px-2 py-2 ide-scrollbar">
          {visibleCategories.map((category) => (
            <div key={category.id} className="mb-3">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/80">
                {category.title}
              </p>

              <div className="space-y-2">
                {category.subcategories.map((subcategory) => (
                  <div key={subcategory.id} className="rounded-md border border-border/70 bg-card/50 p-1.5">
                    <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {subcategory.title}
                    </p>

                    <div className="space-y-1">
                      {subcategory.blocks.map((item) => {
                        const type = `${category.id}.${subcategory.id}.${item.id}`;
                        return (
                          <button
                            key={type}
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData('text/plain', type)}
                            onClick={() => appendFromRegistry(type)}
                            className="w-full rounded border border-border/70 bg-background/70 px-2 py-1.5 text-left hover:bg-accent/70 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-foreground">{item.label}</p>
                              <span className={cn('rounded border px-1 py-0.5 text-[10px] font-medium', authColor[item.auth])}>
                                {authLabel[item.auth]}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Automation Canvas</p>
            <p className="text-[11px] text-muted-foreground">Drag blocks from the registry, then wire trigger → actions in sequence.</p>
          </div>
          <button className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent transition-colors">
            <Play className="h-3.5 w-3.5 text-emerald-500" />
            Test Run
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/20 p-3 ide-scrollbar" onDragOver={(event) => event.preventDefault()} onDrop={onCanvasDrop}>
          {blocks.length === 0 ? (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-background/40">
              <div className="text-center">
                <Plus className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Drop a block to start your automation</p>
                <p className="text-xs text-muted-foreground">Use trigger blocks first, then data/AI/delivery blocks.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block, index) => {
                const isSelected = selectedBlockId === block.id;
                return (
                  <div key={block.id}>
                    <button
                      onClick={() => setSelectedBlockId(block.id)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                        isSelected ? 'border-primary/70 bg-primary/10' : 'border-border bg-card/70 hover:bg-accent/60',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {index === 0 ? 'TRIGGER' : `STEP ${index}`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{block.label}</p>
                          <p className="text-[11px] text-muted-foreground">{block.category} · {block.subcategory}</p>
                        </div>
                        <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', authColor[block.auth])}>
                          {authLabel[block.auth]}
                        </span>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            removeBlock(block.id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                          title="Remove block"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </button>
                    {index < blocks.length - 1 && (
                      <div className="my-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                        <Workflow className="h-3 w-3" />
                        <span>next</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="border-l border-border bg-background/80">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Config + Run Logs</p>
        </div>

        <div className="h-[calc(100%-41px)] overflow-y-auto p-3 ide-scrollbar">
          {selectedBlock ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-foreground">{selectedBlock.label}</p>
                <p className="text-[11px] text-muted-foreground">{selectedBlock.type}</p>
              </div>

              <div className="rounded border border-border bg-card/60 p-2 text-[11px] text-muted-foreground">
                <p className="font-medium text-foreground">Credential profile</p>
                <p className="mt-1">{selectedBlock.auth === 'api_key' ? 'Requires API key' : authLabel[selectedBlock.auth]}</p>
              </div>

              <div className="space-y-2">
                {Object.entries(selectedBlock.config).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      value={key}
                      onChange={(event) => updateConfigEntry(key, event.target.value, value)}
                      className="rounded border border-border bg-input px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      value={value}
                      onChange={(event) => updateSelectedConfig(key, event.target.value)}
                      className="rounded border border-border bg-input px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => removeConfigKey(key)}
                      className="rounded border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-destructive"
                      title="Remove parameter"
                    >
                      <MinusCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="rounded border border-dashed border-border p-2">
                <p className="text-[11px] font-medium text-muted-foreground">Add / remove parameters for this API block</p>
                <button
                  onClick={addCustomParam}
                  className="mt-2 w-full rounded border border-border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  Add Parameter
                </button>
              </div>

              <div className="rounded border border-border p-2">
                <p className="text-[11px] font-medium text-muted-foreground">Advanced JSON parameter editor</p>
                <textarea
                  rows={8}
                  value={jsonEditorValue}
                  onChange={(event) => setJsonEditorValue(event.target.value)}
                  className="mt-2 w-full rounded border border-border bg-input px-2 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {jsonEditorError && <p className="mt-1 text-[11px] text-destructive">{jsonEditorError}</p>}
                <button
                  onClick={applyJsonConfig}
                  className="mt-2 w-full rounded border border-border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  Apply JSON Parameters
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              Select a block to configure credentials, scheduling, prompts, and destination settings.
            </div>
          )}

          <div className="mt-4 rounded-md border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Logs className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium">Recent run logs</p>
            </div>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /> 09:00:02 Trigger fired</p>
              <p className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-blue-400" /> 09:00:03 Provider block executed</p>
              <p className="flex items-center gap-1"><KeyRound className="h-3 w-3 text-amber-400" /> 09:00:03 Credentials resolved</p>
              <p className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /> 09:00:06 Flow completed</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
