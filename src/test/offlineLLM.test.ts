import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type MsgHandler = (ev: { data: unknown }) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  static swallowFirstGenerate = false;
  static firstGenerateSwallowed = false;

  url: string;
  terminated = false;
  handlers: Record<string, Set<MsgHandler>> = { message: new Set(), error: new Set() };

  constructor(url: string) {
    this.url = url;
    FakeWorker.instances.push(this);
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

  postMessage(msg: { type: string; requestId?: number; model?: string }) {
    const deliver = (data: unknown) =>
      setTimeout(() => { this.handlers.message.forEach(h => h({ data })); }, 0);

    if (msg.type === 'init') {
      deliver({ type: 'ready', model: msg.model, requestId: msg.requestId });
    } else if (msg.type === 'generate') {
      if (FakeWorker.swallowFirstGenerate && !FakeWorker.firstGenerateSwallowed) {
        FakeWorker.firstGenerateSwallowed = true;
        return;
      }
      deliver({ type: 'token', text: 'Hi', requestId: msg.requestId });
      deliver({ type: 'result', text: 'Hi there', requestId: msg.requestId });
    }
  }

  static reset() {
    FakeWorker.instances = [];
    FakeWorker.swallowFirstGenerate = false;
    FakeWorker.firstGenerateSwallowed = false;
  }
}

const MODEL = 'onnx-community/Qwen3.5-0.8B-ONNX@q4f16';

describe('offlineLLM manager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWorker.reset();
    (globalThis as unknown as { Worker: unknown }).Worker = FakeWorker as unknown as typeof Worker;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  const loadService = async () => (await import('@/services/offlineLLM')).offlineLLM;

  /** Pump fake timers while an operation that relies on mocked worker delivery completes. */
  const pump = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms); };

  it('initializes and chats end-to-end when the worker behaves', async () => {
    const llm = await loadService();
    const initP = llm.initialize(MODEL);
    await pump(20);
    await initP;

    const p = llm.chat('hello');
    await pump(20);
    await expect(p).resolves.toBe('Hi there');
    expect(FakeWorker.instances.length).toBe(1);
  });

  it('recovers automatically when generation stalls silently', async () => {
    const llm = await loadService();
    const initP = llm.initialize(MODEL);
    await pump(20);
    await initP;

    // Next generate goes unanswered -> must hit the 45s watchdog...
    FakeWorker.swallowFirstGenerate = true;
    const p = llm.chat('ask me something');

    await pump(40_000);
    let settled = false;
    void p.then(() => { settled = true; }, () => { settled = true; });
    await pump(20);
    expect(settled).toBe(false); // no premature resolution, no hang either

    // ...crossing the window triggers rebuild-from-cache + one retry.
    await pump(6_000);   // watchdog fires here (45s mark)
    await pump(100);     // re-initialize + retry deliveries

    await expect(p).resolves.toBe('Hi there');
    expect(FakeWorker.instances.length).toBeGreaterThanOrEqual(2);
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });

  it('repeated initialize of the same model hits the fast path (no new worker)', async () => {
    const llm = await loadService();
    const first = llm.initialize(MODEL);
    await pump(20);
    await first;

    const before = FakeWorker.instances.length;
    const second = llm.initialize(MODEL);
    await pump(20);
    await second;
    expect(FakeWorker.instances.length).toBe(before);
  });
});
