import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CircleDot,
  ClipboardCopy,
  Code2,
  KeyRound,
  Loader2,
  Logs,
  MinusCircle,
  Play,
  Plus,
  Search,
  Trash2,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ALL_AUTOMATION_BLOCKS,
  AUTOMATION_BLOCK_COUNT,
  AUTOMATION_INTEGRATION_REGISTRY,
  type APIParameter,
  type AutomationAuthType,
  type Operation,
} from '@/data/automationIntegrationRegistry';
import { AutomationBlockParameterForm } from './AutomationBlockParameterForm';

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

const getBlockDefinition = (type: string) => {
  return ALL_AUTOMATION_BLOCKS.find((block) => block.type === type);
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

export const AutomationTemplatePane = () => {
  const [query, setQuery] = useState('');
  const [blocks, setBlocks] = useState<AutomationBlockInstance[]>(starterFlow());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [jsonEditorValue, setJsonEditorValue] = useState('{}');
  const [jsonEditorError, setJsonEditorError] = useState<string | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testRunLogs, setTestRunLogs] = useState<{ icon: 'check' | 'dot' | 'key' | 'error'; time: string; text: string }[]>([]);
  const [pythonCode, setPythonCode] = useState<string | null>(null);

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

  const handleTestRun = useCallback(async () => {
    if (blocks.length === 0) { toast.error('Add at least one block to test.'); return; }
    setIsTestRunning(true);
    setTestRunLogs([]);
    setPythonCode(null);
    const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      if (i === 0) {
        setTestRunLogs((p) => [...p, { icon: 'check' as const, time: now(), text: `Trigger fired: ${block.label}` }]);
      } else {
        if (block.auth === 'api_key') {
          setTestRunLogs((p) => [...p, { icon: 'key' as const, time: now(), text: `Credentials resolved for ${block.label}` }]);
          await new Promise((r) => setTimeout(r, 300));
        }
        const hasEmpty = Object.values(block.config).some((v) => v === '' || v === 'configure-action');
        if (hasEmpty) {
          setTestRunLogs((p) => [...p, { icon: 'error' as const, time: now(), text: `⚠ ${block.label}: missing config — skipped` }]);
        } else {
          setTestRunLogs((p) => [...p, { icon: 'dot' as const, time: now(), text: `Step ${i}: ${block.label} executed` }]);
        }
      }
    }
    await new Promise((r) => setTimeout(r, 300));
    setTestRunLogs((p) => [...p, { icon: 'check' as const, time: now(), text: 'Flow completed' }]);
    setIsTestRunning(false);
  }, [blocks]);

  const generatePythonCode = useCallback(() => {
    if (blocks.length === 0) { toast.error('Add blocks first.'); return; }

    // Map block labels to real Python SDK/API snippets
    const blockSnippets: Record<string, { pip: string; imports: string[]; code: (cfg: Record<string,string>, envVar: string) => string[] }> = {
      'OpenAI': {
        pip: 'openai',
        imports: ['from openai import OpenAI'],
        code: (cfg, ev) => [
          `    client = OpenAI(api_key=${ev})`,
          `    response = client.chat.completions.create(`,
          `        model="${cfg.model || 'gpt-4o-mini'}",`,
          `        messages=[{"role": "user", "content": ${JSON.stringify(cfg.task || 'Hello')}}],`,
          `    )`,
          `    return {"result": response.choices[0].message.content}`,
        ],
      },
      'Anthropic': {
        pip: 'anthropic',
        imports: ['import anthropic'],
        code: (cfg, ev) => [
          `    client = anthropic.Anthropic(api_key=${ev})`,
          `    message = client.messages.create(`,
          `        model="${cfg.model || 'claude-sonnet-4-20250514'}",`,
          `        max_tokens=1024,`,
          `        messages=[{"role": "user", "content": ${JSON.stringify(cfg.task || 'Hello')}}],`,
          `    )`,
          `    return {"result": message.content[0].text}`,
        ],
      },
      'Google Gemini': {
        pip: 'google-genai',
        imports: ['from google import genai'],
        code: (cfg, ev) => [
          `    client = genai.Client(api_key=${ev})`,
          `    response = client.models.generate_content(`,
          `        model="${cfg.model || 'gemini-2.5-flash'}",`,
          `        contents=${JSON.stringify(cfg.task || 'Hello')},`,
          `    )`,
          `    return {"result": response.text}`,
        ],
      },
      'Mistral AI': {
        pip: 'mistralai',
        imports: ['from mistralai import Mistral'],
        code: (cfg, ev) => [
          `    client = Mistral(api_key=${ev})`,
          `    response = client.chat.complete(`,
          `        model="${cfg.model || 'mistral-large-latest'}",`,
          `        messages=[{"role": "user", "content": ${JSON.stringify(cfg.task || 'Hello')}}],`,
          `    )`,
          `    return {"result": response.choices[0].message.content}`,
        ],
      },
      'Groq': {
        pip: 'groq',
        imports: ['from groq import Groq'],
        code: (cfg, ev) => [
          `    client = Groq(api_key=${ev})`,
          `    response = client.chat.completions.create(`,
          `        model="${cfg.model || 'llama-3.3-70b-versatile'}",`,
          `        messages=[{"role": "user", "content": ${JSON.stringify(cfg.task || 'Hello')}}],`,
          `    )`,
          `    return {"result": response.choices[0].message.content}`,
        ],
      },
      'Cohere': {
        pip: 'cohere',
        imports: ['import cohere'],
        code: (cfg, ev) => [
          `    co = cohere.ClientV2(api_key=${ev})`,
          `    response = co.chat(`,
          `        model="${cfg.model || 'command-a-03-2025'}",`,
          `        messages=[{"role": "user", "content": ${JSON.stringify(cfg.task || 'Hello')}}],`,
          `    )`,
          `    return {"result": response.message.content[0].text}`,
        ],
      },
      'Resend': {
        pip: 'resend',
        imports: ['import resend'],
        code: (cfg, ev) => [
          `    resend.api_key = ${ev}`,
          `    r = resend.Emails.send({`,
          `        "from": "${cfg.from_email || 'you@yourdomain.com'}",`,
          `        "to": ["${cfg.to_email || 'recipient@example.com'}"],`,
          `        "subject": ${JSON.stringify(cfg.subject || 'Hello from automation')},`,
          `        "html": ${JSON.stringify(cfg.body || '<p>Hello!</p>')},`,
          `    })`,
          `    return {"email_id": r["id"]}`,
        ],
      },
      'SendGrid': {
        pip: 'sendgrid',
        imports: ['from sendgrid import SendGridAPIClient', 'from sendgrid.helpers.mail import Mail'],
        code: (cfg, ev) => [
          `    message = Mail(`,
          `        from_email="${cfg.from_email || 'you@yourdomain.com'}",`,
          `        to_emails="${cfg.to_email || 'recipient@example.com'}",`,
          `        subject=${JSON.stringify(cfg.subject || 'Hello')},`,
          `        html_content=${JSON.stringify(cfg.body || '<p>Hello!</p>')},`,
          `    )`,
          `    sg = SendGridAPIClient(${ev})`,
          `    response = sg.send(message)`,
          `    return {"status_code": response.status_code}`,
        ],
      },
      'Twilio': {
        pip: 'twilio',
        imports: ['from twilio.rest import Client as TwilioClient'],
        code: (cfg, ev) => [
          `    # Twilio needs Account SID + Auth Token`,
          `    client = TwilioClient(${ev}, TWILIO_AUTH_TOKEN)`,
          `    message = client.messages.create(`,
          `        body=${JSON.stringify(cfg.body || 'Hello from automation')},`,
          `        from_="${cfg.from_number || '+1234567890'}",`,
          `        to="${cfg.to_number || '+0987654321'}",`,
          `    )`,
          `    return {"sid": message.sid}`,
        ],
      },
      'Slack': {
        pip: 'slack-sdk',
        imports: ['from slack_sdk import WebClient'],
        code: (cfg, ev) => [
          `    client = WebClient(token=${ev})`,
          `    response = client.chat_postMessage(`,
          `        channel="${cfg.channel || '#general'}",`,
          `        text=${JSON.stringify(cfg.message || 'Hello from automation!')},`,
          `    )`,
          `    return {"ts": response["ts"]}`,
        ],
      },
      'Discord': {
        pip: 'requests',
        imports: [],
        code: (cfg, ev) => [
          `    webhook_url = config.get("webhook_url", "")`,
          `    response = requests.post(webhook_url, json={`,
          `        "content": ${JSON.stringify(cfg.message || 'Hello from automation!')},`,
          `    })`,
          `    return {"status": response.status_code}`,
        ],
      },
      'Telegram': {
        pip: 'requests',
        imports: [],
        code: (cfg, ev) => [
          `    bot_token = ${ev}`,
          `    chat_id = "${cfg.chat_id || ''}"`,
          `    response = requests.post(`,
          `        f"https://api.telegram.org/bot{bot_token}/sendMessage",`,
          `        json={"chat_id": chat_id, "text": ${JSON.stringify(cfg.message || 'Hello!')}},`,
          `    )`,
          `    return response.json()`,
        ],
      },
      'Stripe': {
        pip: 'stripe',
        imports: ['import stripe'],
        code: (cfg, ev) => [
          `    stripe.api_key = ${ev}`,
          `    # Example: create a payment intent`,
          `    intent = stripe.PaymentIntent.create(`,
          `        amount=${cfg.amount || '1000'},`,
          `        currency="${cfg.currency || 'usd'}",`,
          `    )`,
          `    return {"client_secret": intent.client_secret}`,
        ],
      },
      'Supabase': {
        pip: 'supabase',
        imports: ['from supabase import create_client'],
        code: (cfg, ev) => [
          `    url = os.getenv("SUPABASE_URL", "${cfg.url || ''}")`,
          `    client = create_client(url, ${ev})`,
          `    response = client.table("${cfg.table || 'items'}").select("*").execute()`,
          `    return {"data": response.data}`,
        ],
      },
      'GitHub': {
        pip: 'requests',
        imports: [],
        code: (cfg, ev) => [
          `    headers = {"Authorization": f"Bearer {${ev}}", "Accept": "application/vnd.github+json"}`,
          `    owner = "${cfg.owner || 'owner'}"`,
          `    repo = "${cfg.repo || 'repo'}"`,
          `    response = requests.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)`,
          `    return response.json()`,
        ],
      },
      'ElevenLabs': {
        pip: 'elevenlabs',
        imports: ['from elevenlabs.client import ElevenLabs as ElevenLabsClient'],
        code: (cfg, ev) => [
          `    client = ElevenLabsClient(api_key=${ev})`,
          `    audio = client.text_to_speech.convert(`,
          `        voice_id="${cfg.voice_id || '21m00Tcm4TlvDq8ikWAM'}",`,
          `        text=${JSON.stringify(cfg.text || 'Hello world')},`,
          `        model_id="eleven_multilingual_v2",`,
          `    )`,
          `    # audio is a generator of bytes`,
          `    return {"status": "audio_generated"}`,
        ],
      },
      'Sentry': {
        pip: 'sentry-sdk',
        imports: ['import sentry_sdk'],
        code: (cfg, ev) => [
          `    sentry_sdk.init(dsn=${ev})`,
          `    sentry_sdk.capture_message("Automation checkpoint reached")`,
          `    return {"status": "event_sent"}`,
        ],
      },
      'DALL-E': {
        pip: 'openai',
        imports: ['from openai import OpenAI'],
        code: (cfg, ev) => [
          `    client = OpenAI(api_key=${ev})`,
          `    response = client.images.generate(`,
          `        model="dall-e-3",`,
          `        prompt=${JSON.stringify(cfg.prompt || 'A cute robot')},`,
          `        n=1, size="1024x1024",`,
          `    )`,
          `    return {"image_url": response.data[0].url}`,
        ],
      },
      'Stable Diffusion': {
        pip: 'stability-sdk',
        imports: [],
        code: (cfg, ev) => [
          `    response = requests.post(`,
          `        "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",`,
          `        headers={"Authorization": f"Bearer {${ev}}", "Content-Type": "application/json"},`,
          `        json={"text_prompts": [{"text": ${JSON.stringify(cfg.prompt || 'A landscape')}}]},`,
          `    )`,
          `    return {"status": response.status_code}`,
        ],
      },
    };

    // Internal / logic block snippets (no pip needed)
    const internalSnippets: Record<string, (cfg: Record<string,string>) => string[]> = {
      'Schedule (Cron)': (cfg) => [
        `    # pip install schedule`,
        `    # For production, use APScheduler or cron jobs`,
        `    print(f"Trigger: cron={cfg.get('cron', '* * * * *')}, tz={cfg.get('timezone', 'UTC')}")`,
        `    return {"triggered": True}`,
      ],
      'Webhook (Catch)': (cfg) => [
        `    # pip install flask`,
        `    # In production: use Flask/FastAPI to expose a webhook endpoint`,
        `    print(f"Webhook listening on {config.get('url', '/webhook')}")`,
        `    return {"triggered": True}`,
      ],
      'Filter': () => [
        `    # Filter: pass data through only if condition is met`,
        `    if prev and prev.get("status") == "ok":`,
        `        return prev`,
        `    return None`,
      ],
      'Delay': (cfg) => [
        `    delay_seconds = int(config.get("seconds", "5"))`,
        `    time.sleep(delay_seconds)`,
        `    return prev`,
      ],
      'JSON Parser': () => [
        `    data = json.loads(prev.get("raw", "{}")) if prev else {}`,
        `    return {"parsed": data}`,
      ],
      'Text Formatter': () => [
        `    text = prev.get("text", "") if prev else ""`,
        `    return {"formatted": text.strip().title()}`,
      ],
      'Loop': () => [
        `    items = prev.get("items", []) if prev else []`,
        `    results = []`,
        `    for item in items:`,
        `        results.append({"processed": item})`,
        `    return {"results": results}`,
      ],
    };

    // Collect pip packages and imports
    const pipPackages = new Set<string>();
    const allImports = new Set<string>(['import requests', 'import json', 'import time', 'import os']);
    const needsAuth: { label: string; envVar: string; extraEnvVars?: string[] }[] = [];

    for (const b of blocks) {
      const snippet = blockSnippets[b.label];
      if (snippet) {
        if (snippet.pip !== 'requests') pipPackages.add(snippet.pip);
        snippet.imports.forEach((i) => allImports.add(i));
      }
      if (b.auth === 'api_key') {
        const ev = `${b.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
        if (!needsAuth.find((a) => a.envVar === ev)) {
          const extras: string[] = [];
          if (b.label === 'Twilio') extras.push('TWILIO_AUTH_TOKEN');
          needsAuth.push({ label: b.label, envVar: ev, extraEnvVars: extras });
        }
      }
    }

    const L: string[] = [];
    L.push('#!/usr/bin/env python3');
    L.push(`"""Auto-generated automation pipeline — ${blocks.length} blocks."""`);
    L.push('');

    // pip install instructions
    const pipList = Array.from(pipPackages);
    if (pipList.length > 0) {
      L.push(`# Requirements: pip install ${pipList.join(' ')}`);
      L.push('');
    }

    // Credentials
    if (needsAuth.length > 0) {
      L.push('# --- Credentials (set as environment variables) ---');
      for (const a of needsAuth) {
        L.push(`${a.envVar} = os.getenv("${a.envVar}", "")  # Get from ${a.label} dashboard`);
        if (a.extraEnvVars) {
          for (const extra of a.extraEnvVars) {
            L.push(`${extra} = os.getenv("${extra}", "")`);
          }
        }
      }
      L.push('');
    }

    // Step functions with real API code
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const fn = `step_${i}_${b.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const ev = `${b.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
      const snippet = blockSnippets[b.label];
      const internal = internalSnippets[b.label];

      L.push(i === 0 ? `def ${fn}():` : `def ${fn}(prev=None):`);
      L.push(`    """${i === 0 ? 'Trigger' : 'Step ' + i}: ${b.label} (${b.subcategory})"""`);
      L.push(`    config = ${JSON.stringify(b.config, null, 4).replace(/^/gm, '    ').trimStart()}`);

      if (snippet) {
        L.push(...snippet.code(b.config, ev));
      } else if (internal) {
        L.push(...internal(b.config));
      } else if (b.auth === 'api_key') {
        // Generic API call for blocks without specific snippets
        L.push(`    headers = {"Authorization": f"Bearer {${ev}}"}`);
        L.push(`    # Refer to ${b.label} API docs for the correct endpoint`);
        L.push(`    # response = requests.post("https://api.${b.label.toLowerCase().replace(/[^a-z]/g, '')}.com/v1/...", headers=headers, json=config)`);
        L.push(`    print(f"[STEP ${i}] ${b.label} called")`);
        L.push(`    return {"status": "ok"}`);
      } else {
        L.push(`    print(f"[STEP ${i}] ${b.label} executed")`);
        L.push(`    return {"status": "ok"}`);
      }
      L.push('');
    }

    // Pipeline runner
    L.push('');
    L.push('def run_pipeline():');
    L.push('    """Execute the full automation pipeline."""');
    L.push('    print("🚀 Starting pipeline...")');
    L.push('    result = None');
    for (let i = 0; i < blocks.length; i++) {
      const fn = `step_${i}_${blocks[i].label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      L.push(i === 0 ? `    result = ${fn}()` : `    result = ${fn}(prev=result)`);
    }
    L.push('    print("✅ Pipeline complete!")');
    L.push('    return result');
    L.push('');
    L.push('');
    L.push('if __name__ == "__main__":');
    L.push('    run_pipeline()');

    setPythonCode([...allImports].join('\n') + '\n\n\n' + L.join('\n') + '\n');
    toast.success('Python code generated with real API calls!');
  }, [blocks]);

  const copyPythonCode = useCallback(() => {
    if (pythonCode) { navigator.clipboard.writeText(pythonCode); toast.success('Copied to clipboard!'); }
  }, [pythonCode]);

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
          <div className="flex items-center gap-1.5">
            <button
              onClick={generatePythonCode}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <Code2 className="h-3.5 w-3.5 text-blue-400" />
              To Python
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

          {pythonCode && (
            <div className="mt-4 rounded-md border border-border bg-card/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium">Generated Python</p>
                </div>
                <button onClick={copyPythonCode} className="rounded p-1 hover:bg-accent" title="Copy">
                  <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <pre className="max-h-[300px] overflow-auto rounded border border-border bg-background p-2 text-[11px] font-mono text-foreground ide-scrollbar whitespace-pre-wrap">{pythonCode}</pre>
            </div>
          )}

          <div className="mt-4 rounded-md border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Logs className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium">Run logs</p>
              {isTestRunning && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {testRunLogs.length === 0 ? (
                <p className="italic">No test runs yet. Click "Test Run" to simulate.</p>
              ) : (
                testRunLogs.map((log, i) => {
                  const Icon = log.icon === 'check' ? Check : log.icon === 'dot' ? CircleDot : log.icon === 'key' ? KeyRound : MinusCircle;
                  const color = log.icon === 'check' ? 'text-emerald-400' : log.icon === 'dot' ? 'text-blue-400' : log.icon === 'key' ? 'text-amber-400' : 'text-destructive';
                  return (
                    <p key={i} className="flex items-center gap-1">
                      <Icon className={cn('h-3 w-3', color)} /> {log.time} {log.text}
                    </p>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
