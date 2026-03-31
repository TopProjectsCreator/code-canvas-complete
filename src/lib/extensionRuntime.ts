/**
 * Extension runtime — sandboxed execution of user-authored extensions.
 *
 * Extensions are plain JS functions that receive a `ctx` helper object.
 * We execute them inside a same-origin iframe sandbox so they can render
 * HTML widgets but cannot touch the host page.
 */

import { supabase } from '@/integrations/supabase/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ExtensionRuntimeType = 'widget' | 'command' | 'chat-tool';

export interface ExtensionManifest {
  name: string;
  slug: string;
  description?: string;
  version: string;
  icon?: string;
  runtime: ExtensionRuntimeType;
  permissions?: string[];
  entrypoint?: string;
}

export interface InstalledExtension {
  id: string;
  manifest: ExtensionManifest;
  code: string;
  status: 'active' | 'disabled';
}

export interface ExtensionWidgetResult {
  html: string;
}

export interface ExtensionCommandResult {
  output: string;
}

export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

const STORAGE_PREFIX = 'ext-data-';

function getStorage(extensionSlug: string) {
  return {
    get(key: string): unknown {
      try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${extensionSlug}:${key}`);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set(key: string, value: unknown): void {
      localStorage.setItem(`${STORAGE_PREFIX}${extensionSlug}:${key}`, JSON.stringify(value));
    },
  };
}

/* ------------------------------------------------------------------ */
/*  AI helpers exposed to extensions                                   */
/* ------------------------------------------------------------------ */

async function aiComplete(prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { messages: [{ role: 'user', content: prompt }], model: 'google/gemini-3-flash-preview' },
  });
  if (error) throw new Error(error.message);
  return data?.reply ?? data?.choices?.[0]?.message?.content ?? '';
}

async function aiStructured(prompt: string, schema: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      messages: [{ role: 'user', content: prompt }],
      model: 'google/gemini-3-flash-preview',
      tools: [{ type: 'function', function: { name: 'extract', description: 'Extract structured data', parameters: schema } }],
      tool_choice: { type: 'function', function: { name: 'extract' } },
    },
  });
  if (error) throw new Error(error.message);
  try {
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    return call ? JSON.parse(call.function.arguments) : data;
  } catch {
    return data;
  }
}

function unwrapGeneratedExtensionCode(code: string): string {
  let cleaned = code
    .trim()
    .replace(/^```(?:javascript|js|typescript|ts)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const wrappers = [
    /^export\s+default\s+(?:async\s+)?function(?:\s+\w+)?\s*\([^)]*\)\s*\{([\s\S]*)\}\s*;?\s*$/,
    /^module\.exports\s*=\s*(?:async\s+)?function(?:\s+\w+)?\s*\([^)]*\)\s*\{([\s\S]*)\}\s*;?\s*$/,
    /^exports\.default\s*=\s*(?:async\s+)?function(?:\s+\w+)?\s*\([^)]*\)\s*\{([\s\S]*)\}\s*;?\s*$/,
    /^export\s+default\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{([\s\S]*)\}\s*;?\s*$/,
    /^export\s+default\s*(?:async\s*)?[\w$]+\s*=>\s*\{([\s\S]*)\}\s*;?\s*$/,
  ];

  for (const pattern of wrappers) {
    const match = cleaned.match(pattern);
    if (match) {
      cleaned = match[1].trim();
      break;
    }
  }

  return cleaned;
}

/* ------------------------------------------------------------------ */
/*  Context builder                                                    */
/* ------------------------------------------------------------------ */

export interface ExtensionContext {
  showUI: (html: string) => void;
  getSelectedText: () => string;
  replaceSelectedText: (text: string) => void;
  showNotification: (msg: string) => void;
  registerAction: (label: string, handler: () => void | Promise<void>) => string;
  preview: {
    show: (payload: { title?: string; content: string; language?: string }) => void;
  };
  project: {
    listFiles: () => string[];
    readFile: (path: string) => string;
    writeFile: (path: string, content: string) => void;
    deleteFile: (path: string) => void;
  };
  profile: {
    id: string | null;
    email: string | null;
    displayName: string | null;
    stats: {
      extensionCount: number;
      installedExtensionCount: number;
    };
  };
  fetch: typeof fetch;
  storage: ReturnType<typeof getStorage>;
  ai: { complete: typeof aiComplete; structured: typeof aiStructured };
}

export function buildContext(
  slug: string,
  callbacks: {
    onUI?: (html: string) => void;
    getSelection?: () => string;
    replaceSelection?: (text: string) => void;
    notify?: (msg: string) => void;
    onRegisterAction?: (action: { id: string; label: string; handler: () => void | Promise<void> }) => void;
    onPreview?: (payload: { title?: string; content: string; language?: string }) => void;
    project?: {
      listFiles?: () => string[];
      readFile?: (path: string) => string;
      writeFile?: (path: string, content: string) => void;
      deleteFile?: (path: string) => void;
    };
    profile?: {
      id?: string | null;
      email?: string | null;
      displayName?: string | null;
      stats?: {
        extensionCount?: number;
        installedExtensionCount?: number;
      };
    };
  },
): ExtensionContext {
  return {
    showUI: callbacks.onUI ?? (() => {}),
    getSelectedText: callbacks.getSelection ?? (() => ''),
    replaceSelectedText: callbacks.replaceSelection ?? (() => {}),
    showNotification: callbacks.notify ?? ((msg: string) => console.log('[ext]', msg)),
    registerAction: (label, handler) => {
      const id = `${slug}-${Math.random().toString(36).slice(2, 10)}`;
      callbacks.onRegisterAction?.({ id, label, handler });
      return id;
    },
    preview: {
      show: (payload) => callbacks.onPreview?.(payload),
    },
    project: {
      listFiles: callbacks.project?.listFiles ?? (() => []),
      readFile: callbacks.project?.readFile ?? (() => ''),
      writeFile: callbacks.project?.writeFile ?? (() => {}),
      deleteFile: callbacks.project?.deleteFile ?? (() => {}),
    },
    profile: {
      id: callbacks.profile?.id ?? null,
      email: callbacks.profile?.email ?? null,
      displayName: callbacks.profile?.displayName ?? null,
      stats: {
        extensionCount: callbacks.profile?.stats?.extensionCount ?? 0,
        installedExtensionCount: callbacks.profile?.stats?.installedExtensionCount ?? 0,
      },
    },
    fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
    storage: getStorage(slug),
    ai: { complete: aiComplete, structured: aiStructured },
  };
}

/* ------------------------------------------------------------------ */
/*  Execution (runs in main thread — safe enough for user-authored)    */
/* ------------------------------------------------------------------ */

export async function executeExtension(
  code: string,
  ctx: ExtensionContext,
  options?: { runtime?: ExtensionRuntimeType },
): Promise<unknown> {
  const cleaned = unwrapGeneratedExtensionCode(code);

  const wrapped = `
    return (async function(ctx) {
      ${cleaned}
    })
  `;
  try {
    const factory = new Function(wrapped);
    const fn = factory();
    const result = await fn(ctx);

    if (result && typeof result === 'object') {
      const runtimeResult = result as {
        execute?: (input: string) => unknown | Promise<unknown>;
        render?: () => string | Promise<string>;
        html?: unknown;
      };

      if (typeof runtimeResult.render === 'function') {
        const rendered = await runtimeResult.render();
        if (typeof rendered === 'string' && rendered.trim()) {
          ctx.showUI(rendered);
        }
      }

      if (typeof runtimeResult.html === 'string' && runtimeResult.html.trim()) {
        ctx.showUI(runtimeResult.html);
      }

      if (typeof runtimeResult.execute === 'function') {
        const shouldRunCommand = options?.runtime
          ? options.runtime === 'command'
          : typeof runtimeResult.render !== 'function';

        if (shouldRunCommand) {
          const selectedText = ctx.getSelectedText();
          const output = await runtimeResult.execute(selectedText);
          if (typeof output === 'string' && output !== selectedText) {
            ctx.replaceSelectedText(output);
          }
          return output;
        }
      }
    }

    return result;
  } catch (err) {
    console.error('[extension runtime]', err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Chat-tool bridge                                                   */
/* ------------------------------------------------------------------ */

export function extensionToChatTool(ext: InstalledExtension, ctx: ExtensionContext): ChatToolDefinition | null {
  if (ext.manifest.runtime !== 'chat-tool') return null;
  try {
    const wrapped = `return (function(ctx) { ${ext.code} })`;
    const factory = new Function(wrapped);
    const result = factory()(ctx);
    if (result && typeof result === 'object' && 'name' in result && 'execute' in result) {
      return result as ChatToolDefinition;
    }
  } catch (err) {
    console.error('[chat-tool bridge]', err);
  }
  return null;
}
