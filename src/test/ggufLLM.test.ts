import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

type MsgHandler = (ev: { data: unknown }) => void;

class FakeGgufWorker {
  static instances: FakeGgufWorker[] = [];
  static swallowFirstGenerate = false;
  static firstGenerateSwallowed = false;

  url: string;
  terminated = false;
  lastMessage: { type: string; [k: string]: unknown } | null = null;
  handlers: Record<string, Set<MsgHandler>> = { message: new Set(), error: new Set() };

  constructor(url: string) {
    this.url = url;
    FakeGgufWorker.instances.push(this);
  }

  addEventListener(type: string, cb: MsgHandler) {
    this.handlers[type]?.add(cb);
  }

  removeEventListener(type: string, cb: MsgHandler) {
    this.handlers[type]?.delete(cb);
  }

  terminate() {
    this.terminated = true;
  }

  postMessage(msg: { type: string; requestId?: number; model?: string; config?: { repo?: string; file?: string } }) {
    this.lastMessage = msg as FakeGgufWorker['lastMessage'];
    const deliver = (data: unknown) =>
      setTimeout(() => { this.handlers.message.forEach(h => h({ data })); }, 0);

    if (msg.type === 'init') {
      deliver({ type: 'ready', model: `${msg.config?.repo}/${msg.config?.file}`, requestId: msg.requestId });
    } else if (msg.type === 'generate') {
      if (FakeGgufWorker.swallowFirstGenerate && !FakeGgufWorker.firstGenerateSwallowed) {
        FakeGgufWorker.firstGenerateSwallowed = true;
        return;
      }
      deliver({ type: 'token', text: 'Hello', requestId: msg.requestId });
      deliver({ type: 'result', text: 'Hello from GGUF', requestId: msg.requestId });
    } else if (msg.type === 'clear-cache') {
      deliver({ type: 'cache-cleared', requestId: msg.requestId });
    }
  }

  static reset() {
    FakeGgufWorker.instances = [];
    FakeGgufWorker.swallowFirstGenerate = false;
    FakeGgufWorker.firstGenerateSwallowed = false;
  }
}

const MAPLE = 'deepgrove/maple-preview-GGUF';
const LING = 'inclusionAI/Ling-3.0-tiny-GGUF';

describe('ggufLLM registry (official releases only)', () => {
  it('exposes the two official GGUF models with verified file identities', async () => {
    const { GGUF_MODELS, getGgufModelConfig, isGgufModelId } = await import('@/services/ggufLLM');
    expect(GGUF_MODELS.length).toBe(2);

    const maple = getGgufModelConfig(MAPLE)!;
    expect(maple.repo).toBe('deepgrove/maple-preview-GGUF');
    expect(maple.file).toBe('maple-preview-TQ1_0-head-Q4_K.gguf');
    expect(maple.arch).toBe('maple');
    expect(maple.sizeBytes).toBe(4984016416);

    const ling = getGgufModelConfig(LING)!;
    expect(ling.repo).toBe('inclusionAI/Ling-3.0-tiny-GGUF');
    expect(ling.file).toBe('Ling-3.0-tiny-Q4_K_M.gguf');
    expect(ling.arch).toBe('bailingmoe3');
    expect(ling.sizeBytes).toBe(4823894944);

    expect(isGgufModelId(MAPLE)).toBe(true);
    expect(isGgufModelId(LING)).toBe(true);
    expect(isGgufModelId('onnx-community/Qwen3.5-0.8B-ONNX@q4f16')).toBe(false);
    expect(isGgufModelId('some/random-model')).toBe(false);
  });

  it('marks both GGUF catalog entries as thinking-capable text models', async () => {
    const { RECOMMENDED_MODELS, modelSupportsThinking, getOfflineModelById } = await import('@/components/ide/offlineModelCatalog');
    for (const id of [MAPLE, LING]) {
      const entry = getOfflineModelById(id);
      expect(entry).toBeDefined();
      expect(entry!.runtime).toBe('gguf');
      expect(RECOMMENDED_MODELS).toContain(entry);
      expect(modelSupportsThinking(entry)).toBe(true);
    }
  });
});

describe('parseGgufHeader (real official header bytes)', () => {
  const loadFixture = (name: string) => {
    const buf = readFileSync(path.resolve(process.cwd(), 'src/test/fixtures', name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  };

  it('parses the official Maple GGUF header', async () => {
    const { parseGgufHeader } = await import('@/services/ggufLLM');
    const info = parseGgufHeader(loadFixture('maple-gguf-head.bin'));
    expect(info.arch).toBe('maple');
    expect(info.name).toBe('Maple Preview');
    expect(info.license).toBe('mit');
    expect(info.tensorCount).toBe(291);
    expect(info.kvCount).toBe(40);
  });

  it('parses the official Ling GGUF header', async () => {
    const { parseGgufHeader } = await import('@/services/ggufLLM');
    const info = parseGgufHeader(loadFixture('ling-gguf-head.bin'));
    expect(info.arch).toBe('bailingmoe3');
    expect(info.name).toBe('Ling-3.0-tiny');
    expect(info.license).toBe('mit');
    expect(info.tensorCount).toBe(526);
    expect(info.kvCount).toBe(53);
  });

  it('rejects non-GGUF bytes', async () => {
    const { parseGgufHeader } = await import('@/services/ggufLLM');
    expect(() => parseGgufHeader(new TextEncoder().encode('Found. Redirecting').buffer as ArrayBuffer)).toThrow(/GGUF/);
  });
});

describe('evaluateGgufDeviceCap (honest mobile handling)', () => {
  it('reports full tier on a capable desktop GPU', async () => {
    const { evaluateGgufDeviceCap } = await import('@/services/ggufLLM');
    const verdict = evaluateGgufDeviceCap({
      webgpu: true, deviceMemoryGB: 16, hardwareConcurrency: 12, mobileUA: false, maxBufferSizeMB: 2048,
    });
    expect(verdict.tier).toBe('full');
    expect(verdict.warnings).toEqual([]);
    expect(verdict.canLoadAnyway).toBe(true);
  });

  it('warns (never blocks) without WebGPU, on low memory, on phones, and on small buffers', async () => {
    const { evaluateGgufDeviceCap } = await import('@/services/ggufLLM');
    const verdict = evaluateGgufDeviceCap({
      webgpu: false, deviceMemoryGB: 4, hardwareConcurrency: 4, mobileUA: true, maxBufferSizeMB: 256,
    });
    expect(verdict.tier).toBe('limited');
    expect(verdict.warnings.length).toBeGreaterThanOrEqual(3);
    expect(verdict.warnings.join(' ')).toMatch(/WebGPU/);
    expect(verdict.canLoadAnyway).toBe(true);
  });
});

describe('ggufLLM manager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeGgufWorker.reset();
    (globalThis as unknown as { Worker: unknown }).Worker = FakeGgufWorker as unknown as typeof Worker;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  const loadService = async () => (await import('@/services/ggufLLM')).ggufLLM;
  const pump = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms); };

  it('uses its own worker file (not the transformers worker)', async () => {
    const llm = await loadService();
    const initP = llm.initialize(LING);
    await pump(20);
    await initP;
    expect(FakeGgufWorker.instances.length).toBe(1);
    expect(FakeGgufWorker.instances[0].url).toContain('gguf-llm-worker.js');
    expect(FakeGgufWorker.instances[0].url).not.toContain('offline-llm-worker.js');
  });

  it('initializes and chats end-to-end when the worker behaves', async () => {
    const llm = await loadService();
    const initP = llm.initialize(LING);
    await pump(20);
    await initP;

    // Official file identity must reach the worker untouched.
    expect(FakeGgufWorker.instances[0].lastMessage).toBeTruthy();
    const p = llm.chat(LING, 'hello');
    await pump(20);
    await expect(p).resolves.toBe('Hello from GGUF');
    expect(FakeGgufWorker.instances.length).toBe(1);
  });

  it('passes thinking + sampling config through to the worker', async () => {
    const llm = await loadService();
    const initP = llm.initialize(MAPLE, undefined, undefined, true);
    await pump(20);
    await initP;
    const initMsg = FakeGgufWorker.instances[0].lastMessage!;
    expect((initMsg.config as { enableThinking: boolean }).enableThinking).toBe(true);

    const p = llm.chat(MAPLE, 'reason carefully', { enableThinking: true });
    await pump(20);
    await expect(p).resolves.toBe('Hello from GGUF');
    const genMsg = FakeGgufWorker.instances[FakeGgufWorker.instances.length - 1].lastMessage!;
    expect(genMsg.type).toBe('generate');
    expect((genMsg.config as { temperature: number }).temperature).toBe(1.0);
  });

  it('recovers automatically when generation stalls silently', async () => {
    const llm = await loadService();
    const initP = llm.initialize(LING);
    await pump(20);
    await initP;

    FakeGgufWorker.swallowFirstGenerate = true;
    const p = llm.chat(LING, 'ask me something');

    await pump(55_000);
    let settled = false;
    void p.then(() => { settled = true; }, () => { settled = true; });
    await pump(20);
    expect(settled).toBe(false);

    await pump(6_000); // watchdog fires at the 60s mark
    await pump(100);   // re-initialize + retry deliveries
    await expect(p).resolves.toBe('Hello from GGUF');
    expect(FakeGgufWorker.instances.length).toBeGreaterThanOrEqual(2);
    expect(FakeGgufWorker.instances[0].terminated).toBe(true);
  });

  it('rejects unknown model ids without touching a worker', async () => {
    const llm = await loadService();
    await expect(llm.initialize('nope/not-a-model')).rejects.toThrow(/Unknown GGUF model/);
    expect(FakeGgufWorker.instances.length).toBe(0);
  });
});
