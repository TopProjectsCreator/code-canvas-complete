import { toast } from 'sonner';

type OfflineEvent =
  | { type: 'status'; text: string }
  | { type: 'progress'; progress: number; text?: string }
  | { type: 'ready'; model: string }
  | { type: 'result'; text: string }
  | { type: 'error'; error: string };

class OfflineLLMManager {
  private worker: Worker | null = null;
  private readyModel: string | null = null;

  private ensureWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker('/workers/offline-llm-worker.js', { type: 'module' });
    return this.worker;
  }

  async initialize(model: string, onStatus?: (s: string) => void, onProgress?: (p: number, label?: string) => void) {
    const worker = this.ensureWorker();
    if (this.readyModel === model) {
      onProgress?.(1, 'Already downloaded');
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const onMessage = (event: MessageEvent<OfflineEvent>) => {
        const data = event.data;
        if (data.type === 'status') onStatus?.(data.text);
        if (data.type === 'progress') onProgress?.(data.progress, data.text);
        if (data.type === 'ready') {
          this.readyModel = data.model;
          worker.removeEventListener('message', onMessage);
          resolve();
        }
        if (data.type === 'error') {
          worker.removeEventListener('message', onMessage);
          reject(new Error(data.error));
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'init', model });
    });
  }

  async chat(prompt: string) {
    const worker = this.ensureWorker();
    return await new Promise<string>((resolve, reject) => {
      const onMessage = (event: MessageEvent<OfflineEvent>) => {
        const data = event.data;
        if (data.type === 'result') {
          worker.removeEventListener('message', onMessage);
          resolve(data.text);
        }
        if (data.type === 'error') {
          worker.removeEventListener('message', onMessage);
          reject(new Error(data.error));
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'generate', prompt });
    });
  }
}

export const offlineLLM = new OfflineLLMManager();

export const offlineModelStorageKey = 'canvas-offline-model';
export const offlineModeEnabledKey = 'canvas-offline-mode-enabled';
export const chatOnlyModeKey = 'canvas-chat-only-mode';

export const getSavedOfflineModel = () => localStorage.getItem(offlineModelStorageKey) || 'onnx-community/Llama-3.2-1B-Instruct';
export const setSavedOfflineModel = (model: string) => localStorage.setItem(offlineModelStorageKey, model);
export const getOfflineModeEnabled = () => localStorage.getItem(offlineModeEnabledKey) === '1';
export const setOfflineModeEnabled = (enabled: boolean) => localStorage.setItem(offlineModeEnabledKey, enabled ? '1' : '0');
export const getChatOnlyMode = () => localStorage.getItem(chatOnlyModeKey) === '1';
export const setChatOnlyMode = (enabled: boolean) => localStorage.setItem(chatOnlyModeKey, enabled ? '1' : '0');

export const preloadOfflineModel = async (
  model: string,
  onStatus?: (status: string) => void,
  onProgress?: (progress: number, label?: string) => void
) => {
  try {
    await offlineLLM.initialize(model, onStatus, onProgress);
    toast.success(`Offline model ready: ${model}`);
  } catch (error) {
    toast.error(`Offline model failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};
