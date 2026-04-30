import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CircleDot,
  ClipboardCopy,
  Code2,
  Download,
  FileText,
  FileJson,
  Binary,
  History,
  KeyRound,
  Loader2,
  Logs,
  MinusCircle,
  Paperclip,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Terminal as TerminalIcon,
  Trash2,
  Upload,
  Workflow,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCodeExecution } from '@/hooks/useCodeExecution';
import {
  ALL_AUTOMATION_BLOCKS,
  AUTOMATION_BLOCK_COUNT,
  AUTOMATION_INTEGRATION_REGISTRY,
  type APIParameter,
  type AutomationAuthType,
  type Operation,
} from '@/data/automationIntegrationRegistry';
import { AutomationBlockParameterForm } from './AutomationBlockParameterForm';

export interface AutomationBlockInstance {
  id: string;
  type: string;
  label: string;
  category: string;
  subcategory: string;
  auth: AutomationAuthType;
  config: Record<string, string>;
}

/** Serialize blocks to a JSON string for automation.config.json */
export const serializeAutomationConfig = (blocks: AutomationBlockInstance[]): string => {
  return JSON.stringify({
    version: 1,
    blocks: blocks.map(b => ({
      type: b.type,
      label: b.label,
      category: b.category,
      subcategory: b.subcategory,
      auth: b.auth,
      config: b.config,
    })),
  }, null, 2);
};

/** Parse automation.config.json content into blocks */
export const parseAutomationConfig = (json: string): AutomationBlockInstance[] | null => {
  try {
    const parsed = JSON.parse(json);
    if (!parsed?.blocks || !Array.isArray(parsed.blocks)) return null;
    return parsed.blocks.map((b: any) => ({
      id: createId(),
      type: b.type || '',
      label: b.label || '',
      category: b.category || '',
      subcategory: b.subcategory || '',
      auth: b.auth || 'internal',
      config: b.config || {},
    }));
  } catch {
    return null;
  }
};

interface AutomationTemplatePaneProps {
  initialBlocks?: AutomationBlockInstance[];
  onBlocksChange?: (blocks: AutomationBlockInstance[]) => void;
  syncVersion?: number;
}

// ============= Step artifacts & event history =============
export interface StepArtifact {
  stepIndex: number;
  stepLabel: string;
  /** 'inline' = produced by pipeline (JSON/text); 'upload' = file uploaded by user */
  source: 'inline' | 'upload';
  name: string;
  mimeType: string;
  /** Pretty-printed text representation (JSON, file head, etc.) */
  preview: string;
  sizeBytes: number;
  capturedAt: string;
  /** Whether the underlying file is binary (non-UTF8) */
  isBinary?: boolean;
  /** Base64-encoded raw bytes for binary uploads (used for download). */
  binaryBase64?: string;
  /** Detected/classified kind for tab-viewer routing. */
  kind?: 'json' | 'text' | 'binary';
}

export interface AutomationRunRecord {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  triggerLabel: string;
  status: 'success' | 'failed' | 'halted';
  stepCount: number;
  artifactsCount: number;
  finalOutputPreview: string;
  errorMessage?: string;
  logs: { icon: string; time: string; text: string }[];
  artifacts: StepArtifact[];
  preflight: { missing: string[]; checkedAt: string };
}

const RUN_HISTORY_KEY = 'automation.runHistory.v1';
const MAX_RUN_HISTORY = 25;

const loadRunHistory = (): AutomationRunRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RUN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RUN_HISTORY) : [];
  } catch {
    return [];
  }
};

const saveRunHistory = (records: AutomationRunRecord[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(records.slice(0, MAX_RUN_HISTORY)));
  } catch {
    /* localStorage full or disabled */
  }
};

// ============= Preflight env var detection =============
/** Scan generated code for `process.env.X` and `os.environ[...]` references. */
const scanRequiredEnvVars = (code: string): string[] => {
  const found = new Set<string>();
  const jsRe = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  const pyRe = /os\.environ(?:\.get)?\[?["']([A-Z][A-Z0-9_]*)["']\]?/g;
  let m: RegExpExecArray | null;
  while ((m = jsRe.exec(code))) found.add(m[1]);
  while ((m = pyRe.exec(code))) found.add(m[1]);
  // Strip vars that are typically auto-set or optional infra defaults.
  ['PORT', 'NODE_ENV', 'PYTHONUNBUFFERED', 'RUN_ONCE', 'AUTOMATION_TEST_MODE',
    'PIPELINE_CRON', 'WATCH_PATH', 'POLL_INTERVAL', 'WEBHOOK_WAIT_SECS',
    'PG_NOTIFY_CHANNEL'].forEach((v) => found.delete(v));
  return Array.from(found).sort();
};

/** Build CLI/Docker/Procfile/systemd snippets for a generated pipeline. */
const buildDeploymentSnippets = (
  language: 'python' | 'nodejs',
  triggerLabel: string | undefined,
  envVars: string[],
  npmPackages: string[],
) => {
  const isPy = language === 'python';
  const runCmd = isPy ? 'python automation.py' : 'node automation.js';
  const oneShotCmd = isPy ? 'RUN_ONCE=1 python automation.py' : 'RUN_ONCE=1 node automation.js';
  const installCmd = isPy
    ? 'pip install -r requirements.txt'
    : `npm install ${['dotenv', ...npmPackages].join(' ')}`;
  const baseImage = isPy ? 'python:3.12-slim' : 'node:20-slim';
  const copyCmd = isPy
    ? 'COPY requirements.txt ./\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY automation.py ./'
    : 'COPY package*.json ./\nRUN npm ci --omit=dev\nCOPY automation.js ./';

  const exposeLine = triggerLabel === 'Webhook (Catch)' ? 'EXPOSE 8000\n' : '';
  const dockerfile = `# Dockerfile\nFROM ${baseImage}\nWORKDIR /app\n${copyCmd}\n${exposeLine}ENV NODE_ENV=production PYTHONUNBUFFERED=1\nCMD ["${isPy ? 'python' : 'node'}", "automation.${isPy ? 'py' : 'js'}"]\n`;

  const composeEnv = envVars.length
    ? '    environment:\n' + envVars.map((v) => `      ${v}: \${${v}}`).join('\n') + '\n'
    : '';
  const composePort = triggerLabel === 'Webhook (Catch)' ? '    ports:\n      - "8000:8000"\n' : '';
  const dockerCompose = `# docker-compose.yml\nservices:\n  automation:\n    build: .\n    restart: unless-stopped\n${composePort}${composeEnv}`;

  const procfile = triggerLabel === 'Webhook (Catch)'
    ? `web: ${runCmd}\n`
    : `worker: ${runCmd}\n`;

  const systemd = `# /etc/systemd/system/automation.service\n[Unit]\nDescription=Automation pipeline\nAfter=network.target\n\n[Service]\nType=simple\nWorkingDirectory=/opt/automation\nEnvironmentFile=/opt/automation/.env\nExecStart=/usr/bin/${isPy ? 'python3' : 'node'} automation.${isPy ? 'py' : 'js'}\nRestart=on-failure\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n`;

  const cliQuickstart = [
    '# 1. Install deps',
    installCmd,
    '',
    '# 2. Set env vars (or put them in a .env file)',
    ...envVars.map((v) => `export ${v}=...`),
    '',
    '# 3. Test once (no listener)',
    oneShotCmd,
    '',
    '# 4. Run as long-lived listener',
    runCmd,
  ].join('\n');

  return { cliQuickstart, dockerfile, dockerCompose, procfile, systemd };
};



const createId = () => Math.random().toString(36).slice(2, 9);

const getBlockDefinition = (type: string) => {
  return ALL_AUTOMATION_BLOCKS.find((block) => block.type === type);
};

const isTriggerBlock = (block: AutomationBlockInstance) => {
  const def = getBlockDefinition(block.type);
  if (def?.isTrigger) return true;
  // Fallback: check subcategory name for blocks created by AI that may not exactly match registry types
  if (block.subcategory?.toLowerCase() === 'triggers') return true;
  // Fallback: check common trigger type patterns
  const t = block.type?.toLowerCase() ?? '';
  if (/\b(schedule|cron|webhook|trigger|interval|timer|watcher|poll)\b/.test(t)) return true;
  return false;
};

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

const genericApiCredentialFields: APIParameter[] = [
  {
    name: 'api_key',
    displayName: 'API Key',
    type: 'password',
    description: 'Secret key/token for this provider.',
    required: true,
    placeholder: 'Paste your API key…',
  },
];

const genericOAuthCredentialFields: APIParameter[] = [
  {
    name: 'connection_ref',
    displayName: 'Connected Account',
    type: 'string',
    description: 'Reference to your connected OAuth account profile.',
    required: true,
    placeholder: 'default-oauth-connection',
  },
];

const genericOperations: Operation[] = [
  {
    id: 'list',
    name: 'List Resources',
    method: 'GET',
    endpoint: '/v1/{resource}',
    description: 'Fetch a collection of resources.',
    inputFields: [
      { name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'items' },
      { name: 'limit', displayName: 'Limit', type: 'number', default: 25, placeholder: '25' },
      { name: 'cursor', displayName: 'Cursor', type: 'string', placeholder: 'next_page_token' },
    ],
  },
  {
    id: 'retrieve',
    name: 'Get by ID',
    method: 'GET',
    endpoint: '/v1/{resource}/{id}',
    description: 'Fetch a single resource by identifier.',
    inputFields: [
      { name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'items' },
      { name: 'resource_id', displayName: 'Resource ID', type: 'string', required: true, placeholder: 'abc123' },
    ],
  },
  {
    id: 'create',
    name: 'Create Resource',
    method: 'POST',
    endpoint: '/v1/{resource}',
    description: 'Create a new resource without raw JSON editing.',
    inputFields: [
      { name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'items' },
      { name: 'title', displayName: 'Title/Name', type: 'string', required: true, placeholder: 'My new record' },
      { name: 'description', displayName: 'Description', type: 'textarea', placeholder: 'Optional details...' },
      { name: 'tags', displayName: 'Tags', type: 'string', placeholder: 'tag1,tag2' },
    ],
  },
  {
    id: 'update',
    name: 'Update Resource',
    method: 'PATCH',
    endpoint: '/v1/{resource}/{id}',
    description: 'Update fields on an existing resource.',
    inputFields: [
      { name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'items' },
      { name: 'resource_id', displayName: 'Resource ID', type: 'string', required: true, placeholder: 'abc123' },
      { name: 'field_name', displayName: 'Field to Update', type: 'string', required: true, placeholder: 'status' },
      { name: 'field_value', displayName: 'New Value', type: 'string', required: true, placeholder: 'active' },
    ],
  },
  {
    id: 'delete',
    name: 'Delete Resource',
    method: 'DELETE',
    endpoint: '/v1/{resource}/{id}',
    description: 'Remove a resource by identifier.',
    inputFields: [
      { name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'items' },
      { name: 'resource_id', displayName: 'Resource ID', type: 'string', required: true, placeholder: 'abc123' },
      { name: 'confirm_delete', displayName: 'Confirm Delete', type: 'boolean', default: false, placeholder: 'I understand this is destructive' },
    ],
  },
];

const genericParameters: APIParameter[] = [
  {
    name: 'provider_notes',
    displayName: 'Provider Notes',
    type: 'textarea',
    description: 'Describe the provider-specific action in plain language.',
    placeholder: 'Example: Create a photo album, then upload all images from previous step.',
  },
  {
    name: 'retry_policy',
    displayName: 'Retry Policy',
    type: 'select',
    default: 'standard',
    options: [
      { label: 'No retries', value: 'none' },
      { label: 'Standard (3 retries)', value: 'standard' },
      { label: 'Aggressive (5 retries)', value: 'aggressive' },
    ],
  },
];

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

const getBlocksSignature = (items: AutomationBlockInstance[]) =>
  JSON.stringify(items.map((block) => ({ type: block.type, label: block.label, config: block.config })));

export const AutomationTemplatePane = ({ initialBlocks, onBlocksChange, syncVersion = 0 }: AutomationTemplatePaneProps = {}) => {
  const [query, setQuery] = useState('');
  const [blocks, setBlocks] = useState<AutomationBlockInstance[]>(initialBlocks ?? starterFlow());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [jsonEditorValue, setJsonEditorValue] = useState('{}');
  const [jsonEditorError, setJsonEditorError] = useState<string | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testRunLogs, setTestRunLogs] = useState<{ icon: 'check' | 'dot' | 'key' | 'error'; time: string; text: string }[]>([]);
  const [pythonCode, setPythonCode] = useState<string | null>(null);
  const [nodeCode, setNodeCode] = useState<string | null>(null);
  const [codeLanguage, setCodeLanguage] = useState<'python' | 'nodejs'>('python');
  const generatedCode = codeLanguage === 'nodejs' ? nodeCode : pythonCode;

  // ---- New: artifacts, run history, preflight, deployment snippets ----
  const [stepArtifacts, setStepArtifacts] = useState<StepArtifact[]>([]);
  const [runHistory, setRunHistory] = useState<AutomationRunRecord[]>(() => loadRunHistory());
  const [preflight, setPreflight] = useState<{ required: string[]; missing: string[]; checkedAt: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const artifactInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveRunHistory(runHistory); }, [runHistory]);

  const blocksChangeRef = useRef(onBlocksChange);
  const skipNextBlocksEmitRef = useRef(false);
  const hasMountedRef = useRef(false);
  blocksChangeRef.current = onBlocksChange;
  const { executeCode } = useCodeExecution();
  const generateNodeCodeImplRef = useRef<(() => string | undefined) | null>(null);

  // Sync with initialBlocks from external changes (file edits)
  // Only react to syncVersion bumps (external file changes), NOT to internal block state
  const prevSyncVersionRef = useRef(syncVersion);
  useEffect(() => {
    if (!initialBlocks) return;
    if (syncVersion === prevSyncVersionRef.current) return;
    prevSyncVersionRef.current = syncVersion;
    skipNextBlocksEmitRef.current = true;
    setBlocks(initialBlocks);
    setSelectedBlockId((currentSelectedId) =>
      initialBlocks.some((block) => block.id === currentSelectedId) ? currentSelectedId : null,
    );
  }, [initialBlocks, syncVersion]);

  // Emit block changes to parent for file sync
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (skipNextBlocksEmitRef.current) {
      skipNextBlocksEmitRef.current = false;
      return;
    }
    blocksChangeRef.current?.(blocks);
  }, [blocks]);
  const selectedBlock = useMemo(
    () => blocks.find((item) => item.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );

  const invalidTriggerStart = blocks.length > 0 && !isTriggerBlock(blocks[0]);

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

    // When there are no blocks yet, or the first block is not a trigger, only show trigger blocks
    const needsTriggerFirst = blocks.length === 0 || (blocks.length > 0 && !isTriggerBlock(blocks[0]));

    return AUTOMATION_INTEGRATION_REGISTRY.map((category) => ({
      ...category,
      subcategories: category.subcategories
        .map((subcategory) => ({
          ...subcategory,
          blocks: subcategory.blocks.filter((block) => {
            if (!visibleTypes.has(`${category.id}.${subcategory.id}.${block.id}`)) return false;
            if (needsTriggerFirst && !block.isTrigger) return false;
            return true;
          }),
        }))
        .filter((subcategory) => subcategory.blocks.length > 0),
    })).filter((category) => category.subcategories.length > 0);
  }, [searchableBlocks, blocks]);

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

  const runPreflight = useCallback((code: string) => {
    const required = scanRequiredEnvVars(code);
    const missing = required.filter((v) => {
      const fromBrowser = typeof window !== 'undefined' ? window.localStorage.getItem(`env.${v}`) : null;
      return !fromBrowser;
    });
    const result = { required, missing, checkedAt: new Date().toISOString() };
    setPreflight(result);
    return result;
  }, []);

  const handleTestRun = useCallback(async () => {
    if (blocks.length === 0) { toast.error('Add at least one block to test.'); return; }
    if (invalidTriggerStart) { toast.error('The first block must be a trigger block.'); return; }
    setIsTestRunning(true);
    setTestRunLogs([]);
    setStepArtifacts((prev) => prev.filter((a) => a.source === 'upload')); // keep uploads, drop previous inline artifacts
    const startedAtIso = new Date().toISOString();
    const startedAt = Date.now();
    const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });
    const collected: { icon: 'check' | 'dot' | 'key' | 'error'; time: string; text: string }[] = [];
    const push = (icon: 'check' | 'dot' | 'key' | 'error', text: string) => {
      const entry = { icon, time: now(), text };
      collected.push(entry);
      setTestRunLogs((p) => [...p, entry]);
    };

    push('check', 'Generating Node.js code…');
    const code = generateNodeCodeImplRef.current?.();
    if (!code) { setIsTestRunning(false); return; }

    // Preflight: env var check before executing.
    const pf = runPreflight(code);
    if (pf.missing.length) {
      push('key', `⚠ Preflight: missing ${pf.missing.length} env var${pf.missing.length > 1 ? 's' : ''}: ${pf.missing.join(', ')}`);
      push('dot', 'Continuing test in sandbox — production runs will fail until these are set.');
    } else if (pf.required.length) {
      push('check', `Preflight OK — ${pf.required.length} required env var${pf.required.length > 1 ? 's' : ''} present.`);
    }

    const testHarness = [
      'process.env.RUN_ONCE = "1";',
      'process.env.AUTOMATION_TEST_MODE = "1";',
      '',
    ].join('\n');

    push('dot', 'Executing pipeline in sandbox…');
    let result;
    try {
      result = await executeCode(testHarness + code, 'javascript');
    } catch (err) {
      push('error', `Executor failed: ${err instanceof Error ? err.message : String(err)}`);
      setIsTestRunning(false);
      return;
    }

    const output = result.output || [];
    const inlineArtifacts: StepArtifact[] = [];
    let stepIdx = 0;
    let finalPreview = '';
    let status: 'success' | 'failed' | 'halted' = 'failed';
    for (const raw of output) {
      const line = String(raw);
      if (line.startsWith('⚡') || line.startsWith('🐍')) continue;
      // Capture step artifacts emitted by runPipeline.
      const artMatch = line.match(/^__ARTIFACT__(.+)$/);
      if (artMatch) {
        try {
          const parsed = JSON.parse(artMatch[1]);
          const pretty = JSON.stringify(parsed.output, null, 2);
          const art: StepArtifact = {
            stepIndex: parsed.stepIndex,
            stepLabel: parsed.stepLabel,
            source: 'inline',
            name: `step-${parsed.stepIndex}-${String(parsed.stepLabel).replace(/[^a-z0-9]/gi, '_')}.json`,
            mimeType: 'application/json',
            preview: pretty.slice(0, 8000),
            sizeBytes: pretty.length,
            capturedAt: new Date().toISOString(),
            kind: 'json',
          };
          inlineArtifacts.push(art);
          finalPreview = pretty.slice(0, 4000);
        } catch { /* ignore */ }
        continue;
      }
      if (line.includes('🚀 Starting pipeline')) { push('check', 'Pipeline started'); continue; }
      if (line.includes('✅ Pipeline complete')) { push('check', 'Pipeline complete'); status = 'success'; continue; }
      if (line.includes('⚠️ Pipeline halted')) { push('dot', line); status = 'halted'; continue; }
      if (line.includes('🔑 idempotency-key=')) { push('key', line); continue; }
      if (line.includes('⏭️') && /idempotency/i.test(line)) { push('key', line); status = 'halted'; continue; }
      if (line.includes('❌ Pipeline failed')) { push('error', line.replace(/^.*❌\s*/, '')); continue; }
      const stepMatch = line.match(/▶\s*\[(TRIGGER|STEP\s*\d+)\]\s*(.+?)\.\.\.$/);
      if (stepMatch) {
        const isTrigger = stepMatch[1] === 'TRIGGER';
        push(isTrigger ? 'check' : 'dot', `${isTrigger ? 'Trigger fired' : `Step ${++stepIdx}`}: ${stepMatch[2]}`);
        continue;
      }
      if (line.includes('↳')) { push('dot', line.replace(/^\s*↳\s*/, '↳ ')); continue; }
      if (/Missing required env vars/i.test(line)) { push('key', line); continue; }
      if (/^\s*(Error|TypeError|ReferenceError):/.test(line)) { push('error', line); continue; }
      if (line.trim()) push('dot', line);
    }
    if (result.error) { push('error', result.error); status = 'failed'; }
    if (output.length === 0 && !result.error) push('error', 'No output captured. Check console for details.');

    if (inlineArtifacts.length) {
      setStepArtifacts((prev) => [...prev, ...inlineArtifacts]);
      push('check', `Captured ${inlineArtifacts.length} step artifact${inlineArtifacts.length > 1 ? 's' : ''}.`);
    }

    // Persist run history record.
    const finishedAt = Date.now();
    const triggerLabel = blocks[0]?.label ?? 'Manual';
    const record: AutomationRunRecord = {
      id: createId() + Date.now().toString(36),
      startedAt: startedAtIso,
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs: finishedAt - startedAt,
      triggerLabel,
      status,
      stepCount: blocks.length,
      artifactsCount: inlineArtifacts.length,
      finalOutputPreview: finalPreview,
      errorMessage: result.error || undefined,
      logs: collected,
      artifacts: inlineArtifacts,
      preflight: { missing: pf.missing, checkedAt: pf.checkedAt },
    };
    setRunHistory((prev) => [record, ...prev].slice(0, MAX_RUN_HISTORY));

    setIsTestRunning(false);
  }, [blocks, invalidTriggerStart, executeCode, runPreflight]);

  const generateCode = useCallback((lang: 'python' | 'nodejs') => {
    if (blocks.length === 0) { toast.error('Add blocks first.'); return; }
    if (invalidTriggerStart) { toast.error('The first block must be a trigger block.'); return; }
    setCodeLanguage(lang);

    if (lang === 'python') {
      generatePythonCodeImpl();
    } else {
      generateNodeCodeImpl();
    }
  }, [blocks, invalidTriggerStart]);

  /** Resolve {{prev.X}} tokens in a config value into Python code expressions. */
  const resolvePyVar = (val: string): string => {
    // Standalone token → raw expression (no quotes)
    if (/^\{\{prev\.([^}]+)\}\}$/.test(val)) {
      const key = val.match(/^\{\{prev\.([^}]+)\}\}$/)![1];
      return `prev.get("${key}") if prev else None`;
    }
    // Mixed text + tokens → f-string with single-quoted inner strings to avoid quote collision
    const inner = val.replace(/\{\{prev\.([^}]+)\}\}/g, (_, k: string) => `{prev.get('${k}', '') if prev else ''}`);
    return `f"${inner}"`;
  };

  /** Resolve {{prev.X}} tokens in a config value into Node.js code expressions. */
  const resolveJsVar = (val: string): string => {
    // Standalone token → raw expression
    if (/^\{\{prev\.([^}]+)\}\}$/.test(val)) {
      const key = val.match(/^\{\{prev\.([^}]+)\}\}$/)![1];
      return `prev?.${key} ?? null`;
    }
    // Mixed text + tokens → template literal
    const inner = val.replace(/\{\{prev\.([^}]+)\}\}/g, (_, k: string) => `\${prev?.${k} ?? ""}`);
    return `\`${inner}\``;
  };

  const generatePythonCodeImpl = useCallback(() => {
    // ---- Python SDK hint registry ----
    const getPythonSdkHint = (label: string): string | undefined => {
      const normalized = label.toLowerCase();
      if (normalized.includes('google ads')) return 'google-ads';
      if (normalized === 'gmail' || normalized.includes('gmail ')) return 'google-api-python-client';
      if (normalized.includes('openai')) return 'openai';
      if (normalized.includes('anthropic')) return 'anthropic';
      if (normalized.includes('google gemini')) return 'google-genai';
      if (normalized.includes('mistral')) return 'mistralai';
      if (normalized.includes('groq')) return 'groq';
      if (normalized.includes('perplexity')) return 'perplexityai';
      if (normalized.includes('cohere')) return 'cohere';
      if (normalized.includes('together ai')) return 'togetherai';
      if (normalized.includes('hugging face')) return 'huggingface_hub';
      if (normalized.includes('replicate')) return 'replicate';
      if (normalized.includes('elevenlabs')) return 'elevenlabs';
      if (normalized.includes('assemblyai')) return 'assemblyai';
      if (normalized.includes('deepgram')) return 'deepgram';
      if (normalized.includes('rev.ai') || normalized.includes('rev ai')) return 'revai';
      if (normalized.includes('murf')) return 'murf';
      if (normalized.includes('play.ht')) return 'playht';
      if (normalized.includes('suno')) return 'suno';
      if (normalized.includes('github')) return 'PyGithub';
      if (normalized.includes('gitlab')) return 'python-gitlab';
      if (normalized.includes('stripe')) return 'stripe';
      if (normalized.includes('twilio')) return 'twilio';
      if (normalized.includes('slack')) return 'slack-sdk';
      if (normalized.includes('sendgrid')) return 'sendgrid';
      if (normalized.includes('resend')) return 'resend';
      if (normalized.includes('supabase')) return 'supabase';
      if (normalized.includes('sentry')) return 'sentry-sdk';
      if (normalized.includes('vercel')) return 'vercel';
      if (normalized.includes('netlify')) return 'netlify';
      if (normalized.includes('docker hub')) return 'docker';
      if (normalized.includes('uptimerobot')) return 'uptimerobot';
      if (normalized.includes('firebase')) return 'firebase-admin';
      if (normalized.includes('mongodb')) return 'pymongo';
      if (normalized.includes('redis')) return 'redis';
      if (normalized.includes('algolia')) return 'algoliasearch';
      if (normalized.includes('airtable')) return 'airtable';
      if (normalized.includes('notion')) return 'notion-client';
      if (normalized.includes('pinecone')) return 'pinecone-client';
      if (normalized.includes('google sheets')) return 'gspread';
      if (normalized.includes('google drive')) return 'PyDrive2';
      if (normalized.includes('google cloud storage')) return 'google-cloud-storage';
      if (normalized.includes('aws s3')) return 'boto3';
      if (normalized.includes('azure blob')) return 'azure-storage-blob';
      if (normalized.includes('cloudinary')) return 'cloudinary';
      if (normalized.includes('box')) return 'boxsdk';
      if (normalized.includes('dropbox')) return 'dropbox';
      if (normalized.includes('docker')) return 'docker';
      return undefined;
    };

    // ---- Python snippet registry ----
    type PySig = { pip: string; imports: string[]; code: (cfg: Record<string,string>, envVar: string) => string[] };
    const blockSnippets: Record<string, PySig> = {
      'OpenAI': { pip: 'openai', imports: ['from openai import OpenAI'], code: (cfg, ev) => [
        `    # Docs: https://platform.openai.com/docs/api-reference/chat/create`,
        `    client = OpenAI(api_key=${ev})`,
        `    instruction = config.get("prompt", ${JSON.stringify(cfg.prompt || cfg.task || 'Summarize this')})`,
        `    source_text = config.get("input") or (prev.get("result") if prev else None) or ${JSON.stringify(cfg.input || cfg.task || 'Hello')}`,
        `    prompt = f"{instruction}\\n\\n{source_text}" if source_text else instruction`,
        `    response = client.chat.completions.create(model="${cfg.model || 'gpt-4o-mini'}", messages=[{"role": "user", "content": prompt}])`,
        `    return {"result": response.choices[0].message.content}`,
      ]},
      'Google Ads': { pip: 'requests', imports: [], code: (cfg) => [
        `    # Docs: https://developers.google.com/google-ads/api/rest/auth`,
        `    customer_id = config.get("customer_id") or os.getenv("GOOGLE_ADS_CUSTOMER_ID")`,
        `    developer_token = config.get("developer_token") or os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN")`,
        `    access_token = os.getenv("GOOGLE_ADS_ACCESS_TOKEN")`,
        `    if not customer_id or not developer_token or not access_token:`,
        `        raise EnvironmentError("Google Ads requires GOOGLE_ADS_ACCESS_TOKEN, GOOGLE_ADS_DEVELOPER_TOKEN, and GOOGLE_ADS_CUSTOMER_ID (or customer_id in config).")`,
        `    login_customer_id = config.get("login_customer_id") or os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")`,
        `    gaql_query = config.get("query") or ${JSON.stringify(cfg.query || 'SELECT campaign.id, campaign.name, campaign.status FROM campaign ORDER BY campaign.id DESC LIMIT 10')}`,
        `    api_version = config.get("api_version") or os.getenv("GOOGLE_ADS_API_VERSION", "v22")`,
        `    endpoint = config.get("url") or f"https://googleads.googleapis.com/{api_version}/customers/{customer_id}/googleAds:searchStream"`,
        `    headers = {"Authorization": f"Bearer {access_token}", "developer-token": developer_token, "Content-Type": "application/json"}`,
        `    if login_customer_id:`,
        `        headers["login-customer-id"] = str(login_customer_id).replace("-", "")`,
        `    response = requests.post(endpoint, headers=headers, json={"query": gaql_query})`,
        `    response.raise_for_status()`,
        `    data = response.json()`,
        `    rows = []`,
        `    for batch in data if isinstance(data, list) else [data]:`,
        `        rows.extend(batch.get("results", []))`,
        `    return {"status": "ok", "result": json.dumps(rows), "rows": rows, "count": len(rows), **(prev or {})}`,
      ]},
      'Anthropic': { pip: 'anthropic', imports: ['import anthropic'], code: (cfg, ev) => [
        `    client = anthropic.Anthropic(api_key=${ev})`,
        `    prompt = prev.get("result", ${JSON.stringify(cfg.task || 'Hello')}) if prev else ${JSON.stringify(cfg.task || 'Hello')}`,
        `    message = client.messages.create(model="${cfg.model || 'claude-sonnet-4-20250514'}", max_tokens=1024, messages=[{"role": "user", "content": prompt}])`,
        `    return {"result": message.content[0].text}`,
      ]},
      'Google Gemini': { pip: 'google-genai', imports: ['from google import genai'], code: (cfg, ev) => [
        `    client = genai.Client(api_key=${ev})`,
        `    prompt = prev.get("result", ${JSON.stringify(cfg.task || 'Hello')}) if prev else ${JSON.stringify(cfg.task || 'Hello')}`,
        `    response = client.models.generate_content(model="${cfg.model || 'gemini-2.5-flash'}", contents=prompt)`,
        `    return {"result": response.text}`,
      ]},
      'Ollama': { pip: 'requests', imports: [], code: (cfg) => [
        `    base_url = (config.get("base_url") or os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")`,
        `    model_name = config.get("model") or config.get("model_path") or ${JSON.stringify(cfg.model || cfg.model_path || 'llama3.2')}`,
        `    user_prompt = config.get("prompt") or (prev.get("result") if prev else None) or ${JSON.stringify(cfg.prompt || cfg.task || 'Hello from automation')}`,
        `    payload = {"model": model_name, "prompt": user_prompt, "stream": False}`,
        `    system_prompt = config.get("system_prompt") or ${JSON.stringify(cfg.system_prompt || '')}`,
        `    if system_prompt:`,
        `        payload["system"] = system_prompt`,
        `    temperature = config.get("temperature", ${JSON.stringify(cfg.temperature || '0.7')})`,
        `    max_tokens = config.get("max_tokens", ${JSON.stringify(cfg.max_tokens || '512')})`,
        `    payload["options"] = {"temperature": float(temperature), "num_predict": int(max_tokens)}`,
        `    response = requests.post(f"{base_url}/api/generate", json=payload, timeout=120)`,
        `    response.raise_for_status()`,
        `    data = response.json()`,
        `    return {"result": data.get("response", ""), "raw": data}`,
      ]},
      'Mistral AI': { pip: 'mistralai', imports: ['from mistralai import Mistral'], code: (cfg, ev) => [
        `    client = Mistral(api_key=${ev})`,
        `    prompt = prev.get("result", ${JSON.stringify(cfg.task || 'Hello')}) if prev else ${JSON.stringify(cfg.task || 'Hello')}`,
        `    response = client.chat.complete(model="${cfg.model || 'mistral-large-latest'}", messages=[{"role": "user", "content": prompt}])`,
        `    return {"result": response.choices[0].message.content}`,
      ]},
      'Groq': { pip: 'groq', imports: ['from groq import Groq'], code: (cfg, ev) => [
        `    client = Groq(api_key=${ev})`,
        `    prompt = prev.get("result", ${JSON.stringify(cfg.task || 'Hello')}) if prev else ${JSON.stringify(cfg.task || 'Hello')}`,
        `    response = client.chat.completions.create(model="${cfg.model || 'llama-3.3-70b-versatile'}", messages=[{"role": "user", "content": prompt}])`,
        `    return {"result": response.choices[0].message.content}`,
      ]},
      'Perplexity AI': { pip: 'perplexityai', imports: ['from perplexity import Perplexity'], code: (cfg, ev) => [
        `    client = Perplexity(api_key=${ev})`,
        `    response = client.search(${JSON.stringify(cfg.query || '')})`,
        `    return {"result": getattr(response, "answer", None) or getattr(response, "text", None) or str(response)}`,
      ]},
      'Cohere': { pip: 'cohere', imports: ['import cohere'], code: (cfg, ev) => [
        `    co = cohere.ClientV2(api_key=${ev})`,
        `    prompt = prev.get("result", ${JSON.stringify(cfg.task || 'Hello')}) if prev else ${JSON.stringify(cfg.task || 'Hello')}`,
        `    response = co.chat(model="${cfg.model || 'command-a-03-2025'}", messages=[{"role": "user", "content": prompt}])`,
        `    return {"result": response.message.content[0].text}`,
      ]},
      'Resend': { pip: 'resend', imports: ['import resend'], code: (cfg, ev) => [
        `    resend.api_key = ${ev}`,
        `    body_html = prev.get("result", ${JSON.stringify(cfg.body || '<p>Hello!</p>')}) if prev else ${JSON.stringify(cfg.body || '<p>Hello!</p>')}`,
        `    r = resend.Emails.send({"from": "${cfg.from_email || 'you@yourdomain.com'}", "to": ["${cfg.to_email || 'recipient@example.com'}"], "subject": ${JSON.stringify(cfg.subject || 'Hello from automation')}, "html": body_html})`,
        `    return {"email_id": r["id"]}`,
      ]},
      'SendGrid': { pip: 'sendgrid', imports: ['from sendgrid import SendGridAPIClient', 'from sendgrid.helpers.mail import Mail'], code: (cfg, ev) => [
        `    body_html = prev.get("result", ${JSON.stringify(cfg.body || '<p>Hello!</p>')}) if prev else ${JSON.stringify(cfg.body || '<p>Hello!</p>')}`,
        `    message = Mail(from_email="${cfg.from_email || 'you@yourdomain.com'}", to_emails="${cfg.to_email || 'recipient@example.com'}", subject=${JSON.stringify(cfg.subject || 'Hello')}, html_content=body_html)`,
        `    sg = SendGridAPIClient(${ev})`,
        `    response = sg.send(message)`,
        `    return {"status_code": response.status_code}`,
      ]},
      'Twilio': { pip: 'twilio', imports: ['from twilio.rest import Client as TwilioClient'], code: (cfg) => [
        `    # Docs: https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource`,
        `    account_sid = os.getenv("TWILIO_ACCOUNT_SID")`,
        `    auth_token = os.getenv("TWILIO_AUTH_TOKEN")`,
        `    if not account_sid or not auth_token:`,
        `        raise EnvironmentError("Twilio requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.")`,
        `    client = TwilioClient(account_sid, auth_token)`,
        `    body_text = config.get("message") or (prev.get("result") if prev else None) or ${JSON.stringify(cfg.message || 'Hello from automation')}`,
        `    message = client.messages.create(body=body_text, from_="${cfg.from || '+1234567890'}", to="${cfg.to || '+0987654321'}")`,
        `    return {"sid": message.sid, "status": message.status}`,
      ]},
      'Slack': { pip: 'requests', imports: [], code: (cfg) => [
        `    # Docs: https://api.slack.com/messaging/webhooks`,
        `    webhook_url = os.getenv("SLACK_WEBHOOK_URL")`,
        `    if not webhook_url:`,
        `        raise EnvironmentError("Slack webhook requires SLACK_WEBHOOK_URL environment variable.")`,
        `    msg_text = config.get("message") or (prev.get("result") if prev else None) or ${JSON.stringify(cfg.message || 'Hello from automation!')}`,
        `    payload = {"text": msg_text}`,
        `    response = requests.post(webhook_url, json=payload)`,
        `    response.raise_for_status()`,
        `    return {"status": "ok", "status_code": response.status_code}`,
      ]},
      'Discord': { pip: 'requests', imports: [], code: (cfg) => [
        `    webhook_url = config.get("webhook_url", "")`,
        `    msg_text = prev.get("result", ${JSON.stringify(cfg.message || 'Hello!')}) if prev else ${JSON.stringify(cfg.message || 'Hello!')}`,
        `    response = requests.post(webhook_url, json={"content": msg_text})`,
        `    return {"status": response.status_code}`,
      ]},
      'Telegram': { pip: 'requests', imports: [], code: (cfg, ev) => [
        `    bot_token = ${ev}`,
        `    chat_id = "${cfg.chat_id || ''}"`,
        `    msg_text = prev.get("result", ${JSON.stringify(cfg.message || 'Hello!')}) if prev else ${JSON.stringify(cfg.message || 'Hello!')}`,
        `    response = requests.post(f"https://api.telegram.org/bot{bot_token}/sendMessage", json={"chat_id": chat_id, "text": msg_text})`,
        `    return response.json()`,
      ]},
      'Stripe': { pip: 'stripe', imports: ['import stripe'], code: (cfg, ev) => [
        `    stripe.api_key = ${ev}`,
        `    intent = stripe.PaymentIntent.create(amount=${cfg.amount || '1000'}, currency="${cfg.currency || 'usd'}")`,
        `    return {"client_secret": intent.client_secret}`,
      ]},
      'Supabase': { pip: 'supabase', imports: ['from supabase import create_client'], code: (cfg, ev) => [
        `    url = os.getenv("SUPABASE_URL", "${cfg.url || ''}")`,
        `    client = create_client(url, ${ev})`,
        `    response = client.table("${cfg.table || 'items'}").select("*").execute()`,
        `    return {"data": response.data}`,
      ]},
      'Gmail': { pip: 'requests', imports: ['import base64', 'from email.message import EmailMessage'], code: (cfg) => [
        `    # Docs: https://developers.google.com/gmail/api/guides/sending`,
        `    access_token = os.getenv("GMAIL_ACCESS_TOKEN")`,
        `    sender = config.get("from") or os.getenv("GMAIL_SENDER_EMAIL")`,
        `    recipient = config.get("to", ${JSON.stringify(cfg.to || 'recipient@example.com')})`,
        `    if not access_token or not sender:`,
        `        raise EnvironmentError("Gmail requires GMAIL_ACCESS_TOKEN and GMAIL_SENDER_EMAIL environment variables.")`,
        `    msg = EmailMessage()`,
        `    msg["To"] = recipient`,
        `    msg["From"] = sender`,
        `    msg["Subject"] = config.get("subject", ${JSON.stringify(cfg.subject || 'Automation Update')})`,
        `    body_text = config.get("message") or (prev.get("result") if prev else None) or ${JSON.stringify(cfg.message || 'Hello from automation')}`,
        `    msg.set_content(str(body_text))`,
        `    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()`,
        `    response = requests.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",`,
        `        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},`,
        `        json={"raw": raw})`,
        `    response.raise_for_status()`,
        `    data = response.json()`,
        `    return {"status": "ok", "result": json.dumps(data), "response": data, **(prev or {})}`,
      ]},
      'GitHub': { pip: 'requests', imports: [], code: (cfg, ev) => [
        `    headers = {"Authorization": f"Bearer {${ev}}", "Accept": "application/vnd.github+json"}`,
        `    owner, repo = "${cfg.owner || 'owner'}", "${cfg.repo || 'repo'}"`,
        `    response = requests.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)`,
        `    data = response.json()`,
        `    return {"result": json.dumps(data), "data": data, "name": data.get("full_name", ""), "description": data.get("description", ""), "stars": data.get("stargazers_count", 0)}`,
      ]},
      'ElevenLabs': { pip: 'elevenlabs', imports: ['from elevenlabs.client import ElevenLabs as ElevenLabsClient'], code: (cfg, ev) => [
        `    client = ElevenLabsClient(api_key=${ev})`,
        `    text_input = prev.get("result", ${JSON.stringify(cfg.text || 'Hello world')}) if prev else ${JSON.stringify(cfg.text || 'Hello world')}`,
        `    audio = client.text_to_speech.convert(voice_id="${cfg.voice_id || '21m00Tcm4TlvDq8ikWAM'}", text=text_input, model_id="eleven_multilingual_v2")`,
        `    return {"status": "audio_generated"}`,
      ]},
      'Sentry': { pip: 'sentry-sdk', imports: ['import sentry_sdk'], code: (_cfg, ev) => [
        `    sentry_sdk.init(dsn=${ev})`,
        `    sentry_sdk.capture_message("Automation checkpoint reached")`,
        `    return {"status": "event_sent"}`,
      ]},
      'DALL-E': { pip: 'openai', imports: ['from openai import OpenAI'], code: (cfg, ev) => [
        `    client = OpenAI(api_key=${ev})`,
        `    prompt_text = prev.get("result", ${JSON.stringify(cfg.prompt || 'A cute robot')}) if prev else ${JSON.stringify(cfg.prompt || 'A cute robot')}`,
        `    response = client.images.generate(model="dall-e-3", prompt=prompt_text, n=1, size="1024x1024")`,
        `    return {"image_url": response.data[0].url}`,
      ]},
      'Stable Diffusion': { pip: 'stability-sdk', imports: [], code: (cfg, ev) => [
        `    prompt_text = prev.get("result", ${JSON.stringify(cfg.prompt || 'A landscape')}) if prev else ${JSON.stringify(cfg.prompt || 'A landscape')}`,
        `    response = requests.post("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",`,
        `        headers={"Authorization": f"Bearer {${ev}}", "Content-Type": "application/json"},`,
        `        json={"text_prompts": [{"text": prompt_text}]})`,
        `    return {"status": response.status_code}`,
      ]},
    };

    const internalSnippets: Record<string, (cfg: Record<string,string>) => string[]> = {
      'Schedule (Cron)': (cfg) => {
        const schedule = cfg.schedule === 'custom' ? (cfg.cron || '0 9 * * *') : (cfg.schedule || '0 9 * * *');
        return [
          `    # This trigger is informational when run inside run_pipeline().`,
          `    # Recurring execution is handled by start_scheduler() in __main__.`,
          `    print(f"⏰ Trigger: cron=${schedule}, tz={config.get('timezone', 'UTC')}")`,
          `    print(f"   Trigger context resolved; downstream steps will execute now.")`,
          `    return {"triggered": True, "schedule": "${schedule}"}`,
        ];
      },
      'Webhook (Catch)': (cfg) => [
        `    # Single-shot mode: pop the next pending payload from the in-process queue.`,
        `    # The Flask server (started in __main__) feeds payloads into _WEBHOOK_QUEUE.`,
        `    payload = _WEBHOOK_QUEUE.get(timeout=float(os.getenv("WEBHOOK_WAIT_SECS", "30")))`,
        `    print(f"🪝 Webhook received at ${cfg.path || '/webhook'}: {len(str(payload))} bytes")`,
        `    return {"triggered": True, "payload": payload, **(payload if isinstance(payload, dict) else {})}`,
      ],
      'RSS Monitor': (cfg) => [
        `    import feedparser  # pip install feedparser`,
        `    feed = feedparser.parse("${cfg.feed_url || 'https://example.com/feed.xml'}")`,
        `    keyword = config.get("keyword_filter", "").lower()`,
        `    entries = feed.entries[:10]`,
        `    if keyword:`,
        `        entries = [e for e in entries if keyword in e.get("title", "").lower()]`,
        `    print(f"📡 RSS: found {len(entries)} matching entries")`,
        `    return {"triggered": True, "entries": [{"title": e.title, "link": e.link} for e in entries], "count": len(entries)}`,
      ],
      'New Email': (cfg) => [
        `    import imaplib, email as _email`,
        `    from email.header import decode_header`,
        `    host = os.environ["IMAP_HOST"]`,
        `    user = os.environ["IMAP_USER"]`,
        `    pw   = os.environ["IMAP_PASSWORD"]`,
        `    mailbox = config.get("mailbox", "${cfg.mailbox || 'INBOX'}")`,
        `    from_filter = config.get("from_filter", "${cfg.from_filter || ''}")`,
        `    subject_filter = config.get("subject_contains", "${cfg.subject_contains || ''}")`,
        `    M = imaplib.IMAP4_SSL(host)`,
        `    M.login(user, pw)`,
        `    M.select(mailbox)`,
        `    criteria = ['UNSEEN']`,
        `    if from_filter: criteria += ['FROM', from_filter]`,
        `    if subject_filter: criteria += ['SUBJECT', subject_filter]`,
        `    typ, data = M.search(None, *criteria)`,
        `    ids = data[0].split()`,
        `    messages = []`,
        `    for mid in ids[:10]:`,
        `        _, msg_data = M.fetch(mid, '(RFC822)')`,
        `        msg = _email.message_from_bytes(msg_data[0][1])`,
        `        subj_raw, enc = decode_header(msg.get('Subject', ''))[0]`,
        `        subj = subj_raw.decode(enc or 'utf-8') if isinstance(subj_raw, bytes) else subj_raw`,
        `        messages.append({"from": msg.get("From"), "subject": subj, "date": msg.get("Date")})`,
        `    M.logout()`,
        `    print(f"📧 IMAP: {len(messages)} new message(s) in {mailbox}")`,
        `    if not messages: return None`,
        `    return {"triggered": True, "mailbox": mailbox, "messages": messages, "count": len(messages)}`,
      ],
      'FTP Monitor': (cfg) => [
        `    from ftplib import FTP`,
        `    import time as _time`,
        `    host = os.environ.get("FTP_HOST", "${cfg.host || 'ftp.example.com'}")`,
        `    user = os.environ.get("FTP_USER", "anonymous")`,
        `    pw   = os.environ.get("FTP_PASSWORD", "")`,
        `    watch_path = config.get("watch_path", "${cfg.watch_path || '/'}")`,
        `    ftp = FTP(host); ftp.login(user, pw); ftp.cwd(watch_path)`,
        `    files = []`,
        `    ftp.retrlines('LIST', files.append)`,
        `    ftp.quit()`,
        `    print(f"📂 FTP: {len(files)} entries at {host}{watch_path}")`,
        `    return {"triggered": True, "host": host, "path": watch_path, "files": files}`,
      ],
      'File Watcher': (cfg) => [
        `    # Single-shot mode: list current matching files. The watchdog observer (in __main__)`,
        `    # invokes run_pipeline per filesystem event in production.`,
        `    import glob as _glob`,
        `    watch_path = config.get("watch_path", "${cfg.watch_path || './data'}")`,
        `    pattern = config.get("pattern", "${cfg.pattern || '*'}")`,
        `    matches = _glob.glob(os.path.join(watch_path, pattern))`,
        `    print(f"👁️  Watching {watch_path} for {config.get('events', 'created')} files matching {pattern} ({len(matches)} present)")`,
        `    return {"triggered": True, "path": watch_path, "pattern": pattern, "files": matches}`,
      ],
      'Database Change': (cfg) => [
        `    # Single-shot mode: read latest row from the configured table.`,
        `    # The pg_notify listener (in __main__) calls run_pipeline per real event in production.`,
        `    import psycopg2  # pip install psycopg2-binary`,
        `    table = config.get("table", "${cfg.table || 'orders'}")`,
        `    event = config.get("event", "${cfg.event || 'INSERT'}")`,
        `    dsn = os.environ["DATABASE_URL"]`,
        `    with psycopg2.connect(dsn) as _conn, _conn.cursor() as _cur:`,
        `        _cur.execute(f"SELECT row_to_json(t) FROM {table} t ORDER BY 1 DESC LIMIT 1")`,
        `        row = _cur.fetchone()`,
        `    print(f"🗄️  DB: latest row from {table} ({event}) — {row[0] if row else 'no rows'}")`,
        `    return {"triggered": True, "table": table, "event": event, "row": row[0] if row else None}`,
      ],
      'Queue Consumer': (cfg) => [
        `    queue = config.get("queue_name", "${cfg.queue_name || 'my-queue'}")`,
        `    provider = config.get("provider", "${cfg.provider || 'redis'}").lower()`,
        `    batch_size = int(config.get("batch_size", "${cfg.batch_size || '1'}"))`,
        `    if provider == "redis":`,
        `        import redis as _redis  # pip install redis`,
        `        r = _redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))`,
        `        items = []`,
        `        for _ in range(batch_size):`,
        `            v = r.lpop(queue)`,
        `            if v is None: break`,
        `            items.append(v.decode("utf-8", errors="replace"))`,
        `    elif provider == "sqs":`,
        `        import boto3  # pip install boto3`,
        `        sqs = boto3.client("sqs")`,
        `        resp = sqs.receive_message(QueueUrl=queue, MaxNumberOfMessages=min(batch_size, 10), WaitTimeSeconds=5)`,
        `        items = [m["Body"] for m in resp.get("Messages", [])]`,
        `        for m in resp.get("Messages", []): sqs.delete_message(QueueUrl=queue, ReceiptHandle=m["ReceiptHandle"])`,
        `    elif provider == "rabbitmq":`,
        `        import pika  # pip install pika`,
        `        params = pika.URLParameters(os.environ.get("AMQP_URL", "amqp://guest:guest@localhost/"))`,
        `        conn = pika.BlockingConnection(params); ch = conn.channel(); ch.queue_declare(queue=queue, durable=True)`,
        `        items = []`,
        `        for _ in range(batch_size):`,
        `            method, _props, body = ch.basic_get(queue=queue, auto_ack=True)`,
        `            if method is None: break`,
        `            items.append(body.decode("utf-8", errors="replace"))`,
        `        conn.close()`,
        `    else:`,
        `        raise ValueError(f"Unsupported queue provider: {provider}")`,
        `    print(f"📬 {provider}/{queue}: pulled {len(items)} message(s)")`,
        `    if not items: return None`,
        `    return {"triggered": True, "queue": queue, "provider": provider, "messages": items, "count": len(items)}`,
      ],
      'Manual Trigger': (cfg) => [
        `    label = config.get("label", "${cfg.label || 'Run Pipeline'}")`,
        `    print(f"🖱️  Manual trigger: {label}")`,
        `    return {"triggered": True, "manual": True, "label": label, "args": sys.argv[1:]}`,
      ],
      'Filter': () => [
        `    if not prev:`,
        `        print("⚠️  Filter: no input data, skipping")`,
        `        return None`,
        `    condition_key = config.get("field", "status")`,
        `    condition_val = config.get("equals", "ok")`,
        `    if str(prev.get(condition_key)) == condition_val:`,
        `        print(f"✅ Filter passed: {condition_key}={condition_val}")`,
        `        return prev`,
        `    print(f"🚫 Filter blocked: {condition_key}!={condition_val}")`,
        `    return None`,
      ],
      'Delay': (cfg) => [
        `    delay_seconds = int(config.get("seconds", "${cfg.seconds || '5'}"))`,
        `    print(f"⏳ Waiting {delay_seconds}s...")`,
        `    time.sleep(delay_seconds)`,
        `    return prev or {"status": "delayed"}`,
      ],
      'JSON Parser': () => [
        `    raw = prev.get("raw", prev.get("result", "{}")) if prev else "{}"`,
        `    data = json.loads(raw) if isinstance(raw, str) else raw`,
        `    return {"parsed": data}`,
      ],
      'Text Formatter': () => [
        `    text = prev.get("result", prev.get("text", "")) if prev else ""`,
        `    return {"result": text.strip().title()}`,
      ],
      'Loop': () => [
        `    items = prev.get("items", prev.get("data", [])) if prev else []`,
        `    results = []`,
        `    for item in items:`,
        `        results.append({"processed": item})`,
        `    return {"results": results, "count": len(results)}`,
      ],
    };

    const pipPackages = new Set<string>();
    const allImports = new Set<string>(['import requests', 'import json', 'import time', 'import os']);
    const needsAuth: { label: string; envVar: string; extraEnvVars?: string[] }[] = [];

    for (const b of blocks) {
      const snippet = blockSnippets[b.label];
      const sdkHint = getPythonSdkHint(b.label);
      if (snippet) {
        if (snippet.pip !== 'requests') pipPackages.add(snippet.pip);
        snippet.imports.forEach((i) => allImports.add(i));
      }
      if (sdkHint && sdkHint !== 'requests') {
        pipPackages.add(sdkHint);
      }
      if (b.label === 'Google Ads') {
        const ev = 'GOOGLE_ADS_ACCESS_TOKEN';
        if (!needsAuth.find((a) => a.envVar === ev)) {
          const extras: string[] = ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'];
          needsAuth.push({ label: b.label, envVar: ev, extraEnvVars: extras });
        }
      } else if (b.label === 'Gmail') {
        const ev = 'GMAIL_ACCESS_TOKEN';
        if (!needsAuth.find((a) => a.envVar === ev)) {
          const extras: string[] = ['GMAIL_SENDER_EMAIL'];
          needsAuth.push({ label: b.label, envVar: ev, extraEnvVars: extras });
        }
      } else if (b.auth === 'api_key') {
        let ev = `${b.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
        if (b.label === 'Slack') ev = 'SLACK_WEBHOOK_URL';
        if (b.label === 'Twilio') ev = 'TWILIO_ACCOUNT_SID';
        if (!needsAuth.find((a) => a.envVar === ev)) {
          const extras: string[] = [];
          if (b.label === 'Twilio') extras.push('TWILIO_AUTH_TOKEN');
          needsAuth.push({ label: b.label, envVar: ev, extraEnvVars: extras });
        }
      }
    }

    const scheduleBlock = blocks.find((b) => b.label === 'Schedule (Cron)');
    if (scheduleBlock) {
      pipPackages.add('apscheduler');
      allImports.add('from apscheduler.schedulers.blocking import BlockingScheduler');
      allImports.add('from apscheduler.triggers.cron import CronTrigger');
    }

    // Detect trigger type for the listener entrypoint.
    const triggerBlock = blocks[0];
    const triggerLabel = triggerBlock?.label;
    if (triggerLabel === 'Webhook (Catch)') {
      pipPackages.add('flask');
      allImports.add('from flask import Flask, request, jsonify');
      allImports.add('from queue import Queue, Empty');
    }
    if (triggerLabel === 'File Watcher') {
      pipPackages.add('watchdog');
      allImports.add('from watchdog.observers import Observer');
      allImports.add('from watchdog.events import FileSystemEventHandler');
      allImports.add('import fnmatch');
    }
    if (triggerLabel === 'New Email') pipPackages.add('');  // imaplib is stdlib
    if (triggerLabel === 'Database Change') {
      pipPackages.add('psycopg2-binary');
      allImports.add('import select');
    }
    if (triggerLabel === 'Queue Consumer') {
      const provider = (triggerBlock?.config.provider || 'redis').toLowerCase();
      if (provider === 'redis') pipPackages.add('redis');
      else if (provider === 'sqs') pipPackages.add('boto3');
      else if (provider === 'rabbitmq') pipPackages.add('pika');
    }
    if (triggerLabel === 'RSS Monitor') pipPackages.add('feedparser');
    // Always import sys for Manual Trigger argv handling.
    allImports.add('import sys');

    const L: string[] = [];
    L.push('#!/usr/bin/env python3');
    L.push(`"""Auto-generated automation pipeline — ${blocks.length} block${blocks.length > 1 ? 's' : ''}.`);
    L.push('');
    L.push('Usage:');
    const pipList = Array.from(pipPackages);
    if (pipList.length > 0) {
      L.push(`  pip install requests ${pipList.join(' ')}`);
    } else {
      L.push('  pip install requests');
    }
    if (needsAuth.length > 0) {
      L.push('');
      L.push('Environment variables needed:');
      for (const a of needsAuth) {
        L.push(`  export ${a.envVar}="your-key"   # from ${a.label} dashboard`);
        if (a.extraEnvVars) {
          for (const extra of a.extraEnvVars) L.push(`  export ${extra}="your-token"`);
        }
      }
    }
    L.push('"""');
    L.push('');

    // Imports
    L.push([...allImports].join('\n'));
    L.push('');
    if (triggerLabel === 'Webhook (Catch)') {
      L.push('# Cross-thread payload queue between Flask handler and run_pipeline().');
      L.push('_WEBHOOK_QUEUE: "Queue[object]" = Queue()');
      L.push('');
    }
    L.push('');

    // Shared helpers
    L.push('class PipelineStepError(RuntimeError):');
    L.push('    """Raised when a pipeline step fails with context."""');
    L.push('');
    L.push('def _safe_json_loads(raw, *, fallback=None, field_name="value"):');
    L.push('    """Parse JSON when possible; raise a readable error on malformed input."""');
    L.push('    if raw is None or raw == "":');
    L.push('        return fallback');
    L.push('    if isinstance(raw, (dict, list)):');
    L.push('        return raw');
    L.push('    if not isinstance(raw, str):');
    L.push('        raise ValueError(f"{field_name} must be a JSON string, object, or array.")');
    L.push('    try:');
    L.push('        return json.loads(raw)');
    L.push('    except json.JSONDecodeError as exc:');
    L.push('        raise ValueError(f"Invalid JSON in {field_name}: {exc}") from exc');
    L.push('');
    L.push('def _build_headers(config, *, token=None):');
    L.push('    headers = {"Content-Type": "application/json"}');
    L.push('    custom_headers = _safe_json_loads(config.get("headers"), fallback=None, field_name="headers")');
    L.push('    if isinstance(custom_headers, dict):');
    L.push('        headers.update(custom_headers)');
    L.push('    auth_header = config.get("auth_header") or "Authorization"');
    L.push('    auth_prefix = (config.get("auth_prefix", "Bearer") or "").strip()');
    L.push('    if auth_header and token and auth_header not in headers:');
    L.push('        headers[auth_header] = f"{auth_prefix} {token}".strip() if auth_prefix else str(token)');
    L.push('    return headers');
    L.push('');
    L.push('def _request_step(url, config, *, step_name, token=None):');
    L.push('    if not url:');
    L.push('        raise ValueError(f"No API URL configured for {step_name}. Set config.url to a valid endpoint.")');
    L.push('    method = config.get("method", "POST")');
    L.push('    query = _safe_json_loads(config.get("query"), fallback=None, field_name="query")');
    L.push('    body = _safe_json_loads(config.get("body"), fallback=None, field_name="body")');
    L.push('    response = requests.request(method, url, headers=_build_headers(config, token=token), params=query, json=body, timeout=30)');
    L.push('    response.raise_for_status()');
    L.push('    content_type = response.headers.get("Content-Type", "")');
    L.push('    data = response.json() if "application/json" in content_type else {"text": response.text}');
    L.push('    return data');
    L.push('');

    // Credential variables (defined BEFORE step functions)
    if (needsAuth.length > 0) {
      L.push('# --- Credentials (loaded from environment) ---');
      for (const a of needsAuth) {
        L.push(`${a.envVar} = os.getenv("${a.envVar}")`);
        if (a.extraEnvVars) {
          for (const extra of a.extraEnvVars) L.push(`${extra} = os.getenv("${extra}")`);
        }
      }
      L.push('');
      // Validation
      const allEnvVars = Array.from(new Set(needsAuth.flatMap(a => [a.envVar, ...(a.extraEnvVars || [])])));
      L.push('def validate_environment():');
      L.push('    """Return a list of missing environment variables required by this pipeline."""');
      L.push(`    required = [${allEnvVars.map(v => `"${v}"`).join(', ')}]`);
      L.push('    return [name for name in required if not os.getenv(name)]');
      L.push('');
      L.push('');
    }

    // Step functions
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const fn = `step_${i}_${b.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const ev = `${b.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
      const snippet = blockSnippets[b.label];
      const internal = internalSnippets[b.label];

      L.push(`def ${fn}(prev=None):`);
      L.push(`    """${i === 0 ? 'Trigger' : 'Step ' + i}: ${b.label} (${b.subcategory})"""`);
      // Resolve {{prev.*}} tokens in config values
      const resolvedCfg: Record<string,string> = {};
      const prevResolutions: string[] = [];
      for (const [k, v] of Object.entries(b.config)) {
        if (/\{\{prev\.[^}]+\}\}/.test(v)) {
          const pyExpr = resolvePyVar(v);
          resolvedCfg[k] = `__PREV__${k}`;
          prevResolutions.push(`    ${k} = ${pyExpr}`);
        } else {
          resolvedCfg[k] = v;
        }
      }
      L.push(`    config = ${JSON.stringify(resolvedCfg, null, 4).replace(/^/gm, '    ').trimStart()}`);
      if (prevResolutions.length > 0) {
        L.push(`    # Resolve variables from previous step output`);
        for (const line of prevResolutions) L.push(line);
        for (const [k] of Object.entries(resolvedCfg).filter(([,v]) => v.startsWith('__PREV__'))) {
          L.push(`    config["${k}"] = ${k}`);
        }
      }
      L.push(`    print(f"▶ [${i === 0 ? 'TRIGGER' : 'STEP ' + i}] ${b.label}...")`);

      if (snippet) {
        L.push(...snippet.code(b.config, ev));
      } else if (internal) {
        L.push(...internal(b.config));
      } else if (b.auth === 'api_key') {
        const sdkHint = getPythonSdkHint(b.label);
        if (sdkHint) {
          L.push(`    # SDK available: pip install ${sdkHint}`);
          L.push(`    # Replace this generic request with the ${sdkHint} client for ${b.label}`);
        }
        L.push(`    token_val = ${ev}`);
        L.push(`    data = _request_step(config.get("url"), config, step_name=${JSON.stringify(b.label)}, token=token_val)`);
        L.push(`    print(f"  ↳ ${b.label} called: {config.get('url')}")`);
        L.push(`    return {"status": "ok", "result": json.dumps(data), "response": data, **(prev or {})}`);
      } else {
        const sdkHint = getPythonSdkHint(b.label);
        if (sdkHint) {
          L.push(`    # SDK available: pip install ${sdkHint}`);
          L.push(`    # A provider-specific SDK may be available for ${b.label}`);
        }
        L.push(`    data = _request_step(config.get("url"), config, step_name=${JSON.stringify(b.label)})`);
        L.push(`    print(f"  ↳ ${b.label} executed against {config.get('url')}")`);
        L.push(`    return {"status": "ok", "result": json.dumps(data), "response": data, **(prev or {})}`);
      }
      L.push('');
      L.push('');
    }

    // Pipeline runner
    L.push('def run_pipeline():');
    L.push('    """Execute the full automation pipeline, passing data between steps."""');
    L.push('    print("🚀 Starting pipeline...")');
    L.push('    result = None');
    L.push('    try:');
    for (let i = 0; i < blocks.length; i++) {
      const fn = `step_${i}_${blocks[i].label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      L.push(`        result = ${fn}(prev=result)`);
      L.push(`        if result is None:`);
      L.push(`            print("⚠️  Pipeline halted at step ${i} (returned None)")`);
      L.push(`            return None`);
    }
    L.push('    except Exception as e:');
    L.push('        print(f"❌ Pipeline failed: {e}")');
    L.push('        raise');
    L.push('    print("✅ Pipeline complete!")');
    L.push('    return result');
    L.push('');
    // ---- Listener entrypoint (real, production-ready per trigger) ----
    const envCheck = needsAuth.length > 0
      ? [
          '    missing = validate_environment()',
          '    if missing:',
          '        raise EnvironmentError(f"Missing required env vars: {\', \'.join(missing)}")',
        ]
      : [];

    if (scheduleBlock) {
      const schedule = scheduleBlock.config.schedule === 'custom'
        ? (scheduleBlock.config.cron || '0 9 * * *')
        : (scheduleBlock.config.schedule || '0 9 * * *');
      const timezone = scheduleBlock.config.timezone || 'UTC';
      L.push('def start_listener():');
      L.push('    """Run the pipeline repeatedly using APScheduler."""');
      L.push(`    cron_expr = os.getenv("PIPELINE_CRON", "${schedule}")`);
      L.push(`    timezone = os.getenv("PIPELINE_TIMEZONE", "${timezone}")`);
      L.push('    scheduler = BlockingScheduler(timezone=timezone)');
      L.push('    scheduler.add_job(run_pipeline, CronTrigger.from_crontab(cron_expr, timezone=timezone))');
      L.push('    print(f"🕒 Scheduler started: cron={cron_expr}, timezone={timezone}")');
      L.push('    run_pipeline()  # immediate run on startup');
      L.push('    scheduler.start()');
    } else if (triggerLabel === 'Webhook (Catch)') {
      const path = (triggerBlock?.config.path || triggerBlock?.config.url || '/webhook').toString();
      const method = (triggerBlock?.config.method || 'POST').toString().toUpperCase();
      L.push('def start_listener():');
      L.push('    """Start a Flask webhook server that runs the pipeline per request."""');
      L.push('    app = Flask(__name__)');
      L.push(`    @app.route(${JSON.stringify(path)}, methods=[${JSON.stringify(method)}])`);
      L.push('    def _handle():');
      L.push('        payload = request.get_json(silent=True) or request.form.to_dict() or {}');
      L.push('        _WEBHOOK_QUEUE.put(payload)');
      L.push('        try:');
      L.push('            result = run_pipeline()');
      L.push('            return jsonify({"ok": True, "result": result}), 200');
      L.push('        except Exception as e:');
      L.push('            return jsonify({"ok": False, "error": str(e)}), 500');
      L.push('    host = os.getenv("HOST", "0.0.0.0")');
      L.push('    port = int(os.getenv("PORT", "8000"))');
      L.push(`    print(f"🪝 Webhook listening on http://{host}:{port}${path}")`);
      L.push('    app.run(host=host, port=port)');
    } else if (triggerLabel === 'File Watcher') {
      const watchPath = triggerBlock?.config.watch_path || './data';
      const pattern = triggerBlock?.config.pattern || '*';
      const events = (triggerBlock?.config.events || 'created').toString();
      L.push('def start_listener():');
      L.push('    """Watch a directory and run the pipeline on each matching event."""');
      L.push(`    watch_path = os.getenv("WATCH_PATH", ${JSON.stringify(watchPath)})`);
      L.push(`    pattern = os.getenv("WATCH_PATTERN", ${JSON.stringify(pattern)})`);
      L.push('    class _Handler(FileSystemEventHandler):');
      L.push('        def _maybe_run(self, kind, path):');
      L.push(`            if not fnmatch.fnmatch(os.path.basename(path), pattern): return`);
      L.push('            print(f"👁️  {kind}: {path}")');
      L.push('            try: run_pipeline()');
      L.push('            except Exception as e: print(f"❌ pipeline error: {e}")');
      if (events.includes('created') || events === 'all') L.push('        def on_created(self, event): self._maybe_run("created", event.src_path)');
      if (events.includes('modified') || events === 'all') L.push('        def on_modified(self, event): self._maybe_run("modified", event.src_path)');
      if (events.includes('deleted') || events === 'all') L.push('        def on_deleted(self, event): self._maybe_run("deleted", event.src_path)');
      L.push('    obs = Observer(); obs.schedule(_Handler(), watch_path, recursive=True); obs.start()');
      L.push(`    print(f"👁️  Watching {watch_path} for {pattern}")`);
      L.push('    try:');
      L.push('        while True: time.sleep(1)');
      L.push('    except KeyboardInterrupt:');
      L.push('        obs.stop()');
      L.push('    obs.join()');
      // ensure `time` is importable
      allImports.add('import time');
    } else if (triggerLabel === 'Database Change') {
      const channel = triggerBlock?.config.channel || `${(triggerBlock?.config.table || 'orders')}_changes`;
      L.push('def start_listener():');
      L.push('    """Listen for Postgres NOTIFY messages on a channel and run the pipeline per event."""');
      L.push('    import psycopg2  # pip install psycopg2-binary');
      L.push('    import psycopg2.extensions');
      L.push('    dsn = os.environ["DATABASE_URL"]');
      L.push(`    channel = os.getenv("PG_NOTIFY_CHANNEL", ${JSON.stringify(channel)})`);
      L.push('    conn = psycopg2.connect(dsn)');
      L.push('    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)');
      L.push('    cur = conn.cursor(); cur.execute(f"LISTEN {channel}")');
      L.push('    print(f"🗄️  Listening on Postgres channel \\"{channel}\\"")');
      L.push('    while True:');
      L.push('        if select.select([conn], [], [], 60) == ([], [], []): continue');
      L.push('        conn.poll()');
      L.push('        while conn.notifies:');
      L.push('            n = conn.notifies.pop(0)');
      L.push('            print(f"  ↳ NOTIFY {n.channel}: {n.payload}")');
      L.push('            try: run_pipeline()');
      L.push('            except Exception as e: print(f"❌ pipeline error: {e}")');
    } else if (triggerLabel === 'Queue Consumer') {
      L.push('def start_listener():');
      L.push('    """Continuously consume from the queue and run the pipeline per message."""');
      L.push('    import time as _time');
      L.push('    while True:');
      L.push('        try:');
      L.push('            r = run_pipeline()');
      L.push('            if r is None: _time.sleep(2)');
      L.push('        except Exception as e:');
      L.push('            print(f"❌ pipeline error: {e}"); _time.sleep(5)');
    } else if (triggerLabel === 'New Email' || triggerLabel === 'FTP Monitor' || triggerLabel === 'RSS Monitor') {
      const intervalSec = triggerLabel === 'RSS Monitor' ? 300 : 60;
      L.push('def start_listener():');
      L.push(`    """Poll the ${triggerLabel} trigger every POLL_INTERVAL seconds."""`);
      L.push('    import time as _time');
      L.push(`    interval = int(os.getenv("POLL_INTERVAL", "${intervalSec}"))`);
      L.push(`    print(f"🔁 Polling ${triggerLabel} every {interval}s")`);
      L.push('    while True:');
      L.push('        try: run_pipeline()');
      L.push('        except Exception as e: print(f"❌ pipeline error: {e}")');
      L.push('        _time.sleep(interval)');
    } else {
      // Manual Trigger or no specialised listener — just run once.
      L.push('def start_listener():');
      L.push('    """No long-running listener for this trigger; running pipeline once."""');
      L.push('    run_pipeline()');
    }

    L.push('');
    L.push('');
    L.push('if __name__ == "__main__":');
    for (const line of envCheck) L.push(line);
    L.push('    if os.getenv("RUN_ONCE", "0") == "1":');
    L.push('        run_pipeline()');
    L.push('    else:');
    L.push('        start_listener()');

    const code = L.join('\n') + '\n';
    setPythonCode(code);
    toast.success('Python code generated!');
    return code;
  }, [blocks]);

  // ---- Node.js code generation ----
  const generateNodeCodeImpl = useCallback(() => {
    const getNodeSdkHint = (label: string): string | undefined => {
      const normalized = label.toLowerCase();
      if (normalized.includes('openai')) return 'openai';
      if (normalized.includes('anthropic')) return '@anthropic-ai/sdk';
      if (normalized.includes('google gemini')) return '@google/genai';
      if (normalized.includes('mistral')) return 'mistralai';
      if (normalized.includes('groq')) return 'groq';
      if (normalized.includes('perplexity')) return 'perplexityai';
      if (normalized.includes('cohere')) return 'cohere';
      if (normalized.includes('together ai')) return 'togetherai';
      if (normalized.includes('hugging face')) return '@huggingface/inference';
      if (normalized.includes('replicate')) return 'replicate';
      if (normalized.includes('github')) return '@octokit/rest';
      if (normalized.includes('gitlab')) return '@gitbeaker/node';
      if (normalized.includes('stripe')) return 'stripe';
      if (normalized.includes('twilio')) return 'twilio';
      if (normalized.includes('slack')) return '@slack/web-api';
      if (normalized.includes('sendgrid')) return '@sendgrid/mail';
      if (normalized.includes('resend')) return 'resend';
      if (normalized.includes('supabase')) return '@supabase/supabase-js';
      if (normalized.includes('sentry')) return '@sentry/node';
      if (normalized.includes('vercel')) return 'vercel';
      if (normalized.includes('netlify')) return 'netlify';
      if (normalized.includes('docker hub')) return 'dockerode';
      if (normalized.includes('uptimerobot')) return 'uptimerobot';
      if (normalized.includes('firebase')) return 'firebase-admin';
      if (normalized.includes('mongodb')) return 'mongodb';
      if (normalized.includes('redis')) return 'redis';
      if (normalized.includes('algolia')) return 'algoliasearch';
      if (normalized.includes('airtable')) return 'airtable';
      if (normalized.includes('notion')) return '@notionhq/client';
      if (normalized.includes('pinecone')) return '@pinecone/client';
      if (normalized.includes('google sheets') || normalized.includes('google drive') || normalized.includes('google cloud storage')) return 'googleapis';
      if (normalized.includes('aws s3')) return 'aws-sdk';
      if (normalized.includes('azure blob')) return '@azure/storage-blob';
      if (normalized.includes('cloudinary')) return 'cloudinary';
      if (normalized.includes('dropbox')) return 'dropbox';
      if (normalized.includes('box')) return 'box-node-sdk';
      return undefined;
    };
    type NodeSig = { npm: string; imports: string[]; code: (cfg: Record<string,string>, envVar: string) => string[] };
    const blockSnippets: Record<string, NodeSig> = {
      'OpenAI': { npm: 'openai', imports: ['const OpenAI = require("openai");'], code: (cfg, ev) => [
        `  const client = new OpenAI({ apiKey: ${ev} });`,
        `  const prompt = prev?.result ?? ${JSON.stringify(cfg.task || 'Hello')};`,
        `  const response = await client.chat.completions.create({ model: "${cfg.model || 'gpt-4o-mini'}", messages: [{ role: "user", content: prompt }] });`,
        `  return { result: response.choices[0].message.content };`,
      ]},
      'Anthropic': { npm: '@anthropic-ai/sdk', imports: ['const Anthropic = require("@anthropic-ai/sdk");'], code: (cfg, ev) => [
        `  const client = new Anthropic({ apiKey: ${ev} });`,
        `  const prompt = prev?.result ?? ${JSON.stringify(cfg.task || 'Hello')};`,
        `  const message = await client.messages.create({ model: "${cfg.model || 'claude-sonnet-4-20250514'}", max_tokens: 1024, messages: [{ role: "user", content: prompt }] });`,
        `  return { result: message.content[0].text };`,
      ]},
      'Google Gemini': { npm: '@google/genai', imports: ['const { GoogleGenAI } = require("@google/genai");'], code: (cfg, ev) => [
        `  const ai = new GoogleGenAI({ apiKey: ${ev} });`,
        `  const prompt = prev?.result ?? ${JSON.stringify(cfg.task || 'Hello')};`,
        `  const response = await ai.models.generateContent({ model: "${cfg.model || 'gemini-2.5-flash'}", contents: prompt });`,
        `  return { result: response.text };`,
      ]},
      'Ollama': { npm: 'ollama', imports: ['const ollama = require("ollama");'], code: (cfg) => [
        `  const host = (config.base_url || process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\\/$/, "");`,
        `  const model = config.model || config.model_path || ${JSON.stringify(cfg.model || cfg.model_path || 'llama3.2')};`,
        `  const prompt = config.prompt || prev?.result || ${JSON.stringify(cfg.prompt || cfg.task || 'Hello from automation')};`,
        `  const system = config.system_prompt || ${JSON.stringify(cfg.system_prompt || '')};`,
        `  const temperature = Number(config.temperature ?? ${JSON.stringify(cfg.temperature || '0.7')});`,
        `  const numPredict = Number(config.max_tokens ?? ${JSON.stringify(cfg.max_tokens || '512')});`,
        `  const response = await ollama.generate({ host, model, prompt, system: system || undefined, stream: false, options: { temperature, num_predict: numPredict } });`,
        `  return { result: response.response || "", raw: response };`,
      ]},
      'Resend': { npm: 'resend', imports: ['const { Resend } = require("resend");'], code: (cfg, ev) => [
        `  const resend = new Resend(${ev});`,
        `  const bodyHtml = prev?.result ?? ${JSON.stringify(cfg.body || '<p>Hello!</p>')};`,
        `  const { data } = await resend.emails.send({ from: "${cfg.from_email || 'you@yourdomain.com'}", to: ["${cfg.to_email || 'recipient@example.com'}"], subject: ${JSON.stringify(cfg.subject || 'Hello from automation')}, html: bodyHtml });`,
        `  return { email_id: data?.id };`,
      ]},
      'Slack': { npm: 'node-fetch', imports: ['const fetch = require("node-fetch");'], code: (cfg) => [
        `  // Docs: https://api.slack.com/messaging/webhooks`,
        `  const webhookUrl = process.env.SLACK_WEBHOOK_URL;`,
        `  if (!webhookUrl) throw new Error("Slack webhook requires SLACK_WEBHOOK_URL environment variable.");`,
        `  const msgText = config.message || prev?.result || ${JSON.stringify(cfg.message || 'Hello from automation!')};`,
        `  const response = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msgText }) });`,
        `  if (!response.ok) throw new Error(\`Slack webhook failed: \${response.status}\`);`,
        `  return { status: "ok", statusCode: response.status };`,
      ]},
      'Stripe': { npm: 'stripe', imports: ['const Stripe = require("stripe");'], code: (cfg, ev) => [
        `  const stripe = new Stripe(${ev});`,
        `  const intent = await stripe.paymentIntents.create({ amount: ${cfg.amount || '1000'}, currency: "${cfg.currency || 'usd'}" });`,
        `  return { client_secret: intent.client_secret };`,
      ]},
      'Twilio': { npm: 'twilio', imports: ['const twilio = require("twilio");'], code: (cfg) => [
        `  // Docs: https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource`,
        `  const accountSid = process.env.TWILIO_ACCOUNT_SID;`,
        `  const authToken = process.env.TWILIO_AUTH_TOKEN;`,
        `  if (!accountSid || !authToken) throw new Error("Twilio requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");`,
        `  const client = twilio(accountSid, authToken);`,
        `  const bodyText = config.message || prev?.result || ${JSON.stringify(cfg.message || 'Hello from automation')};`,
        `  const message = await client.messages.create({ body: bodyText, from: "${cfg.from || '+1234567890'}", to: "${cfg.to || '+0987654321'}" });`,
        `  return { sid: message.sid, status: message.status };`,
      ]},
      'GitHub': { npm: 'node-fetch', imports: ['const fetch = require("node-fetch");'], code: (cfg, ev) => [
        `  const res = await fetch(\`https://api.github.com/repos/${cfg.owner || 'owner'}/${cfg.repo || 'repo'}\`, { headers: { Authorization: \`Bearer \${${ev}}\`, Accept: "application/vnd.github+json" } });`,
        `  const data = await res.json();`,
        `  return { result: JSON.stringify(data), data, name: data.full_name || "", description: data.description || "", stars: data.stargazers_count || 0 };`,
      ]},
      'Supabase': { npm: '@supabase/supabase-js', imports: ['const { createClient } = require("@supabase/supabase-js");'], code: (cfg, ev) => [
        `  const supabase = createClient(process.env.SUPABASE_URL || "${cfg.url || ''}", ${ev});`,
        `  const { data } = await supabase.from("${cfg.table || 'items'}").select("*");`,
        `  return { data };`,
      ]},
      'Discord': { npm: 'node-fetch', imports: ['const fetch = require("node-fetch");'], code: (cfg) => [
        `  const msgText = prev?.result ?? ${JSON.stringify(cfg.message || 'Hello!')};`,
        `  const res = await fetch(config.webhook_url || "", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: msgText }) });`,
        `  return { status: res.status };`,
      ]},
      'Telegram': { npm: 'node-fetch', imports: ['const fetch = require("node-fetch");'], code: (cfg, ev) => [
        `  const msgText = prev?.result ?? ${JSON.stringify(cfg.message || 'Hello!')};`,
        `  const res = await fetch(\`https://api.telegram.org/bot\${${ev}}/sendMessage\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: "${cfg.chat_id || ''}", text: msgText }) });`,
        `  return await res.json();`,
      ]},
      'ElevenLabs': { npm: 'elevenlabs', imports: ['const { ElevenLabsClient } = require("elevenlabs");'], code: (cfg, ev) => [
        `  const client = new ElevenLabsClient({ apiKey: ${ev} });`,
        `  const textInput = prev?.result ?? ${JSON.stringify(cfg.text || 'Hello world')};`,
        `  const audio = await client.textToSpeech.convert("${cfg.voice_id || '21m00Tcm4TlvDq8ikWAM'}", { text: textInput, model_id: "eleven_multilingual_v2" });`,
        `  return { status: "audio_generated" };`,
      ]},
      'DALL-E': { npm: 'openai', imports: ['const OpenAI = require("openai");'], code: (cfg, ev) => [
        `  const client = new OpenAI({ apiKey: ${ev} });`,
        `  const promptText = prev?.result ?? ${JSON.stringify(cfg.prompt || 'A cute robot')};`,
        `  const response = await client.images.generate({ model: "dall-e-3", prompt: promptText, n: 1, size: "1024x1024" });`,
        `  return { image_url: response.data[0].url };`,
      ]},
    };

    const internalSnippets: Record<string, (cfg: Record<string,string>) => string[]> = {
      'Schedule (Cron)': (cfg) => [
        `  // Single-shot execution. Recurring runs are wired up in startListener() at the bottom.`,
        `  console.log(\`⏰ Scheduled trigger fired (cron=${cfg.cron || cfg.schedule || '0 9 * * *'})\`);`,
        `  return { triggered: true, schedule: ${JSON.stringify(cfg.cron || cfg.schedule || '0 9 * * *')} };`,
      ],
      'Webhook (Catch)': (cfg) => [
        `  // Single-shot mode: take the next payload pushed by the Express handler.`,
        `  const payload = await _webhookQueue.next(parseInt(process.env.WEBHOOK_WAIT_SECS || "30", 10) * 1000);`,
        `  console.log(\`🪝 Webhook payload received (\${JSON.stringify(payload).length} bytes)\`);`,
        `  return { triggered: true, payload, ...(payload && typeof payload === "object" ? payload : {}) };`,
        `  // Path: ${cfg.path || cfg.url || '/webhook'}`,
      ],
      'RSS Monitor': (cfg) => [
        `  const Parser = require("rss-parser"); // npm install rss-parser`,
        `  const parser = new Parser();`,
        `  const feed = await parser.parseURL(${JSON.stringify(cfg.feed_url || 'https://example.com/feed.xml')});`,
        `  const keyword = (config.keyword_filter || "").toLowerCase();`,
        `  let entries = (feed.items || []).slice(0, 10);`,
        `  if (keyword) entries = entries.filter(e => (e.title || "").toLowerCase().includes(keyword));`,
        `  console.log(\`📡 RSS: \${entries.length} matching entries\`);`,
        `  return { triggered: true, entries: entries.map(e => ({ title: e.title, link: e.link })), count: entries.length };`,
      ],
      'New Email': (cfg) => [
        `  const { ImapFlow } = require("imapflow"); // npm install imapflow`,
        `  const client = new ImapFlow({`,
        `    host: process.env.IMAP_HOST,`,
        `    port: parseInt(process.env.IMAP_PORT || "993", 10),`,
        `    secure: true,`,
        `    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },`,
        `    logger: false,`,
        `  });`,
        `  await client.connect();`,
        `  const lock = await client.getMailboxLock(${JSON.stringify(cfg.mailbox || 'INBOX')});`,
        `  const messages = [];`,
        `  try {`,
        `    const search = { seen: false };`,
        `    if (config.from_filter) search.from = config.from_filter;`,
        `    if (config.subject_contains) search.subject = config.subject_contains;`,
        `    for await (const msg of client.fetch(search, { envelope: true })) {`,
        `      messages.push({ from: msg.envelope?.from?.[0]?.address, subject: msg.envelope?.subject, date: msg.envelope?.date });`,
        `      if (messages.length >= 10) break;`,
        `    }`,
        `  } finally { lock.release(); await client.logout(); }`,
        `  console.log(\`📧 IMAP: \${messages.length} new message(s)\`);`,
        `  if (!messages.length) return null;`,
        `  return { triggered: true, messages, count: messages.length };`,
      ],
      'FTP Monitor': (cfg) => [
        `  const ftp = require("basic-ftp"); // npm install basic-ftp`,
        `  const client = new ftp.Client();`,
        `  await client.access({`,
        `    host: process.env.FTP_HOST || ${JSON.stringify(cfg.host || 'ftp.example.com')},`,
        `    user: process.env.FTP_USER || "anonymous",`,
        `    password: process.env.FTP_PASSWORD || "",`,
        `  });`,
        `  const list = await client.list(${JSON.stringify(cfg.watch_path || '/')});`,
        `  client.close();`,
        `  console.log(\`📂 FTP: \${list.length} entries\`);`,
        `  return { triggered: true, files: list.map(f => ({ name: f.name, size: f.size, modified: f.modifiedAt })) };`,
      ],
      'File Watcher': (cfg) => [
        `  // Single-shot mode: list current matching files. The chokidar watcher (in startListener)`,
        `  // calls runPipeline per filesystem event in production.`,
        `  const fs = require("fs"), path = require("path");`,
        `  const watchPath = config.watch_path || ${JSON.stringify(cfg.watch_path || './data')};`,
        `  const pattern = new RegExp("^" + (config.pattern || ${JSON.stringify(cfg.pattern || '*')}).replace(/[.+?^$\{\}()|[\\]\\\\]/g, "\\\\$&").replace(/\\*/g, ".*") + "$");`,
        `  const files = fs.existsSync(watchPath) ? fs.readdirSync(watchPath).filter(f => pattern.test(f)).map(f => path.join(watchPath, f)) : [];`,
        `  console.log(\`👁️  Watching \${watchPath} (\${files.length} files match)\`);`,
        `  return { triggered: true, path: watchPath, files };`,
      ],
      'Database Change': (cfg) => [
        `  // Single-shot mode: read latest row. The pg LISTEN/NOTIFY listener handles real events.`,
        `  const { Client } = require("pg"); // npm install pg`,
        `  const client = new Client({ connectionString: process.env.DATABASE_URL });`,
        `  await client.connect();`,
        `  const table = config.table || ${JSON.stringify(cfg.table || 'orders')};`,
        `  const { rows } = await client.query(\`SELECT row_to_json(t) AS row FROM \${table} t ORDER BY 1 DESC LIMIT 1\`);`,
        `  await client.end();`,
        `  console.log(\`🗄️  DB: latest row from \${table}\`);`,
        `  return { triggered: true, table, event: config.event || ${JSON.stringify(cfg.event || 'INSERT')}, row: rows[0]?.row || null };`,
      ],
      'Queue Consumer': (cfg) => [
        `  const queue = config.queue_name || ${JSON.stringify(cfg.queue_name || 'my-queue')};`,
        `  const provider = (config.provider || ${JSON.stringify(cfg.provider || 'redis')}).toLowerCase();`,
        `  const batchSize = parseInt(config.batch_size || ${JSON.stringify(cfg.batch_size || '1')}, 10);`,
        `  let items = [];`,
        `  if (provider === "redis") {`,
        `    const Redis = require("ioredis"); // npm install ioredis`,
        `    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379/0");`,
        `    for (let i = 0; i < batchSize; i++) { const v = await redis.lpop(queue); if (v == null) break; items.push(v); }`,
        `    redis.disconnect();`,
        `  } else if (provider === "sqs") {`,
        `    const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs"); // npm install @aws-sdk/client-sqs`,
        `    const sqs = new SQSClient({});`,
        `    const resp = await sqs.send(new ReceiveMessageCommand({ QueueUrl: queue, MaxNumberOfMessages: Math.min(batchSize, 10), WaitTimeSeconds: 5 }));`,
        `    for (const m of (resp.Messages || [])) { items.push(m.Body); await sqs.send(new DeleteMessageCommand({ QueueUrl: queue, ReceiptHandle: m.ReceiptHandle })); }`,
        `  } else if (provider === "rabbitmq") {`,
        `    const amqp = require("amqplib"); // npm install amqplib`,
        `    const conn = await amqp.connect(process.env.AMQP_URL || "amqp://guest:guest@localhost"); const ch = await conn.createChannel();`,
        `    await ch.assertQueue(queue, { durable: true });`,
        `    for (let i = 0; i < batchSize; i++) { const msg = await ch.get(queue, { noAck: true }); if (!msg) break; items.push(msg.content.toString()); }`,
        `    await conn.close();`,
        `  } else { throw new Error("Unsupported queue provider: " + provider); }`,
        `  console.log(\`📬 \${provider}/\${queue}: \${items.length} message(s)\`);`,
        `  if (!items.length) return null;`,
        `  return { triggered: true, queue, provider, messages: items, count: items.length };`,
      ],
      'Manual Trigger': (cfg) => [
        `  const label = config.label || ${JSON.stringify(cfg.label || 'Run Pipeline')};`,
        `  console.log(\`🖱️  Manual trigger: \${label}\`);`,
        `  return { triggered: true, manual: true, label, args: process.argv.slice(2) };`,
      ],
      'Filter': () => [
        `  if (!prev) { console.log("⚠️ Filter: no input data"); return null; }`,
        `  const field = config.field || "status";`,
        `  const expected = config.equals || "ok";`,
        `  if (String(prev[field]) === expected) { console.log(\`✅ Filter passed: \${field}=\${expected}\`); return prev; }`,
        `  console.log(\`🚫 Filter blocked: \${field}!=\${expected}\`); return null;`,
      ],
      'Delay': (cfg) => [
        `  const ms = parseInt(config.seconds || "${cfg.seconds || '5'}", 10) * 1000;`,
        `  console.log(\`⏳ Waiting \${ms / 1000}s...\`);`,
        `  await new Promise(r => setTimeout(r, ms));`,
        `  return prev || { status: "delayed" };`,
      ],
      'JSON Parser': () => [
        `  const raw = prev?.raw ?? prev?.result ?? "{}";`,
        `  return { parsed: typeof raw === "string" ? JSON.parse(raw) : raw };`,
      ],
      'Text Formatter': () => [
        `  const text = (prev?.result ?? prev?.text ?? "").trim();`,
        `  return { result: text.charAt(0).toUpperCase() + text.slice(1) };`,
      ],
      'Loop': () => [
        `  const items = prev?.items ?? prev?.data ?? [];`,
        `  const results = items.map(item => ({ processed: item }));`,
        `  return { results, count: results.length };`,
      ],
    };

    const npmPackages = new Set<string>();
    const allImports = new Set<string>();
    const needsAuth: { label: string; envVar: string; extraEnvVars?: string[] }[] = [];

    for (const b of blocks) {
      const snippet = blockSnippets[b.label];
      const sdkHint = getNodeSdkHint(b.label);
      if (snippet) {
        if (!['node-fetch'].includes(snippet.npm)) npmPackages.add(snippet.npm);
        snippet.imports.forEach((i) => allImports.add(i));
      }
      if (sdkHint) npmPackages.add(sdkHint);
      if (b.auth === 'api_key') {
        let ev = `${b.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
        if (b.label === 'Slack') ev = 'SLACK_WEBHOOK_URL';
        if (b.label === 'Twilio') ev = 'TWILIO_ACCOUNT_SID';
        if (!needsAuth.find((a) => a.envVar === ev)) {
          const extras: string[] = [];
          if (b.label === 'Twilio') extras.push('TWILIO_AUTH_TOKEN');
          needsAuth.push({ label: b.label, envVar: ev, extraEnvVars: extras });
        }
      }
    }

    const needsFetchFallback = blocks.some((b) => !blockSnippets[b.label] && !internalSnippets[b.label] && (b.auth === 'api_key' || b.auth === 'free'));
    if (needsFetchFallback) {
      npmPackages.add('node-fetch');
      allImports.add('const fetch = require("node-fetch");');
    }

    // Trigger-specific npm packages for the listener entrypoint.
    const triggerBlock = blocks[0];
    const triggerLabel = triggerBlock?.label;
    if (triggerLabel === 'Schedule (Cron)') npmPackages.add('node-cron');
    if (triggerLabel === 'Webhook (Catch)') npmPackages.add('express');
    if (triggerLabel === 'File Watcher') npmPackages.add('chokidar');
    if (triggerLabel === 'New Email') npmPackages.add('imapflow');
    if (triggerLabel === 'FTP Monitor') npmPackages.add('basic-ftp');
    if (triggerLabel === 'RSS Monitor') npmPackages.add('rss-parser');
    if (triggerLabel === 'Database Change') npmPackages.add('pg');
    if (triggerLabel === 'Queue Consumer') {
      const provider = (triggerBlock?.config.provider || 'redis').toLowerCase();
      if (provider === 'redis') npmPackages.add('ioredis');
      else if (provider === 'sqs') npmPackages.add('@aws-sdk/client-sqs');
      else if (provider === 'rabbitmq') npmPackages.add('amqplib');
    }

    const L: string[] = [];
    L.push('#!/usr/bin/env node');
    L.push(`/**`);
    L.push(` * Auto-generated automation pipeline — ${blocks.length} block${blocks.length > 1 ? 's' : ''}.`);
    L.push(` *`);
    L.push(` * Setup:`);
    const npmList = Array.from(npmPackages);
    L.push(` *   npm install ${['dotenv', ...npmList].join(' ')}`);
    if (needsAuth.length > 0) {
      L.push(` *`);
      L.push(` * Create a .env file with:`);
      for (const a of needsAuth) {
        L.push(` *   ${a.envVar}=your-key-here`);
        if (a.extraEnvVars) for (const extra of a.extraEnvVars) L.push(` *   ${extra}=your-token-here`);
      }
    }
    L.push(` */`);
    L.push('');
    L.push('require("dotenv").config();');
    [...allImports].forEach(i => L.push(i));
    L.push('');

    // Credentials
    if (needsAuth.length > 0) {
      L.push('// --- Credentials (loaded from environment) ---');
      for (const a of needsAuth) {
        L.push(`const ${a.envVar} = process.env.${a.envVar};`);
        if (a.extraEnvVars) for (const extra of a.extraEnvVars) L.push(`const ${extra} = process.env.${extra};`);
      }
      const allEnvVars = needsAuth.flatMap(a => [a.envVar, ...(a.extraEnvVars || [])]);
      L.push('');
      L.push('// Validate required credentials');
      L.push(`const _missing = [${allEnvVars.map(v => `"${v}"`).join(', ')}].filter(k => !process.env[k]);`);
      L.push('if (_missing.length) throw new Error(`Missing required env vars: ${_missing.join(", ")}`);');
      L.push('');
    }

    // Webhook queue helper (only if needed by trigger).
    if (triggerLabel === 'Webhook (Catch)') {
      L.push('// Cross-async payload queue between Express handler and runPipeline().');
      L.push('const _webhookQueue = (() => {');
      L.push('  const q = []; const waiters = [];');
      L.push('  return {');
      L.push('    push(p) { if (waiters.length) waiters.shift().resolve(p); else q.push(p); },');
      L.push('    next(timeoutMs = 30000) {');
      L.push('      if (q.length) return Promise.resolve(q.shift());');
      L.push('      return new Promise((resolve, reject) => {');
      L.push('        const t = setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); reject(new Error("webhook wait timeout")); }, timeoutMs);');
      L.push('        const w = { resolve: (p) => { clearTimeout(t); resolve(p); } }; waiters.push(w);');
      L.push('      });');
      L.push('    },');
      L.push('  };');
      L.push('})();');
      L.push('');
    }

    // Idempotency dedupe — prevents duplicate runs from repeated webhook/queue/email events.
    const needsIdempotency = ['Webhook (Catch)', 'Queue Consumer', 'New Email'].includes(triggerLabel || '');
    if (needsIdempotency) {
      L.push('// Idempotency: track recently-processed event keys (in-memory; swap for Redis in prod).');
      L.push('const _crypto = require("crypto");');
      L.push('const _idempotencySeen = new Map(); // key -> expiresAt(ms)');
      L.push('const _IDEMPOTENCY_TTL_MS = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || "3600", 10) * 1000;');
      L.push('function _computeIdempotencyKey(payload, explicitKey) {');
      L.push('  if (explicitKey) return String(explicitKey);');
      L.push('  const body = typeof payload === "string" ? payload : JSON.stringify(payload || {});');
      L.push('  return _crypto.createHash("sha256").update(body).digest("hex").slice(0, 32);');
      L.push('}');
      L.push('function _shouldSkipIdempotent(key) {');
      L.push('  const now = Date.now();');
      L.push('  for (const [k, exp] of _idempotencySeen) if (exp < now) _idempotencySeen.delete(k);');
      L.push('  if (_idempotencySeen.has(key)) return true;');
      L.push('  _idempotencySeen.set(key, now + _IDEMPOTENCY_TTL_MS);');
      L.push('  return false;');
      L.push('}');
      L.push('');
    }

    // Step functions
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const fn = `step${i}_${b.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const ev = `${b.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
      const snippet = blockSnippets[b.label];
      const internal = internalSnippets[b.label];

      L.push(`async function ${fn}(prev = null) {`);
      L.push(`  /** ${i === 0 ? 'Trigger' : 'Step ' + i}: ${b.label} (${b.subcategory}) */`);
      // Resolve {{prev.*}} tokens in config values
      const resolvedCfgJs: Record<string,string> = {};
      const jsResolutions: string[] = [];
      for (const [k, v] of Object.entries(b.config)) {
        if (/\{\{prev\.[^}]+\}\}/.test(v)) {
          const jsExpr = resolveJsVar(v);
          resolvedCfgJs[k] = `__PREV__`;
          jsResolutions.push(`  config["${k}"] = ${jsExpr};`);
        } else {
          resolvedCfgJs[k] = v;
        }
      }
      L.push(`  const config = ${JSON.stringify(resolvedCfgJs, null, 2).replace(/^/gm, '  ').trimStart()};`);
      if (jsResolutions.length > 0) {
        L.push(`  // Resolve variables from previous step output`);
        for (const line of jsResolutions) L.push(line);
      }
      L.push(`  console.log("▶ [${i === 0 ? 'TRIGGER' : 'STEP ' + i}] ${b.label}...");`);

      if (snippet) {
        L.push(...snippet.code(b.config, ev));
      } else if (internal) {
        L.push(...internal(b.config));
      } else if (b.auth === 'api_key' || b.auth === 'free') {
        const sdkHint = getNodeSdkHint(b.label);
        if (sdkHint) {
          L.push(`  // SDK available: npm install ${sdkHint}`);
          L.push(`  // Replace this generic fetch call with the ${sdkHint} SDK for ${b.label}`);
        }
        L.push(`  const url = config.url || "";`);
        L.push(`  if (url) {`);
        L.push(`    const query = config.query ? JSON.parse(config.query) : undefined;`);
        L.push(`    const queryString = query ? new URLSearchParams(query).toString() : "";`);
        L.push(`    const requestUrl = queryString ? url + "?" + queryString : url;`);
        L.push(`    const body = config.body ? JSON.parse(config.body) : undefined;`);
        const authHeader = b.auth === 'api_key' ? `Authorization: \`Bearer \${${ev}}\`, ` : '';
        L.push(`    const headers = { "Content-Type": "application/json", ${authHeader ? `${authHeader}` : ''}};`);
        L.push(`    const response = await fetch(requestUrl, { method: config.method || "POST", headers, body: body ? JSON.stringify(body) : undefined });`);
        L.push(`    const data = await response.json();`);
        L.push(`    console.log("  ↳ ${b.label} executed against", requestUrl);`);
        L.push(`    return { status: response.status, result: JSON.stringify(data), data, ...prev };`);
        L.push(`  } else {`);
        L.push(`    // No URL configured — pass through with config data`);
        L.push(`    console.log("  ↳ ${b.label}: no URL configured, passing config as data");`);
        L.push(`    return { status: "ok", result: JSON.stringify(config), ...config, ...prev };`);
        L.push(`  }`);
      } else {
        L.push(`  console.log("  ↳ ${b.label} executed");`);
        L.push(`  return { status: "ok", ...prev };`);
      }
      L.push('}');
      L.push('');
    }

    // Pipeline runner — accepts optional triggerEvent {payload, idempotencyKey} for dedupe.
    L.push('async function runPipeline(triggerEvent = null) {');
    if (needsIdempotency) {
      L.push('  if (triggerEvent) {');
      L.push('    const _idemKey = _computeIdempotencyKey(triggerEvent.payload, triggerEvent.idempotencyKey);');
      L.push('    if (_shouldSkipIdempotent(_idemKey)) { console.log(`⏭️  Skipping duplicate event (idempotency-key=${_idemKey})`); return { skipped: true, idempotencyKey: _idemKey }; }');
      L.push('    console.log(`🔑 idempotency-key=${_idemKey}`);');
      L.push('  }');
    }
    L.push('  console.log("🚀 Starting pipeline...");');
    L.push('  let result = null;');
    L.push('  try {');
    for (let i = 0; i < blocks.length; i++) {
      const fn = `step${i}_${blocks[i].label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      L.push(`    result = await ${fn}(result);`);
      L.push(`    if (result === null) { console.log("⚠️ Pipeline halted at step ${i}"); return null; }`);
      // Emit step artifact marker for the test runner to capture.
      L.push(`    try { console.log("__ARTIFACT__" + JSON.stringify({ stepIndex: ${i}, stepLabel: ${JSON.stringify(blocks[i].label)}, output: result })); } catch (_) { /* non-serializable */ }`);
    }
    L.push('  } catch (err) {');
    L.push('    console.error("❌ Pipeline failed:", err.message);');
    L.push('    throw err;');
    L.push('  }');
    L.push('  console.log("✅ Pipeline complete!");');
    L.push('  return result;');
    L.push('}');
    L.push('');
    // ---- Listener entrypoint (real, production-ready per trigger) ----
    L.push('async function startListener() {');
    if (triggerLabel === 'Schedule (Cron)') {
      const cronExpr = (triggerBlock?.config.cron || triggerBlock?.config.schedule || '0 9 * * *');
      L.push('  const cron = require("node-cron");');
      L.push(`  const expr = process.env.PIPELINE_CRON || ${JSON.stringify(cronExpr)};`);
      L.push('  cron.schedule(expr, () => runPipeline().catch(e => console.error("❌", e.message)));');
      L.push('  console.log(`🕒 Scheduler started: cron=${expr}`);');
      L.push('  await runPipeline().catch(e => console.error("❌", e.message));');
    } else if (triggerLabel === 'Webhook (Catch)') {
      const path = (triggerBlock?.config.path || triggerBlock?.config.url || '/webhook').toString();
      const method = (triggerBlock?.config.method || 'POST').toString().toLowerCase();
      L.push('  const express = require("express");');
      L.push('  const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: true }));');
      L.push(`  app.${method}(${JSON.stringify(path)}, async (req, res) => {`);
      L.push('    const payload = req.body || {};');
      L.push('    // Honor common idempotency header conventions (Stripe/Shopify/custom).');
      L.push('    const idempotencyKey = req.get("Idempotency-Key") || req.get("X-Idempotency-Key") || req.get("X-Request-Id") || null;');
      L.push('    _webhookQueue.push(payload);');
      L.push('    try { const r = await runPipeline({ payload, idempotencyKey }); res.json({ ok: true, result: r }); }');
      L.push('    catch (e) { res.status(500).json({ ok: false, error: e.message }); }');
      L.push('  });');
      L.push('  const port = parseInt(process.env.PORT || "8000", 10);');
      L.push(`  app.listen(port, () => console.log(\`🪝 Webhook listening on http://localhost:\${port}${path}\`));`);
    } else if (triggerLabel === 'File Watcher') {
      const watchPath = triggerBlock?.config.watch_path || './data';
      const pattern = triggerBlock?.config.pattern || '*';
      const events = (triggerBlock?.config.events || 'created').toString();
      L.push('  const chokidar = require("chokidar");');
      L.push(`  const watchPath = process.env.WATCH_PATH || ${JSON.stringify(watchPath)};`);
      L.push(`  const watcher = chokidar.watch(watchPath + "/" + ${JSON.stringify(pattern)}, { ignoreInitial: true });`);
      const evMap: Record<string, string> = { created: 'add', modified: 'change', deleted: 'unlink' };
      const evs = events === 'all' ? ['add', 'change', 'unlink'] : [evMap[events] || 'add'];
      for (const ev of evs) {
        L.push(`  watcher.on(${JSON.stringify(ev)}, p => { console.log(\`👁️  ${ev}: \${p}\`); runPipeline().catch(e => console.error("❌", e.message)); });`);
      }
      L.push(`  console.log(\`👁️  Watching \${watchPath}\`);`);
    } else if (triggerLabel === 'Database Change') {
      const channel = triggerBlock?.config.channel || `${(triggerBlock?.config.table || 'orders')}_changes`;
      L.push('  const { Client } = require("pg");');
      L.push('  const client = new Client({ connectionString: process.env.DATABASE_URL });');
      L.push('  await client.connect();');
      L.push(`  const channel = process.env.PG_NOTIFY_CHANNEL || ${JSON.stringify(channel)};`);
      L.push('  await client.query(`LISTEN ${channel}`);');
      L.push('  client.on("notification", msg => { console.log(`  ↳ NOTIFY ${msg.channel}: ${msg.payload}`); runPipeline().catch(e => console.error("❌", e.message)); });');
      L.push('  console.log(`🗄️  Listening on Postgres channel "${channel}"`);');
    } else if (triggerLabel === 'Queue Consumer' || triggerLabel === 'New Email' || triggerLabel === 'FTP Monitor' || triggerLabel === 'RSS Monitor') {
      const interval = triggerLabel === 'RSS Monitor' ? 300 : triggerLabel === 'Queue Consumer' ? 2 : 60;
      L.push(`  const interval = parseInt(process.env.POLL_INTERVAL || "${interval}", 10) * 1000;`);
      L.push(`  console.log(\`🔁 Polling ${triggerLabel} every \${interval / 1000}s\`);`);
      L.push('  while (true) {');
      if (needsIdempotency) {
        L.push('    try { await runPipeline({ payload: { polledAt: Date.now() } }); } catch (e) { console.error("❌", e.message); }');
      } else {
        L.push('    try { await runPipeline(); } catch (e) { console.error("❌", e.message); }');
      }
      L.push('    await new Promise(r => setTimeout(r, interval));');
      L.push('  }');
    } else {
      L.push('  // Manual or unspecialised trigger — run once.');
      L.push('  await runPipeline();');
    }
    L.push('}');
    L.push('');
    L.push('if (process.env.RUN_ONCE === "1" || process.env.AUTOMATION_TEST_MODE === "1") {');
    L.push('  runPipeline().catch(e => { console.error("❌", e.message); process.exit(1); });');
    L.push('} else {');
    L.push('  startListener().catch(e => { console.error("❌", e.message); process.exit(1); });');
    L.push('}');

    const code = L.join('\n') + '\n';
    setNodeCode(code);
    toast.success('Node.js code generated!');
    return code;
  }, [blocks]);

  // Bridge for handleTestRun (declared earlier) to call the latest generator.
  generateNodeCodeImplRef.current = generateNodeCodeImpl;

  const copyGeneratedCode = useCallback(() => {
    if (generatedCode) { navigator.clipboard.writeText(generatedCode); toast.success('Copied to clipboard!'); }
  }, [generatedCode]);

  // Deployment snippets derived from the latest generated code.
  const deploymentSnippets = useMemo(() => {
    if (!generatedCode) return null;
    const required = scanRequiredEnvVars(generatedCode);
    // Extract npm package list from the comment header.
    const npmMatch = generatedCode.match(/npm install\s+([^\n*]+)/);
    const npmPackages = npmMatch
      ? npmMatch[1].trim().split(/\s+/).filter((p) => p && p !== 'dotenv')
      : [];
    const triggerLabel = blocks[0]?.label;
    return buildDeploymentSnippets(codeLanguage, triggerLabel, required, npmPackages);
  }, [generatedCode, codeLanguage, blocks]);

  // Run preflight automatically whenever generated code changes.
  useEffect(() => {
    if (generatedCode) runPreflight(generatedCode);
  }, [generatedCode, runPreflight]);

  // Step artifact upload handler.
  const handleArtifactUpload = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    const stepIdx = selectedBlock ? blocks.findIndex((b) => b.id === selectedBlock.id) : -1;
    const stepLabel = selectedBlock?.label ?? 'unattached';
    const newArts: StepArtifact[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 1024 * 1024 * 5) {
        toast.error(`${file.name} exceeds 5 MB limit`);
        continue;
      }
      const text = await file.text().catch(() => '[binary file]');
      newArts.push({
        stepIndex: stepIdx,
        stepLabel,
        source: 'upload',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        preview: text.slice(0, 8000),
        sizeBytes: file.size,
        capturedAt: new Date().toISOString(),
      });
    }
    if (newArts.length) {
      setStepArtifacts((prev) => [...prev, ...newArts]);
      toast.success(`Uploaded ${newArts.length} artifact${newArts.length > 1 ? 's' : ''}`);
    }
  }, [selectedBlock, blocks]);

  const removeArtifact = useCallback((idx: number) => {
    setStepArtifacts((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const downloadArtifact = useCallback((art: StepArtifact) => {
    const blob = new Blob([art.preview], { type: art.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = art.name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const clearRunHistory = useCallback(() => {
    setRunHistory([]);
    setSelectedRunId(null);
    toast.success('Run history cleared');
  }, []);

  const selectedRun = useMemo(
    () => runHistory.find((r) => r.id === selectedRunId) ?? null,
    [runHistory, selectedRunId],
  );

  return (
    <div className="grid h-full grid-cols-[290px_1fr_300px] overflow-hidden">
      <aside className="border-r border-border bg-background/70 flex flex-col overflow-hidden">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Add Block</p>
          {(blocks.length === 0 || invalidTriggerStart) ? (
            <p className="mt-1 text-[11px] text-amber-500 font-medium">⚡ Pick a trigger to start your pipeline</p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">{AUTOMATION_BLOCK_COUNT} blocks available</p>
          )}
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

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 ide-scrollbar">
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
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => generateCode('python')}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
              Python
            </button>
            <button
              onClick={() => generateCode('nodejs')}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
              Node.js
            </button>
            <button
              onClick={handleTestRun}
              disabled={isTestRunning || blocks.length === 0}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent transition-colors disabled:opacity-50"
            >
              {isTestRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Play className="h-3.5 w-3.5 text-emerald-500" />}
              {isTestRunning ? 'Running…' : 'Test Run'}
            </button>
          </div>
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
              {invalidTriggerStart && (
                <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-[11px] text-destructive">
                  <p className="font-semibold">Invalid first block</p>
                  <p className="mt-1 text-[11px] text-destructive/90">The first step in an automation must be a trigger block from the Triggers category. Move a trigger block to the top before running or generating code.</p>
                </div>
              )}
              {blocks.map((block, index) => {
                const isSelected = selectedBlockId === block.id;
                return (
                  <div key={block.id}>
                    <button
                      onClick={() => setSelectedBlockId(prev => prev === block.id ? null : block.id)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                        isSelected ? 'border-primary/70 bg-primary/10' : 'border-border bg-card/70 hover:bg-accent/60',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 rounded border border-border bg-background px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {index === 0 ? (isTriggerBlock(block) ? 'TRIGGER' : 'STEP 0') : `STEP ${index}`}
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

      <aside className="border-l border-border bg-background/80 flex flex-col overflow-hidden">
        <div className="border-b border-border px-3 py-2 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Config + Run Logs</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 ide-scrollbar">
          {generatedCode && (
            <div className="mb-4 rounded-md border border-border bg-card/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium">Generated {codeLanguage === 'nodejs' ? 'Node.js' : 'Python'}</p>
                </div>
                <button onClick={copyGeneratedCode} className="rounded p-1 hover:bg-accent" title="Copy">
                  <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <pre className="max-h-[300px] overflow-auto rounded border border-border bg-background p-2 text-[11px] font-mono text-foreground ide-scrollbar whitespace-pre-wrap">{generatedCode}</pre>
            </div>
          )}

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

              {(() => {
                const blockDef = getBlockDefinition(selectedBlock.type);
                const hasProviderSchema = Boolean(
                  blockDef?.parameters?.length || blockDef?.credentialFields?.length || blockDef?.operations?.length,
                );
                const fallbackCredentialFields =
                  selectedBlock.auth === 'api_key'
                    ? genericApiCredentialFields
                    : selectedBlock.auth === 'free'
                      ? genericOAuthCredentialFields
                      : [];

                return (
                  <AutomationBlockParameterForm
                    parameters={hasProviderSchema ? blockDef?.parameters : genericParameters}
                    credentialFields={hasProviderSchema ? blockDef?.credentialFields : fallbackCredentialFields}
                    operations={hasProviderSchema ? blockDef?.operations : genericOperations}
                    config={selectedBlock.config}
                    onConfigChange={replaceSelectedConfig}
                    blockLabel={selectedBlock.label}
                    stepIndex={blocks.findIndex((b) => b.id === selectedBlock.id)}
                  />
                );
              })()}

              <div className="rounded border border-dashed border-border p-2">
                <p className="text-[11px] font-medium text-muted-foreground">Add custom parameter (for advanced use)</p>
                <button
                  onClick={addCustomParam}
                  className="mt-2 w-full rounded border border-border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  Add Custom Parameter
                </button>
              </div>

              <div className="rounded border border-border p-2">
                <p className="text-[11px] font-medium text-muted-foreground">Advanced JSON editor</p>
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

          {/* ===== Preflight env-var check ===== */}
          {preflight && preflight.required.length > 0 && (
            <div className={cn('mt-4 rounded-md border p-3', preflight.missing.length ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5')}>
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className={cn('h-3.5 w-3.5', preflight.missing.length ? 'text-amber-400' : 'text-emerald-400')} />
                <p className="text-xs font-medium">Preflight{preflight.missing.length > 0 ? ` — ${preflight.missing.length} missing` : ' — all set'}</p>
              </div>
              {preflight.missing.length > 0 ? (
                <div className="space-y-1">
                  {preflight.missing.map((v) => (
                    <div key={v} className="flex items-center justify-between rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1">
                      <code className="text-[11px] font-mono text-amber-200">{v}</code>
                      <button onClick={() => { const val = window.prompt(`Set ${v}:`); if (val !== null) { window.localStorage.setItem(`env.${v}`, val); if (generatedCode) runPreflight(generatedCode); } }} className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] hover:bg-amber-500/10">Set</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-emerald-300/90">{preflight.required.length} required env var{preflight.required.length > 1 ? 's' : ''} present.</p>
              )}
            </div>
          )}

          {/* ===== Step artifacts ===== */}
          <div className="mt-4 rounded-md border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium">Step artifacts ({stepArtifacts.length})</p>
              </div>
              <button onClick={() => artifactInputRef.current?.click()} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent">
                <Upload className="h-3 w-3" /> Upload
              </button>
              <input ref={artifactInputRef} type="file" multiple className="hidden" onChange={(e) => { handleArtifactUpload(e.target.files); e.target.value = ''; }} />
            </div>
            {stepArtifacts.length === 0 ? (
              <p className="text-[11px] italic text-muted-foreground">No artifacts. Run a test to capture step outputs, or upload files attached to a selected step.</p>
            ) : (
              <div className="space-y-1.5">
                {stepArtifacts.map((art, i) => (
                  <details key={i} className="rounded border border-border bg-background/60">
                    <summary className="flex cursor-pointer items-center justify-between px-2 py-1 text-[11px] hover:bg-accent/50">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate font-medium">{art.stepIndex >= 0 ? `Step ${art.stepIndex}` : 'Detached'} · {art.name}</span>
                        <span className={cn('rounded border px-1 text-[9px]', art.source === 'inline' ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-violet-500/40 bg-violet-500/10 text-violet-300')}>{art.source}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <button onClick={(e) => { e.preventDefault(); downloadArtifact(art); }} className="rounded p-0.5 hover:bg-accent"><Upload className="h-3 w-3 rotate-180 text-muted-foreground" /></button>
                        <button onClick={(e) => { e.preventDefault(); removeArtifact(i); }} className="rounded p-0.5 hover:bg-accent hover:text-destructive"><X className="h-3 w-3" /></button>
                      </span>
                    </summary>
                    <pre className="max-h-48 overflow-auto border-t border-border bg-background p-2 text-[10px] font-mono text-foreground ide-scrollbar whitespace-pre-wrap">{art.preview || '(empty)'}</pre>
                    <p className="px-2 py-1 text-[9px] text-muted-foreground border-t border-border">{art.mimeType} · {art.sizeBytes} bytes</p>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* ===== Production deployment snippets ===== */}
          {deploymentSnippets && (
            <div className="mt-4 rounded-md border border-border bg-card/60 p-3">
              <button onClick={() => setShowSnippets((s) => !s)} className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2"><TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs font-medium">Production deployment snippets</p></div>
                <span className="text-[10px] text-muted-foreground">{showSnippets ? '−' : '+'}</span>
              </button>
              {showSnippets && (
                <div className="mt-2 space-y-2">
                  {([['CLI quickstart', deploymentSnippets.cliQuickstart], ['Dockerfile', deploymentSnippets.dockerfile], ['docker-compose.yml', deploymentSnippets.dockerCompose], ['Procfile', deploymentSnippets.procfile], ['systemd unit', deploymentSnippets.systemd]] as const).map(([title, body]) => (
                    <details key={title} className="rounded border border-border bg-background/60">
                      <summary className="flex cursor-pointer items-center justify-between px-2 py-1 text-[11px] hover:bg-accent/50">
                        <span className="font-medium">{title}</span>
                        <button onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(body); toast.success(`${title} copied`); }} className="rounded p-0.5 hover:bg-accent"><ClipboardCopy className="h-3 w-3 text-muted-foreground" /></button>
                      </summary>
                      <pre className="max-h-56 overflow-auto border-t border-border bg-background p-2 text-[10px] font-mono text-foreground ide-scrollbar whitespace-pre">{body}</pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== Run history ===== */}
          <div className="mt-4 rounded-md border border-border bg-card/60 p-3">
            <button onClick={() => setShowHistory((s) => !s)} className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2"><History className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs font-medium">Event history ({runHistory.length})</p></div>
              <span className="text-[10px] text-muted-foreground">{showHistory ? '−' : '+'}</span>
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1.5">
                {runHistory.length === 0 ? (
                  <p className="text-[11px] italic text-muted-foreground">No trigger firings recorded yet.</p>
                ) : (
                  <>
                    <button onClick={clearRunHistory} className="w-full rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-destructive">Clear history</button>
                    {runHistory.map((run) => {
                      const isOpen = selectedRunId === run.id;
                      const sc = run.status === 'success' ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300' : run.status === 'halted' ? 'border-amber-500/40 bg-amber-500/5 text-amber-300' : 'border-destructive/40 bg-destructive/5 text-destructive';
                      return (
                        <div key={run.id} className="rounded border border-border bg-background/60">
                          <button onClick={() => setSelectedRunId(isOpen ? null : run.id)} className="flex w-full items-center justify-between px-2 py-1 text-left hover:bg-accent/50">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className={cn('rounded border px-1 text-[9px] font-medium', sc)}>{run.status}</span>
                              <span className="truncate text-[11px] font-medium">{run.triggerLabel}</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">{run.durationMs}ms · {new Date(run.startedAt).toLocaleTimeString()}</span>
                          </button>
                          {isOpen && (
                            <div className="border-t border-border p-2 space-y-2">
                              <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                                <div>Steps: <span className="text-foreground">{run.stepCount}</span></div>
                                <div>Artifacts: <span className="text-foreground">{run.artifactsCount}</span></div>
                              </div>
                              {run.preflight.missing.length > 0 && (
                                <div className="rounded border border-amber-500/30 bg-amber-500/5 p-1.5 text-[10px] text-amber-300"><AlertTriangle className="inline h-3 w-3 mr-1" />Preflight missing: {run.preflight.missing.join(', ')}</div>
                              )}
                              {run.errorMessage && <div className="rounded border border-destructive/40 bg-destructive/5 p-1.5 text-[10px] text-destructive font-mono">{run.errorMessage}</div>}
                              {run.finalOutputPreview && (
                                <details><summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">Final output</summary><pre className="mt-1 max-h-40 overflow-auto rounded border border-border bg-background p-1.5 text-[10px] font-mono whitespace-pre-wrap">{run.finalOutputPreview}</pre></details>
                              )}
                              <details><summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">Logs ({run.logs.length})</summary>
                                <div className="mt-1 max-h-40 overflow-auto space-y-0.5 rounded border border-border bg-background p-1.5">
                                  {run.logs.map((log, i) => (<p key={i} className="text-[10px] font-mono text-muted-foreground">[{log.time}] {log.text}</p>))}
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ===== Run logs (live) ===== */}
          <div className="mt-4 rounded-md border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Logs className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium">Run logs</p>
              {isTestRunning && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {testRunLogs.length === 0 ? (
                <p className="italic">No test runs yet. Click "Test Run" to execute the generated pipeline in the sandbox.</p>
              ) : (
                testRunLogs.map((log, i) => {
                  const Icon = log.icon === 'check' ? Check : log.icon === 'dot' ? CircleDot : log.icon === 'key' ? KeyRound : MinusCircle;
                  const color = log.icon === 'check' ? 'text-emerald-400' : log.icon === 'dot' ? 'text-blue-400' : log.icon === 'key' ? 'text-amber-400' : 'text-destructive';
                  return (<p key={i} className="flex items-center gap-1"><Icon className={cn('h-3 w-3', color)} /> {log.time} {log.text}</p>);
                })
              )}
            </div>
          </div>

        </div>
      </aside>
    </div>
  );
};
