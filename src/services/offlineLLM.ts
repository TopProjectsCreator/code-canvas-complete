import { toast } from 'sonner';
import {
  DEFAULT_OFFLINE_MODEL_ID,
} from '@/components/ide/offlineModelCatalog';

type OfflineEvent =
  | { type: 'status'; text: string }
  | { type: 'progress'; progress: number; text?: string }
  | { type: 'token'; text: string }
  | { type: 'ready'; model: string }
  | { type: 'result'; text: string }
  | { type: 'cache-cleared' }
  | { type: 'error'; error: string };

export interface OfflineChatOptions {
  images?: Array<{ base64: string; mime?: string }>;
  /** Decoded 16kHz mono waveform, prepared on the main thread. */
  audio?: Float32Array;
  enableThinking?: boolean;
  onToken?: (delta: string) => void;
  systemPrompt?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const WORKER_URL = '/workers/offline-llm-worker.js?v=20260825-offline-fix1';

// Watchdogs: how long we tolerate zero activity before declaring a stall and
// triggering one automatic worker rebuild + retry.
const GENERATE_STALL_MS = 45_000;
const INIT_STALL_MS = 60_000;

class OfflineLLMManager {
  private worker: Worker | null = null;
  private readyModel: string | null = null;
  private lastModel: string | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>();
  private tokenListeners = new Map<number, (delta: string) => void>();

  private ensureWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker(WORKER_URL, { type: 'module' });
    this.worker.addEventListener('message', this.onWorkerMessage);
    return this.worker;
  }

  /** Nukes a possibly-wedged worker instance; next use rebuilds it and loads the model from browser cache. */
  recoverWorker() {
    try { this.worker?.terminate(); } catch { /* already gone */ }
    this.worker = null;
    this.readyModel = null;
  }

  private onWorkerMessage = (event: MessageEvent<OfflineEvent & { requestId?: number }>) => {
    const data = event.data;
    const id = data.requestId;
    if (id === undefined) return;
    if (data.type === 'token') {
      this.tokenListeners.get(id)?.(data.text);
      return;
    }
    if (!this.pending.has(id)) return;
    const { resolve, reject } = this.pending.get(id)!;
    if (data.type === 'result' || data.type === 'ready') {
      this.pending.delete(id);
      this.tokenListeners.delete(id);
      resolve(data);
    } else if (data.type === 'error') {
      this.pending.delete(id);
      this.tokenListeners.delete(id);
      reject(new Error(data.error));
    }
  };

  async initialize(model: string, onStatus?: (s: string) => void, onProgress?: (p: number, label?: string) => void) {
    const normalizedModel = normalizeOfflineModelId(model);
    if (this.readyModel === normalizedModel) {
      markOfflineModelDownloaded(normalizedModel);
      onProgress?.(1, 'Already downloaded');
      return;
    }
    const worker = this.ensureWorker();
    const id = ++this.requestId;
    worker.postMessage({ type: 'init', model: normalizedModel, requestId: id });
    await new Promise<void>((resolve, reject) => {
      let stallTimer: ReturnType<typeof setTimeout> | undefined;
      const arm = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          const err = new Error('Model load stalled (no activity for a while).');
          (err as Error & { code?: string }).code = 'OFFLINE_STALL';
          reject(err);
        }, INIT_STALL_MS);
      };
      const onMessage = (event: MessageEvent<OfflineEvent & { requestId?: number }>) => {
        const data = event.data;
        if (data.type === 'status') { onStatus?.(data.text); arm(); }
        else if (data.type === 'progress') { onProgress?.(data.progress, data.text); arm(); }
        else if (data.type === 'ready' && data.requestId === id) {
          this.readyModel = normalizeOfflineModelId(data.model);
          this.lastModel = this.readyModel;
          markOfflineModelDownloaded(this.readyModel);
          worker.removeEventListener('message', onMessage);
          if (stallTimer) clearTimeout(stallTimer);
          resolve();
        }
        else if (data.type === 'error' && data.requestId === id) {
          worker.removeEventListener('message', onMessage);
          if (stallTimer) clearTimeout(stallTimer);
          reject(new Error(data.error));
        }
      };
      worker.addEventListener('message', onMessage);
      arm();
    });
  }

  async chat(prompt: string, opts: OfflineChatOptions = {}) {
    const attempt = (): Promise<string> => new Promise<string>((resolve, reject) => {
      const worker = this.ensureWorker();
      const id = ++this.requestId;
      let stallTimer: ReturnType<typeof setTimeout> | undefined;
      const clearStall = () => { if (stallTimer) clearTimeout(stallTimer); };
      // Any token counts as activity; total silence past the window = stall.
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
        resolve: (data) => { clearStall(); resolve((data as OfflineEvent & { text?: string }).text!); },
        reject: (reason) => { clearStall(); reject(reason); },
      });
      const transfer = opts.audio ? [opts.audio.buffer] : [];
      bump();
      worker.postMessage({
        type: 'generate',
        prompt,
        images: opts.images,
        audio: opts.audio,
        enableThinking: opts.enableThinking,
        systemPrompt: opts.systemPrompt,
        history: opts.history,
        requestId: id,
      }, transfer);
    });

    try {
      return await attempt();
    } catch (err) {
      if ((err as Error & { code?: string })?.code !== 'OFFLINE_STALL') throw err;
      // One automatic recovery: rebuild the worker (model comes from browser cache)
      // and retry the exact same question. The user just sees the answer arrive late.
      this.recoverWorker();
      if (this.lastModel) {
        try { await this.initialize(this.lastModel); } catch { /* retry will surface real error */ }
      }
      return await attempt();
    }
  }
}

export const offlineLLM = new OfflineLLMManager();

interface ActiveDownload {
  model: string;
  status: string;
  progress: number;
}

class OfflineDownloadManager {
  private active = new Map<string, Promise<void>>();
  private state = new Map<string, ActiveDownload>();
  private listeners = new Set<(snapshot: Record<string, ActiveDownload>) => void>();
  private maxConcurrent = 3;
  private runningCount = 0;

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
    return this.active.has(normalizeOfflineModelId(model));
  }

  /** Queued behind other downloads; each runs on its own ephemeral worker so parallel inference/download never conflicts. */
  download(rawModel: string) {
    const model = normalizeOfflineModelId(rawModel);
    if (this.active.has(model)) return this.active.get(model)!;
    markOfflineModelDownloadedPending(model);

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
        const worker = new Worker(WORKER_URL, { type: 'module' });
        let settled = false;
        const finish = (err?: Error) => {
          if (settled) return;
          settled = true;
          worker.terminate();
          if (err) reject(err); else resolve();
        };
        worker.addEventListener('message', (event: MessageEvent<OfflineEvent & { requestId?: number }>) => {
          const data = event.data;
          if (data.type === 'status') {
            this.state.set(model, { ...this.state.get(model)!, status: data.text });
            this.emit();
          } else if (data.type === 'progress') {
            this.state.set(model, { ...this.state.get(model)!, progress: data.progress, ...(data.text ? { status: data.text } : {}) });
            this.emit();
          } else if (data.type === 'ready') {
            markOfflineModelDownloaded(data.model || model);
            finish();
          } else if (data.type === 'error') {
            finish(new Error(data.error));
          }
        });
        worker.addEventListener('error', (event) => finish(new Error(event.message || 'Download worker crashed')));
        worker.postMessage({ type: 'init', model, requestId: 1 });
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

/** Marks intent-to-download so the UI can show "queued" state even before the worker spins up. */
const pendingMarksKey = 'canvas-pending-offline-models';
const markOfflineModelDownloadedPending = (model: string) => {
  try {
    const pending = JSON.parse(localStorage.getItem(pendingMarksKey) || '[]');
    if (!pending.includes(model)) localStorage.setItem(pendingMarksKey, JSON.stringify([...pending, model]));
  } catch {
    /* non-fatal */
  }
};

export const offlineDownloads = new OfflineDownloadManager();

/** Frees the browser cache entries for a model via a one-off worker. */
export const clearOfflineModelCache = (rawModel: string) =>
  new Promise<void>((resolve, reject) => {
    const model = normalizeOfflineModelId(rawModel);
    const worker = new Worker(WORKER_URL, { type: 'module' });
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (err) reject(err); else resolve();
    };
    worker.addEventListener('message', (event: MessageEvent<OfflineEvent & { requestId?: number }>) => {
      const data = event.data;
      if (data.type === 'cache-cleared') finish();
      else if (data.type === 'error') finish(new Error(data.error));
    });
    worker.addEventListener('error', (event) => finish(new Error(event.message || 'Cache cleanup worker crashed')));
    worker.postMessage({ type: 'clear-cache', model, requestId: 1 });
  });

/** Extracts 1-3 frames from a base64 video as image base64s for Gemma 4 E2B vision path. */
export const prepareOfflineVideoImages = async (base64: string, mime = 'video/mp4', maxFrames = 3): Promise<Array<{ base64: string; mime: string }>> => {
  if (typeof document === 'undefined' || typeof HTMLVideoElement === 'undefined') {
    throw new Error('Video frame extraction requires a browser DOM.');
  }
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available for video frame extraction');

  const waitForEvent = (el: HTMLVideoElement, ev: string, timeoutMs = 8000) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Video ${ev} timeout`)), timeoutMs);
      el.addEventListener(ev, () => { clearTimeout(t); resolve(); }, { once: true });
      el.addEventListener('error', () => { clearTimeout(t); reject(new Error('Video load error')); }, { once: true });
    });

  try {
    await waitForEvent(video, 'loadedmetadata');
    const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const times = maxFrames === 1 ? [duration / 2] : maxFrames === 2 ? [duration * 0.25, duration * 0.75] : [duration * 0.2, duration * 0.5, duration * 0.8];
    const frames: Array<{ base64: string; mime: string }> = [];
    canvas.width = video.videoWidth || 448;
    canvas.height = video.videoHeight || 448;
    for (const t of times) {
      video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
      await waitForEvent(video, 'seeked');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const b64 = dataUrl.split(',')[1] || '';
      if (b64) frames.push({ base64: b64, mime: 'image/jpeg' });
    }
    return frames.length ? frames : [];
  } finally {
    URL.revokeObjectURL(url);
    video.remove();
    canvas.remove();
  }
};

const TARGET_AUDIO_SAMPLE_RATE = 16000;

/** Decodes base64 audio on the main thread (workers lack AudioContext) into 16kHz mono PCM for the feature extractor. */
export const prepareOfflineAudio = async (base64: string, _mime = 'audio/mpeg'): Promise<Float32Array> => {
  if (typeof AudioContext === 'undefined') {
    throw new Error('Audio input requires a browser with Web Audio support.');
  }
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const ctx = new AudioContext({ sampleRate: TARGET_AUDIO_SAMPLE_RATE });
  try {
    const decoded = await ctx.decodeAudioData(bytes.buffer);
    let mono: Float32Array;
    if (decoded.numberOfChannels === 2) {
      const left = decoded.getChannelData(0);
      const right = decoded.getChannelData(1);
      mono = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        mono[i] = Math.SQRT2 * (left[i] + right[i]) / 2;
      }
    } else {
      mono = new Float32Array(decoded.getChannelData(0));
    }
    return mono;
  } finally {
    void ctx.close();
  }
};

export const offlineModelStorageKey = 'canvas-offline-model';
export const offlineModeEnabledKey = 'canvas-offline-mode-enabled';
export const chatOnlyModeKey = 'canvas-chat-only-mode';
export const downloadedOfflineModelsKey = 'canvas-downloaded-offline-models';
export const offlineThinkingKey = 'canvas-offline-thinking-enabled';
export const offlineModelUpdatedEvent = 'canvas-offline-model-updated';
const DEFAULT_OFFLINE_QUANT = 'q4f16';

export const normalizeOfflineModelId = (model: string) =>
  model.includes('@') ? model : `${model}@${DEFAULT_OFFLINE_QUANT}`;

export const getDownloadedOfflineModels = (): string[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = JSON.parse(localStorage.getItem(downloadedOfflineModelsKey) || '[]');
    return Array.isArray(saved) ? saved.filter((model): model is string => typeof model === 'string') : [];
  } catch {
    return [];
  }
};

export const removeDownloadedOfflineModel = (model: string) => {
  const normalizedModel = normalizeOfflineModelId(model);
  const remaining = getDownloadedOfflineModels().filter(m => m !== normalizedModel);
  localStorage.setItem(downloadedOfflineModelsKey, JSON.stringify(remaining));
  window.dispatchEvent(new CustomEvent(offlineModelUpdatedEvent, { detail: normalizedModel }));
};

export const isOfflineModelDownloaded = (model: string) =>
  getDownloadedOfflineModels().includes(normalizeOfflineModelId(model));

export const markOfflineModelDownloaded = (model: string) => {
  const normalizedModel = normalizeOfflineModelId(model);
  const downloadedModels = getDownloadedOfflineModels();
  if (!downloadedModels.includes(normalizedModel)) {
    localStorage.setItem(downloadedOfflineModelsKey, JSON.stringify([...downloadedModels, normalizedModel]));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(offlineModelUpdatedEvent, { detail: normalizedModel }));
  }
};

export const getSavedOfflineModel = () => localStorage.getItem(offlineModelStorageKey) || DEFAULT_OFFLINE_MODEL_ID;
export const setSavedOfflineModel = (model: string) => localStorage.setItem(offlineModelStorageKey, model);
export const getOfflineModeEnabled = () => localStorage.getItem(offlineModeEnabledKey) === '1';
export const setOfflineModeEnabled = (enabled: boolean) => localStorage.setItem(offlineModeEnabledKey, enabled ? '1' : '0');
export const getChatOnlyMode = () => localStorage.getItem(chatOnlyModeKey) === '1';
export const setChatOnlyMode = (enabled: boolean) => localStorage.setItem(chatOnlyModeKey, enabled ? '1' : '0');
export const getOfflineThinkingEnabled = () => localStorage.getItem(offlineThinkingKey) === '1';
export const setOfflineThinkingEnabled = (enabled: boolean) => localStorage.setItem(offlineThinkingKey, enabled ? '1' : '0');

export const preloadOfflineModel = async (
  model: string,
  onStatus?: (status: string) => void,
  onProgress?: (progress: number, label?: string) => void
) => {
  try {
    await offlineLLM.initialize(model, onStatus, onProgress);
    toast.success(`Offline model ready: ${normalizeOfflineModelId(model)}`);
  } catch (error) {
    toast.error(`Offline model failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};
