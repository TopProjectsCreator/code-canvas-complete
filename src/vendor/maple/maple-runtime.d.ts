/**
 * Minimal typings for the vendored Maple WebGPU runtime
 * (src/vendor/maple/maple-runtime.js, see README.md).
 * Covers only the public surface our service uses.
 */

export interface MapleProgressEvent {
  phase?: string;
  loaded?: number;
  total?: number;
  detail?: string;
}

export interface MapleLoadOptions {
  signal?: AbortSignal;
  onProgress?: (event: MapleProgressEvent) => void;
  maxContext?: number;
  cache?: boolean;
  kvFormat?: string;
}

export interface MapleGenerateEvent {
  token: number;
  delta: string;
  text: string;
  index: number;
  elapsed: number;
  prefillMs: number;
}

export interface MapleGenerateOptions {
  maxNewTokens?: number;
  signal?: AbortSignal;
  onPrefill?: (done: number, total: number) => void;
  promptIds?: number[];
}

export interface MapleChatMessage {
  role: string;
  content: string;
}

export interface MapleCompatibility {
  webgpu: boolean;
  secure: boolean;
  memory: number | null;
  adapter: unknown;
  adapterLabel: string;
  supported: boolean;
  reason: string;
  warning?: string;
  mobile?: boolean;
  subgroups?: boolean;
  limits?: {
    maxBufferSize: number;
    maxStorageBufferBindingSize: number;
    maxComputeWorkgroupStorageSize: number;
  };
}

export interface MapleRuntimeInstance {
  maxContext: number;
  useSubgroups: boolean;
  kvFormat: string;
  sampling: { temperature: number; minP: number };
  setSampling(sampling: { temperature?: number; minP?: number }): void;
  encodeChat(messages: MapleChatMessage[]): number[];
  generate(
    messages: MapleChatMessage[],
    options?: MapleGenerateOptions,
  ): AsyncIterable<MapleGenerateEvent>;
  setContext(tokens: number): Promise<number>;
  benchmark(options?: { warmup?: number; steps?: number; at?: number }): Promise<{
    tokensPerSecond: number;
    msPerToken: number;
    mode: string;
  }>;
  details(): Record<string, string>;
  destroy(): void;
}

export interface MapleRuntimeStatic {
  load(options?: MapleLoadOptions): Promise<MapleRuntimeInstance>;
  compatibility(): Promise<MapleCompatibility>;
  validateKernels(): Promise<{ ok: boolean; device: string; kernels: number; mode: string }>;
  validateWeightPack(options?: {
    layer?: boolean;
  }): Promise<{ ok: boolean; revision: string; files: number; tensors: number }>;
  encodeChat?: undefined;
}

export declare const MapleRuntime: MapleRuntimeStatic;
export declare const PRIMARY_MODEL: string;
export declare const WEIGHT_PACK: string;
export declare const WEIGHT_REVISION: string;
export declare const WEIGHT_BASE: string;
export declare const CONTEXT_CHOICES: number[];
export declare const CHECKPOINT_BYTES: number;
export declare const MODEL_MAX_CONTEXT: number;
export declare function contextBytesPerToken(kvFormat?: string): number;
export declare function maxContextFor(adapter: unknown): number;
export declare function isMobile(): boolean;
export declare const KV_FORMATS: Record<string, { label: string; bytes: number; scales: boolean }>;
