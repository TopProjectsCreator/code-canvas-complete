import { toast } from 'sonner';
import {
  downloadedOfflineModelsKey,
  offlineModelUpdatedEvent,
} from '@/services/offlineLLM';
import { ggufLLM, ggufDownloads, clearGgufModelCache, MAPLE_CPU_GGUF_ID } from '@/services/ggufLLM';
import type {
  MapleChatMessage,
  MapleGenerateOptions,
  MapleRuntimeInstance,
} from '@/vendor/maple/maple-runtime';

/**
 * Maple Preview 20B in the browser — custom WebGPU engine (NOT the GGUF/wllama
 * path; the stock llama.cpp runtime has no `maple` backend).
 *
 * Engine vendored byte-identical from the community demo Space; see
 * src/vendor/maple/README.md for source, license state, and re-sync commands.
 * Weights stream once (~5.3GB, MIT-licensed repack of DeepGrove's official
 * checkpoint) from Hugging Face, then run offline from the browser's
 * origin-private file system.
 *
 * Maple always reasons: generation runs until the model emits a stop token, so
 * there is intentionally NO fixed reply cap. The thinking toggle in the UI only
 * shows/hides the thought text — it never disables thinking.
 */

export const MAPLE_MODEL_ID = 'deepgrove/maple-preview-webgpu';
/** Previous catalog id (GGUF road, never functional) — migrated, never loaded. */
export const MAPLE_LEGACY_GGUF_ID = 'deepgrove/maple-preview-GGUF';

const baseIdOf = (id: string) => id.split('@')[0];

export const isMapleModelId = (id: string) => {
  const base = baseIdOf(id);
  return base === MAPLE_MODEL_ID || base === MAPLE_LEGACY_GGUF_ID;
};

/** Sampling default from the reference demo (greedy locks into repeats). */
const MAPLE_SAMPLING = { temperature: 0.7, minP: 0.03 };
const MAPLE_CONTEXT = 4096;
/** Keep room for a real answer: Maple thinks for hundreds of tokens first. */
const MAPLE_REPLY_HEADROOM = 1024;

/** Map the engine's think tags onto tags the app's parser understands. */
export const mapMapleThinkTags = (text: string) =>
  text.replace(/<think>/gi, '<thinking_process>').replace(/<\/think>/gi, '</thinking_process>');

/**
 * Build the exact message list for the engine. Maple's official chat template
 * has a dedicated `system` branch, so instructions ride as a real system turn
 * (unlike the ONNX road, where Gemma rejects `system` and we must fold it in).
 */
export const buildMapleMessages = (
  prompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  systemPrompt?: string,
): MapleChatMessage[] => {
  const out: MapleChatMessage[] = [];
  if (systemPrompt?.trim()) out.push({ role: 'system', content: systemPrompt });
  for (const turn of history) {
    const content = String(turn?.content ?? '').trim();
    if (!content) continue;
    const role = turn?.role === 'assistant' ? 'assistant' : 'user';
    const last = out[out.length - 1];
    // Never hand the template two same-role turns in a row.
    if (last && last.role === role && last.role !== 'system') last.content += `\n\n${content}`;
    else out.push({ role, content });
  }
  const text = String(prompt ?? '');
  if (text.trim()) {
    const last = out[out.length - 1];
    if (last && last.role === 'user') last.content += `\n\n${text}`;
    else out.push({ role: 'user', content: text });
  }
  return out;
};

export interface MapleChatOptions {
  onToken?: (delta: string) => void;
  systemPrompt?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
}

class MapleManager {
  private runtime: MapleRuntimeInstance | null = null;
  private loading: Promise<MapleRuntimeInstance> | null = null;

  get isLoaded() {
    return this.runtime !== null;
  }

  /** Test seam: drop the loaded engine (the weights stay cached on device). */
  unloadForTests() {
    try {
      this.runtime?.destroy();
    } catch {
      /* already gone */
    }
    this.runtime = null;
    this.loading = null;
  }

  async initialize(
    onStatus?: (status: string) => void,
    onProgress?: (progress: number, label?: string) => void,
  ): Promise<void> {
    if (this.runtime) {
      markMapleDownloaded(MAPLE_MODEL_ID);
      onProgress?.(1, 'Already downloaded');
      return;
    }
    if (!this.loading) {
      this.loading = (async () => {
        const { MapleRuntime } = await import('@/vendor/maple/maple-runtime.js');
        const controller = new AbortController();
        const runtime = await MapleRuntime.load({
          signal: controller.signal,
          maxContext: MAPLE_CONTEXT,
          kvFormat: 'f32',
          onProgress: (event) => {
            if (event.phase) onStatus?.(event.phase);
            const total = typeof event.total === 'number' && event.total > 1 ? event.total : 0;
            const loaded = typeof event.loaded === 'number' ? event.loaded : 0;
            if (total > 0) onProgress?.(Math.max(0, Math.min(1, loaded / total)), event.phase);
          },
        });
        runtime.setSampling(MAPLE_SAMPLING);
        return runtime;
      })().catch((error) => {
        this.loading = null;
        throw error;
      });
    }
    this.runtime = await this.loading;
    markMapleDownloaded(MAPLE_MODEL_ID);
  }

  private trimToFit(messages: MapleChatMessage[]): MapleChatMessage[] {
    const runtime = this.runtime;
    if (!runtime || typeof runtime.encodeChat !== 'function' || messages.length <= 1) return messages;
    const budget = runtime.maxContext - MAPLE_REPLY_HEADROOM;
    const out = [...messages];
    let guard = 0;
    while (out.length > 1 && guard++ < 64) {
      let length: number;
      try {
        length = runtime.encodeChat(out).length;
      } catch {
        return out;
      }
      if (length <= budget) return out;
      // Drop the oldest exchange, never the trailing user turn or a lone system turn.
      const dropAt = out[0].role === 'system' ? 1 : 0;
      if (out[dropAt]?.role === 'user' && out[dropAt + 1]?.role === 'assistant') out.splice(dropAt, 2);
      else out.splice(dropAt, 1);
    }
    return out;
  }

  async chat(prompt: string, opts: MapleChatOptions = {}): Promise<string> {
    await this.initialize();
    const runtime = this.runtime;
    if (!runtime) throw new Error('Maple is not initialized yet.');
    const messages = this.trimToFit(buildMapleMessages(prompt, opts.history, opts.systemPrompt));
    const genOpts: MapleGenerateOptions = {};
    if (opts.signal) genOpts.signal = opts.signal;
    let raw = '';
    try {
      for await (const event of runtime.generate(messages, genOpts)) {
        const delta = event?.delta ?? '';
        if (!delta) continue;
        raw += delta;
        opts.onToken?.(mapMapleThinkTags(delta));
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw new Error('Generation stopped');
      throw error;
    }
    const text = mapMapleThinkTags(raw).trim();
    return text || 'No response generated.';
  }

  destroy() {
    try {
      this.runtime?.destroy();
    } catch {
      /* already gone */
    }
    this.runtime = null;
    this.loading = null;
  }
}

export const mapleLLM = new MapleManager();

/** Short-answer cap for the CPU tier: at CPU speeds thinking is off anyway. */
export const MAPLE_CPU_MAX_TOKENS = 256;

let cachedTier: Promise<'webgpu' | 'cpu'> | null = null;

/**
 * Picks this session's Maple road once: the fast WebGPU engine when the
 * device can run it, otherwise the CPU translator tier (slow, thinking off).
 * Cached — a device doesn't gain a GPU mid-session.
 */
export const selectMapleTier = (): Promise<'webgpu' | 'cpu'> => {
  if (!cachedTier) {
    cachedTier = checkMapleDevice()
      .then((verdict) => (verdict.supported ? 'webgpu' : 'cpu'))
      .catch(() => 'cpu' as const);
  }
  return cachedTier;
};

/** Test seam: forget the cached road. */
export const resetMapleTierForTests = () => {
  cachedTier = null;
};

/** CPU-tier load: official GGUF plus the custom translator, thinking off. */
export const initializeMapleCpu = (
  onStatus?: (status: string) => void,
  onProgress?: (progress: number, label?: string) => void,
) =>
  ggufLLM
    .initialize(MAPLE_CPU_GGUF_ID, onStatus, onProgress, false)
    .then(() => migrateMapleLegacyMarker());

/** CPU-tier chat: short direct answers, no thought prefix in the template. */
export const chatMapleCpu = (
  prompt: string,
  opts: MapleChatOptions = {},
): Promise<string> =>
  ggufLLM.chat(MAPLE_CPU_GGUF_ID, prompt, {
    systemPrompt: opts.systemPrompt,
    history: opts.history,
    maxTokens: MAPLE_CPU_MAX_TOKENS,
    onToken: opts.onToken,
  });

/** CPU-tier download (progress flows through the shared GGUF states). */
export const downloadMapleCpu = () =>
  ggufDownloads.download(MAPLE_CPU_GGUF_ID).then(() => migrateMapleLegacyMarker());

/**
 * The GGUF road files its marker under the legacy id — fold it into the
 * canonical Maple id so the UI never shows a orphaned second entry.
 */
export const migrateMapleLegacyMarker = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(downloadedOfflineModelsKey) || '[]');
    const list: string[] = Array.isArray(saved) ? saved.filter((m): m is string => typeof m === 'string') : [];
    if (!list.some((m) => baseIdOf(m) === MAPLE_CPU_GGUF_ID)) return;
    const migrated = list.map((m) => (baseIdOf(m) === MAPLE_CPU_GGUF_ID ? MAPLE_MODEL_ID : m));
    localStorage.setItem(downloadedOfflineModelsKey, JSON.stringify([...new Set(migrated)]));
  } catch {
    /* non-fatal */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(offlineModelUpdatedEvent, { detail: MAPLE_MODEL_ID }));
  }
};

interface ActiveDownload {
  model: string;
  status: string;
  progress: number;
}

class MapleDownloadManager {
  private active = new Map<string, Promise<void>>();
  private state = new Map<string, ActiveDownload>();
  private listeners = new Set<(snapshot: Record<string, ActiveDownload>) => void>();

  subscribe(listener: (snapshot: Record<string, ActiveDownload>) => void) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): Record<string, ActiveDownload> {
    const out: Record<string, ActiveDownload> = {};
    for (const [k, v] of this.state.entries()) out[k] = { ...v };
    return out;
  }

  private emit() {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }

  isDownloading(model: string) {
    return this.active.has(baseIdOf(model));
  }

  /** Loading IS the download: weights persist on device, the engine stays warm. */
  download(rawModel: string) {
    const model = baseIdOf(rawModel);
    if (model !== MAPLE_MODEL_ID && model !== MAPLE_LEGACY_GGUF_ID) {
      return Promise.reject(new Error(`Unknown Maple model: ${rawModel}`));
    }
    const key = MAPLE_MODEL_ID;
    if (this.active.has(key)) return this.active.get(key)!;

    const run = async () => {
      this.state.set(key, { model: key, status: 'Starting download...', progress: 0 });
      this.emit();
      try {
        await mapleLLM.initialize(
          (status) => {
            const prev = this.state.get(key);
            if (prev) {
              this.state.set(key, { ...prev, status });
              this.emit();
            }
          },
          (progress, label) => {
            const prev = this.state.get(key);
            if (prev) {
              this.state.set(key, {
                ...prev,
                progress,
                ...(label ? { status: label } : {}),
              });
              this.emit();
            }
          },
        );
        this.state.delete(key);
        this.emit();
      } catch (error) {
        this.state.delete(key);
        this.emit();
        throw error;
      }
    };

    const tracked = run().finally(() => this.active.delete(key));
    this.active.set(key, tracked);
    return tracked;
  }
}

export const mapleDownloads = new MapleDownloadManager();

/** Frees every Maple weight pack on the device (both tiers) plus the live engine. */
export const clearMapleCache = async (): Promise<void> => {
  mapleLLM.destroy();
  try {
    await clearGgufModelCache(MAPLE_CPU_GGUF_ID);
  } catch {
    /* best effort */
  }
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const root = await nav?.storage?.getDirectory?.();
    const packs = await root?.getDirectoryHandle?.('maple-pack', { create: false }).catch(() => null);
    if (!packs) return;
    const names: string[] = [];
    const keys = (packs as FileSystemDirectoryHandle & { keys?: () => AsyncIterable<string> }).keys?.();
    if (keys) {
      for await (const name of keys) names.push(name);
    }
    await Promise.all(names.map((name) => packs.removeEntry(name, { recursive: true }).catch(() => {})));
  } catch {
    /* best effort — a missing cache is already the desired end state */
  }
};

export interface MapleDeviceVerdict {
  supported: boolean;
  reason: string;
  mobile: boolean;
  warning?: string;
  adapterLabel?: string;
}

/** Honest device gate in the reference demo's style: warn, rarely block. */
export const checkMapleDevice = async (): Promise<MapleDeviceVerdict> => {
  try {
    const { MapleRuntime } = await import('@/vendor/maple/maple-runtime.js');
    const check = await MapleRuntime.compatibility();
    return {
      supported: !!check.supported,
      reason: check.reason || '',
      mobile: !!check.mobile,
      warning: check.warning,
      adapterLabel: check.adapterLabel,
    };
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : 'WebGPU is unavailable in this browser.',
      mobile: false,
    };
  }
};

/** Compiles every shader with no weights — the no-download smoke test. */
export const validateMapleKernels = async () => {
  const { MapleRuntime } = await import('@/vendor/maple/maple-runtime.js');
  return MapleRuntime.validateKernels();
};

/** Downloads one 4KB file and verifies the pack pipeline end to end. */
export const validateMaplePack = async () => {
  const { MapleRuntime } = await import('@/vendor/maple/maple-runtime.js');
  return MapleRuntime.validateWeightPack({ layer: false });
};

// --- Shared downloaded-models list (same key as the other offline backends) ---

export const getMapleDownloadedModels = (): string[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = JSON.parse(localStorage.getItem(downloadedOfflineModelsKey) || '[]');
    return Array.isArray(saved)
      ? saved.filter((m): m is string => typeof m === 'string' && baseIdOf(m) === MAPLE_MODEL_ID)
      : [];
  } catch {
    return [];
  }
};

export const markMapleDownloaded = (model: string) => {
  if (!isMapleModelId(model)) return;
  try {
    const saved = JSON.parse(localStorage.getItem(downloadedOfflineModelsKey) || '[]');
    const list: string[] = Array.isArray(saved) ? saved.filter((m): m is string => typeof m === 'string') : [];
    // Migrate the legacy GGUF-road marker so it never points at a dead backend.
    const withoutLegacy = list.filter((m) => baseIdOf(m) !== MAPLE_LEGACY_GGUF_ID);
    if (!withoutLegacy.includes(MAPLE_MODEL_ID)) {
      localStorage.setItem(downloadedOfflineModelsKey, JSON.stringify([...withoutLegacy, MAPLE_MODEL_ID]));
    } else if (withoutLegacy.length !== list.length) {
      localStorage.setItem(downloadedOfflineModelsKey, JSON.stringify(withoutLegacy));
    }
  } catch {
    /* non-fatal */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(offlineModelUpdatedEvent, { detail: MAPLE_MODEL_ID }));
  }
};

export const removeMapleDownloadedModel = (model: string) => {
  if (!isMapleModelId(model)) return;
  try {
    const saved = JSON.parse(localStorage.getItem(downloadedOfflineModelsKey) || '[]');
    const remaining = Array.isArray(saved)
      ? saved.filter((m): m is string => typeof m === 'string' && !isMapleModelId(m))
      : [];
    localStorage.setItem(downloadedOfflineModelsKey, JSON.stringify(remaining));
  } catch {
    /* non-fatal */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(offlineModelUpdatedEvent, { detail: MAPLE_MODEL_ID }));
  }
};

export const preloadMapleModel = async (
  onStatus?: (status: string) => void,
  onProgress?: (progress: number, label?: string) => void,
) => {
  try {
    await mapleLLM.initialize(onStatus, onProgress);
    toast.success(`Offline model ready: ${MAPLE_MODEL_ID}`);
  } catch (error) {
    toast.error(`Offline model failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};
