import { toast } from 'sonner';
import {
  downloadedOfflineModelsKey,
  offlineModelUpdatedEvent,
} from '@/services/offlineLLM';

/**
 * GGUF backend for the offline LLM — runs official GGUF releases (llama.cpp
 * format) locally in the browser via @wllama/wllama v3 (llama.cpp WASM +
 * WebGPU) in public/workers/gguf-llm-worker.js.
 *
 * Official weight sources only. No conversions, no third-party repacks:
 *   - inclusionAI/Ling-3.0-tiny-GGUF (bailingmoe3, Q4_K_M, ~4.82GB):
 *     supported by the pinned stock runtime.
 *   - deepgrove/maple-preview-GGUF (maple, TQ1_0-head-Q4_K, ~4.98GB):
 *     needs a Maple-capable WASM built from the official
 *     deepgrove-ai/llama.cpp fork. Until then loads fail with an explicit
 *     actionable error (see worker). A fork-built WASM drops into
 *     `wasmUrls` with zero code changes.
 */

export interface GgufModelConfig {
  /** Catalog id — the Hugging Face repo. Stored verbatim (no @quant suffix). */
  id: string;
  name: string;
  description: string;
  size: string;
  sizeBytes: number;
  provider: string;
  repo: string;
  file: string;
  arch: string;
  /** Default context; small on purpose — KV cache is ~96 KiB/token/layer-class. */
  nCtx: number;
  temperature: number;
  top_p: number;
  /** Model natively reasons (thinking / enable_thinking template kwarg). */
  thinking: boolean;
  requiresGgufRuntime: boolean;
}

export const GGUF_MODELS: GgufModelConfig[] = [
  {
    id: 'deepgrove/maple-preview-GGUF',
    name: 'Maple Preview 20B',
    description:
      "DeepGrove's 20B-A1B ternary reasoning model (official GGUF). Extremely fast on capable GPUs; needs a Maple-capable runtime build — see status message if load fails.",
    size: '~5.0 GB',
    sizeBytes: 4984016416,
    provider: 'DeepGrove',
    repo: 'deepgrove/maple-preview-GGUF',
    file: 'maple-preview-TQ1_0-head-Q4_K.gguf',
    arch: 'maple',
    nCtx: 4096,
    temperature: 1.0,
    top_p: 0.95,
    thinking: true,
    requiresGgufRuntime: true,
  },
  {
    id: 'inclusionAI/Ling-3.0-tiny-GGUF',
    name: 'Ling 3.0 Tiny',
    description:
      "InclusionAI's 7.9B/1.3B-active hybrid reasoning MoE (official GGUF, Q4_K_M). Strong agentic + coding performance for its size.",
    size: '~4.8 GB',
    sizeBytes: 4823894944,
    provider: 'InclusionAI',
    repo: 'inclusionAI/Ling-3.0-tiny-GGUF',
    file: 'Ling-3.0-tiny-Q4_K_M.gguf',
    arch: 'bailingmoe3',
    nCtx: 4096,
    temperature: 1.0,
    top_p: 0.95,
    thinking: true,
    requiresGgufRuntime: true,
  },
];

export const getGgufModelConfig = (id: string): GgufModelConfig | undefined => {
  const base = id.split('@')[0];
  return GGUF_MODELS.find(m => m.id === base);
};

export const isGgufModelId = (id: string) => getGgufModelConfig(id) !== undefined;

/** Override URLs for a Maple-capable WASM (official fork build). Unset by default. */
export const MAPLE_WASM_URLS: string[] = [];

const GGUF_WORKER_URL = '/workers/gguf-llm-worker.js?v=20260906-gguf2';

const GENERATE_STALL_MS = 60_000;
// 5GB first-loads take a long time; progress events re-arm this watchdog.
const INIT_STALL_MS = 600_000;

type GgufEvent =
  | { type: 'status'; text: string }
  | { type: 'progress'; progress: number; text?: string }
  | { type: 'token'; text: string }
  | { type: 'ready'; model: string }
  | { type: 'result'; text: string }
  | { type: 'cache-cleared' }
  | { type: 'error'; error: string };

export interface GgufChatOptions {
  enableThinking?: boolean;
  onToken?: (delta: string) => void;
  systemPrompt?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}

class GgufLLMManager {
  private worker: Worker | null = null;
  private readyKey: string | null = null;
  private lastConfig: GgufModelConfig | null = null;
  private lastThinking: boolean | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>();
  private tokenListeners = new Map<number, (delta: string) => void>();

  private ensureWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker(GGUF_WORKER_URL, { type: 'module' });
    this.worker.addEventListener('message', this.onWorkerMessage);
    return this.worker;
  }

  recoverWorker() {
    try { this.worker?.terminate(); } catch { /* already gone */ }
    this.worker = null;
    this.readyKey = null;
  }

  private onWorkerMessage = (event: MessageEvent<GgufEvent & { requestId?: number }>) => {
    const data = event.data;
    const id = data.requestId;
    if (id === undefined) return;
    if (data.type === 'token') {
      this.tokenListeners.get(id)?.(data.text);
      return;
    }
    if (!this.pending.has(id)) return;
    const { resolve, reject } = this.pending.get(id)!;
    if (data.type === 'result' || data.type === 'ready' || data.type === 'cache-cleared') {
      this.pending.delete(id);
      this.tokenListeners.delete(id);
      resolve(data);
    } else if (data.type === 'error') {
      this.pending.delete(id);
      this.tokenListeners.delete(id);
      reject(new Error(data.error));
    }
  };

  private buildConfig(rawModel: string, enableThinking: boolean) {
    const config = getGgufModelConfig(rawModel);
    if (!config) throw new Error(`Unknown GGUF model: ${rawModel}`);
    return {
      repo: config.repo,
      file: config.file,
      n_ctx: config.nCtx,
      temperature: config.temperature,
      top_p: config.top_p,
      enableThinking,
      ...(config.arch === 'maple' && MAPLE_WASM_URLS.length ? { wasmUrls: MAPLE_WASM_URLS } : {}),
    };
  }

  async initialize(rawModel: string, onStatus?: (s: string) => void, onProgress?: (p: number, label?: string) => void, enableThinking = false) {
    const config = getGgufModelConfig(rawModel);
    if (!config) throw new Error(`Unknown GGUF model: ${rawModel}`);
    const key = `${config.repo}/${config.file}`;
    if (this.readyKey === key && this.lastThinking === enableThinking) {
      markGgufModelDownloaded(config.id);
      onProgress?.(1, 'Already downloaded');
      return;
    }
    const worker = this.ensureWorker();
    const id = ++this.requestId;
    worker.postMessage({ type: 'init', model: key, requestId: id, config: this.buildConfig(rawModel, enableThinking) });
    await new Promise<void>((resolve, reject) => {
      let stallTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const cleanup = () => {
        settled = true;
        if (stallTimer) clearTimeout(stallTimer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onWorkerError);
      };
      const arm = () => {
        if (settled) return;
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          const err = new Error('GGUF model load stalled (no activity for a while).');
          (err as Error & { code?: string }).code = 'OFFLINE_STALL';
          cleanup();
          reject(err);
        }, INIT_STALL_MS);
      };
      const onWorkerError = (event: Event) => {
        if (settled) return;
        const message = (event as ErrorEvent)?.message || 'GGUF worker failed to start';
        cleanup();
        reject(new Error(message));
      };
      const onMessage = (event: MessageEvent<GgufEvent & { requestId?: number }>) => {
        const data = event.data;
        if (data.type === 'status') { onStatus?.(data.text); arm(); }
        else if (data.type === 'progress') { onProgress?.(data.progress, data.text); arm(); }
        else if (data.type === 'ready' && data.requestId === id) {
          this.readyKey = key;
          this.lastConfig = config;
          this.lastThinking = enableThinking;
          markGgufModelDownloaded(config.id);
          cleanup();
          resolve();
        }
        else if (data.type === 'error' && data.requestId === id) {
          cleanup();
          reject(new Error(data.error));
        }
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onWorkerError);
      arm();
    });
  }

  async chat(rawModel: string, prompt: string, opts: GgufChatOptions = {}) {
    const config = getGgufModelConfig(rawModel);
    if (!config) throw new Error(`Unknown GGUF model: ${rawModel}`);
    const attempt = (): Promise<string> => new Promise<string>((resolve, reject) => {
      const worker = this.ensureWorker();
      const id = ++this.requestId;
      let stallTimer: ReturnType<typeof setTimeout> | undefined;
      const clearStall = () => { if (stallTimer) clearTimeout(stallTimer); };
      const bump = () => {
        clearStall();
        stallTimer = setTimeout(() => {
          this.pending.delete(id);
          this.tokenListeners.delete(id);
          const err = new Error('Local model stopped responding.');
          (err as Error & { code?: string }).code = 'OFFLINE_STALL';
          reject(err);
        }, GENERATE_STALL_MS);
      };
      if (opts.onToken) {
        this.tokenListeners.set(id, (delta) => { bump(); opts.onToken!(delta); });
      }
      this.pending.set(id, {
        resolve: (data) => { clearStall(); resolve((data as GgufEvent & { text?: string }).text!); },
        reject: (reason) => { clearStall(); reject(reason); },
      });
      bump();
      worker.postMessage({
        type: 'generate',
        prompt,
        config: this.buildConfig(rawModel, !!opts.enableThinking),
        enableThinking: opts.enableThinking,
        systemPrompt: opts.systemPrompt,
        history: opts.history,
        maxTokens: opts.maxTokens,
        requestId: id,
      });
    });

    try {
      return await attempt();
    } catch (err) {
      if ((err as Error & { code?: string })?.code !== 'OFFLINE_STALL') throw err;
      this.recoverWorker();
      if (this.lastConfig) {
        try { await this.initialize(this.lastConfig.id, undefined, undefined, this.lastThinking ?? false); } catch { /* retry surfaces real error */ }
      }
      return await attempt();
    }
  }
}

export const ggufLLM = new GgufLLMManager();

interface ActiveDownload {
  model: string;
  status: string;
  progress: number;
}

class GgufDownloadManager {
  private active = new Map<string, Promise<void>>();
  private state = new Map<string, ActiveDownload>();
  private listeners = new Set<(snapshot: Record<string, ActiveDownload>) => void>();
  private runningCount = 0;
  /** 5GB files: strictly serial so connections and disks are not thrashed. */
  private maxConcurrent = 1;

  subscribe(listener: (snapshot: Record<string, ActiveDownload>) => void) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }

  snapshot(): Record<string, ActiveDownload> {
    const out: Record<string, ActiveDownload> = {};
    for (const [k, v] of this.state.entries()) out[k] = { ...v };
    return out;
  }

  private emit() {
    const snap = this.snapshot();
    this.listeners.forEach(l => l(snap));
  }

  isDownloading(model: string) {
    return this.active.has(model);
  }

  /** Loads the official GGUF through an ephemeral worker; the runtime persists it in browser cache. */
  download(rawModel: string) {
    const config = getGgufModelConfig(rawModel);
    if (!config) return Promise.reject(new Error(`Unknown GGUF model: ${rawModel}`));
    const model = config.id;
    if (this.active.has(model)) return this.active.get(model)!;

    const run = async () => {
      this.state.set(model, { model, status: 'Queued...', progress: 0 });
      this.emit();
      while (this.runningCount >= this.maxConcurrent) {
        await new Promise(r => setTimeout(r, 250));
      }
      this.runningCount += 1;
      try {
        this.state.set(model, { model, status: 'Starting download...', progress: 0 });
        this.emit();

        await new Promise<void>((resolve, reject) => {
          const worker = new Worker(GGUF_WORKER_URL, { type: 'module' });
          let settled = false;
          const finish = (err?: Error) => {
            if (settled) return;
            settled = true;
            worker.terminate();
            if (err) reject(err); else resolve();
          };
          worker.addEventListener('message', (event: MessageEvent<GgufEvent & { requestId?: number }>) => {
            const data = event.data;
            if (data.type === 'status') {
              this.state.set(model, { ...this.state.get(model)!, status: data.text });
              this.emit();
            } else if (data.type === 'progress') {
              this.state.set(model, { ...this.state.get(model)!, progress: data.progress, ...(data.text ? { status: data.text } : {}) });
              this.emit();
            } else if (data.type === 'ready') {
              markGgufModelDownloaded(config.id);
              finish();
            } else if (data.type === 'error') {
              finish(new Error(data.error));
            }
          });
          worker.addEventListener('error', (event) => finish(new Error(event.message || 'Download worker crashed')));
          worker.postMessage({
            type: 'init',
            model: `${config.repo}/${config.file}`,
            requestId: 1,
            config: {
              repo: config.repo,
              file: config.file,
              n_ctx: config.nCtx,
              temperature: config.temperature,
              top_p: config.top_p,
              enableThinking: false,
              ...(config.arch === 'maple' && MAPLE_WASM_URLS.length ? { wasmUrls: MAPLE_WASM_URLS } : {}),
            },
          });
        });

        this.state.delete(model);
        this.emit();
      } finally {
        this.runningCount -= 1;
      }
    };

    const tracked = run()
      .catch(err => {
        this.state.delete(model);
        this.emit();
        throw err;
      })
      .finally(() => this.active.delete(model));

    this.active.set(model, tracked);
    return tracked;
  }
}

export const ggufDownloads = new GgufDownloadManager();

export const clearGgufModelCache = (rawModel: string) =>
  new Promise<void>((resolve, reject) => {
    const config = getGgufModelConfig(rawModel);
    if (!config) { resolve(); return; }
    const worker = new Worker(GGUF_WORKER_URL, { type: 'module' });
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (err) reject(err); else resolve();
    };
    worker.addEventListener('message', (event: MessageEvent<GgufEvent & { requestId?: number }>) => {
      const data = event.data;
      if (data.type === 'cache-cleared') finish();
      else if (data.type === 'error') finish(new Error(data.error));
    });
    worker.addEventListener('error', (event) => finish(new Error(event.message || 'Cache cleanup worker crashed')));
    worker.postMessage({ type: 'clear-cache', model: config.id, requestId: 1, config: { repo: config.repo, file: config.file } });
  });

// --- Shared downloaded-models list (same localStorage key as the transformers backend) ---

export const getGgufDownloadedModels = (): string[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = JSON.parse(localStorage.getItem(downloadedOfflineModelsKey) || '[]');
    const ids = new Set(GGUF_MODELS.map(m => m.id));
    return Array.isArray(saved) ? saved.filter((m): m is string => typeof m === 'string' && ids.has(m.split('@')[0])) : [];
  } catch {
    return [];
  }
};

export const markGgufModelDownloaded = (model: string) => {  const config = getGgufModelConfig(model);
  if (!config) return;
  try {
    const saved = JSON.parse(localStorage.getItem(downloadedOfflineModelsKey) || '[]');
    const list: string[] = Array.isArray(saved) ? saved.filter((m): m is string => typeof m === 'string') : [];
    if (!list.includes(config.id)) {
      localStorage.setItem(downloadedOfflineModelsKey, JSON.stringify([...list, config.id]));
    }
  } catch { /* non-fatal */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(offlineModelUpdatedEvent, { detail: config.id }));
  }
};

export const removeGgufDownloadedModel = (model: string) => {
  const config = getGgufModelConfig(model);
  const target = config ? config.id : model;
  try {
    const saved = JSON.parse(localStorage.getItem(downloadedOfflineModelsKey) || '[]');
    const remaining = Array.isArray(saved)
      ? saved.filter((m): m is string => typeof m === 'string' && m !== target)
      : [];
    localStorage.setItem(downloadedOfflineModelsKey, JSON.stringify(remaining));
  } catch { /* non-fatal */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(offlineModelUpdatedEvent, { detail: target }));
  }
};

// --- GGUF header probe (reads only magic + metadata KV, ~first 64KB) ---

export interface GgufHeaderInfo {
  arch: string;
  name?: string;
  sizeLabel?: string;
  license?: string;
  tensorCount: number;
  kvCount: number;
}

const GGUF_TYPE_SIZES: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 1, 11: 8, 12: 8 };

export const parseGgufHeader = (buffer: ArrayBuffer): GgufHeaderInfo => {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'GGUF') throw new Error('Not a GGUF file (bad magic)');
  const tensorCount = Number(view.getBigUint64(8, true));
  const kvCount = Number(view.getBigUint64(16, true));
  const text = new TextDecoder();
  let off = 24; // magic(4) + version(4) + n_tensors(8) + n_kv(8)
  const out: GgufHeaderInfo = { arch: '', tensorCount, kvCount };
  const maxPairs = Math.min(kvCount, 80);
  for (let i = 0; i < maxPairs; i++) {
    if (off + 12 > view.byteLength) break;
    const klen = Number(view.getBigUint64(off, true)); off += 8;
    if (klen > 256 || off + klen + 4 > view.byteLength) break;
    const key = text.decode(new Uint8Array(buffer, off, klen)); off += klen;
    const vtype = view.getUint32(off, true); off += 4;
    if (vtype === 8) {
      if (off + 8 > view.byteLength) break;
      const vlen = Number(view.getBigUint64(off, true)); off += 8;
      if (vlen > 512 || off + vlen > view.byteLength) break;
      const value = text.decode(new Uint8Array(buffer, off, vlen)); off += vlen;
      if (key === 'general.architecture') out.arch = value;
      else if (key === 'general.name') out.name = value;
      else if (key === 'general.size_label') out.sizeLabel = value;
      else if (key === 'general.license') out.license = value;
    } else if (vtype in GGUF_TYPE_SIZES) {
      off += GGUF_TYPE_SIZES[vtype];
    } else if (vtype === 9) {
      // array: element type + len; skip only fixed-size element arrays
      if (off + 12 > view.byteLength) break;
      const etype = view.getUint32(off, true); off += 4;
      const alen = Number(view.getBigUint64(off, true)); off += 8;
      if (etype === 8) break; // string arrays need per-item lengths; stop probing
      const esize = GGUF_TYPE_SIZES[etype];
      if (esize === undefined || alen > 64) break;
      off += esize * alen;
    } else {
      break;
    }
    if (out.arch && out.name && out.sizeLabel && out.license) break;
  }
  if (!out.arch) throw new Error('GGUF architecture not found in header');
  return out;
};

/** Fetches only the first 64KB of an official GGUF to verify arch/identity without downloading gigabytes. */
export const probeGgufHeader = async (url: string): Promise<GgufHeaderInfo> => {
  const res = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
  if (!res.ok && res.status !== 206) throw new Error(`Header probe failed: HTTP ${res.status}`);
  return parseGgufHeader(await res.arrayBuffer());
};

// --- Device capability gate (honest mobile handling à la the reference Space) ---

export interface GgufDeviceInput {
  webgpu: boolean;
  deviceMemoryGB: number | null;
  hardwareConcurrency: number;
  mobileUA: boolean;
  maxBufferSizeMB: number | null;
}

export interface GgufDeviceVerdict {
  tier: 'full' | 'limited';
  warnings: string[];
  canLoadAnyway: true;
}

export const MIN_RECOMMENDED_MEMORY_GB = 8;

/** Pure policy: ~5GB GGUFs need desktop-class memory; phones are warned, never hard-blocked (LOAD ANYWAY). */
export const evaluateGgufDeviceCap = (input: GgufDeviceInput): GgufDeviceVerdict => {
  const warnings: string[] = [];
  if (!input.webgpu) {
    warnings.push('No WebGPU detected — the model falls back to CPU (WASM), which is much slower but still works.');
  }
  if (input.deviceMemoryGB !== null && input.deviceMemoryGB < MIN_RECOMMENDED_MEMORY_GB) {
    warnings.push(
      `This device reports ~${input.deviceMemoryGB}GB RAM; these ~5GB models need 8GB+ (12GB recommended). The browser tab may be killed part-way through loading.`
    );
  }
  if (input.mobileUA) {
    warnings.push('Phones/tablets often kill large-model tabs (especially iOS Safari, ~1–1.5GB tab budget). Use Wi-Fi and keep this tab in the foreground.');
  }
  if (input.maxBufferSizeMB !== null && input.maxBufferSizeMB < 1024) {
    warnings.push(`This GPU exposes small buffers (max ${input.maxBufferSizeMB}MB); loading streams in chunks and will be slower.`);
  }
  return { tier: warnings.length === 0 ? 'full' : 'limited', warnings, canLoadAnyway: true };
};

export const checkGgufDeviceCap = async (): Promise<GgufDeviceVerdict> => {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  let webgpu = false;
  let maxBufferSizeMB: number | null = null;
  try {
    const gpu = (nav as Navigator & { gpu?: { requestAdapter: () => Promise<{ limits?: { maxBufferSize?: number } } | null> } })?.gpu;
    if (gpu) {
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        webgpu = true;
        const maxBuf = adapter.limits?.maxBufferSize;
        if (typeof maxBuf === 'number') maxBufferSizeMB = Math.round(maxBuf / (1024 * 1024));
      }
    }
  } catch { /* treat as no WebGPU */ }
  const deviceMemoryGB = typeof (nav as { deviceMemory?: number } | undefined)?.deviceMemory === 'number'
    ? (nav as unknown as { deviceMemory: number }).deviceMemory : null;
  const hardwareConcurrency = typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : 1;
  const ua = typeof nav?.userAgent === 'string' ? nav.userAgent : '';
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return evaluateGgufDeviceCap({ webgpu, deviceMemoryGB, hardwareConcurrency, mobileUA, maxBufferSizeMB });
};

export const preloadGgufModel = async (
  model: string,
  onStatus?: (status: string) => void,
  onProgress?: (progress: number, label?: string) => void,
  enableThinking = false,
) => {
  try {
    await ggufLLM.initialize(model, onStatus, onProgress, enableThinking);
    toast.success(`Offline model ready: ${model}`);
  } catch (error) {
    toast.error(`Offline model failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};
