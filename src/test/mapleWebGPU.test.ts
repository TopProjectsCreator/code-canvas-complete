import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const loadCalls: Array<{ maxContext?: number; kvFormat?: string }> = [];
let generateImpl: ((messages: Array<{ role: string; content: string }>) => AsyncGenerator<{ delta: string }>) | null = null;
let compatibilityImpl: (() => Promise<unknown>) | null = null;
let encodeChatImpl: ((messages: Array<{ role: string; content: string }>) => number[]) | null = null;

const seenGenerateMessages: Array<Array<{ role: string; content: string }>> = [];

vi.mock('@/services/ggufLLM', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/ggufLLM')>();
  return {
    ...original,
    ggufLLM: {
      initialize: vi.fn(async () => {}),
      chat: vi.fn(async () => 'cpu answer'),
    },
    ggufDownloads: {
      download: vi.fn(async () => {}),
      snapshot: () => ({}),
      subscribe: () => () => {},
    },
    clearGgufModelCache: vi.fn(async () => {}),
  };
});

vi.mock('@/vendor/maple/maple-runtime.js', () => ({
  MapleRuntime: {
    load: vi.fn(async (opts: { maxContext?: number; kvFormat?: string }) => {
      loadCalls.push({ maxContext: opts?.maxContext, kvFormat: opts?.kvFormat });
      return {
        maxContext: opts?.maxContext ?? 4096,
        setSampling: vi.fn(),
        encodeChat: (messages: Array<{ role: string; content: string }>) => {
          if (encodeChatImpl) return encodeChatImpl(messages);
          // Rough token estimate: one id per word.
          return messages.flatMap((m) => String(m.content).split(/\s+/)).map((_, i) => i + 1);
        },
        generate: (messages: Array<{ role: string; content: string }>) => {
          seenGenerateMessages.push(messages);
          if (generateImpl) return generateImpl(messages);
          return (async function* () {
            yield { delta: '<think>\nLet me reason. ' };
            yield { delta: '</think>\n\nThe answer.' };
          })();
        },
        destroy: vi.fn(),
      };
    }),
    compatibility: vi.fn(async () => {
      if (compatibilityImpl) return compatibilityImpl();
      return { supported: true, reason: '', mobile: false, adapterLabel: 'Test GPU' };
    }),
    validateKernels: vi.fn(async () => ({ ok: true, device: 'Test GPU', kernels: 16, mode: 'portable' })),
    validateWeightPack: vi.fn(async () => ({ ok: true, revision: 'abc123', files: 28, tensors: 468 })),
  },
  PRIMARY_MODEL: 'deepgrove/maple-preview',
  WEIGHT_PACK: 'ProCreations/maple-preview-webgpu',
}));

describe('mapleWebGPU ids', () => {
  it('recognizes the current id and migrates the legacy GGUF-road id', async () => {
    const { isMapleModelId, MAPLE_MODEL_ID, MAPLE_LEGACY_GGUF_ID } = await import('@/services/mapleWebGPU');
    expect(MAPLE_MODEL_ID).toBe('deepgrove/maple-preview-webgpu');
    expect(isMapleModelId(MAPLE_MODEL_ID)).toBe(true);
    expect(isMapleModelId(MAPLE_LEGACY_GGUF_ID)).toBe(true);
    expect(isMapleModelId('inclusionAI/Ling-3.0-tiny-GGUF')).toBe(false);
    expect(isMapleModelId('onnx-community/Qwen3.5-0.8B-ONNX@q4f16')).toBe(false);
  });
});

describe('buildMapleMessages', () => {
  it('puts instructions in a real system turn and merges same-role runs', async () => {
    const { buildMapleMessages } = await import('@/services/mapleWebGPU');
    const messages = buildMapleMessages('answer me', [
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'ok' },
    ], 'Be brief.');
    expect(messages[0]).toEqual({ role: 'system', content: 'Be brief.' });
    // Same-role history runs merge; the prompt joins the trailing user turn,
    // or starts a fresh one after an assistant turn.
    expect(messages).toContainEqual({ role: 'user', content: 'first\n\nsecond' });
    expect(messages).toContainEqual({ role: 'assistant', content: 'ok' });
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'answer me' });
  });

  it('works with no history and no system prompt', async () => {
    const { buildMapleMessages } = await import('@/services/mapleWebGPU');
    expect(buildMapleMessages('hello')).toEqual([{ role: 'user', content: 'hello' }]);
  });
});

describe('mapleLLM manager (mocked engine)', () => {
  beforeEach(() => {
    localStorage.clear();
    loadCalls.length = 0;
    seenGenerateMessages.length = 0;
    generateImpl = null;
    compatibilityImpl = null;
    encodeChatImpl = null;
  });

  afterEach(async () => {
    const { mapleLLM } = await import('@/services/mapleWebGPU');
    mapleLLM.unloadForTests();
    vi.resetModules();
  });

  it('loads once with thinking-friendly sampling and marks the model downloaded', async () => {
    const { mapleLLM } = await import('@/services/mapleWebGPU');
    const statuses: string[] = [];
    await mapleLLM.initialize((s) => statuses.push(s), () => {});
    expect(loadCalls.length).toBe(1);
    expect(loadCalls[0]).toMatchObject({ maxContext: 4096, kvFormat: 'f32' });
    // Second initialize reuses the warm engine without reloading.
    await mapleLLM.initialize();
    expect(loadCalls.length).toBe(1);
    expect(JSON.parse(localStorage.getItem('canvas-downloaded-offline-models') || '[]'))
      .toContain('deepgrove/maple-preview-webgpu');
  });

  it('chats end to end, mapping think tags for the app parser', async () => {
    const { mapleLLM } = await import('@/services/mapleWebGPU');
    const deltas: string[] = [];
    const reply = await mapleLLM.chat('puzzle?', {
      systemPrompt: 'Be brief.',
      history: [{ role: 'user', content: 'hi' }],
      onToken: (d) => deltas.push(d),
    });
    expect(reply).toContain('<thinking_process>');
    expect(reply).toContain('The answer.');
    expect(deltas.length).toBeGreaterThan(0);
    // The engine saw a real system turn first — never squished into the question.
    expect(seenGenerateMessages[0][0]).toEqual({ role: 'system', content: 'Be brief.' });
  });

  it('trims old exchanges when the prompt would crowd out the reply', async () => {
    encodeChatImpl = (messages) => messages.flatMap((m) => String(m.content).split(/\s+/)).map((_, i) => i + 1);
    const { mapleLLM } = await import('@/services/mapleWebGPU');
    const filler = Array.from({ length: 200 }, (_, w) => `word${w}`).join(' ');
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message number ${i} ${filler}`,
    }));
    await mapleLLM.chat('final question here', { history });
    const sent = seenGenerateMessages[0];
    // Trailing question survives; oldest turns were dropped.
    expect(sent[sent.length - 1]).toMatchObject({ role: 'user' });
    expect(sent.length).toBeLessThan(history.length + 1);
  });

  it('surfaces engine errors instead of hanging', async () => {
    generateImpl = () => (async function* () {
      throw new Error('GPU device lost');
      yield { delta: '' };
    })();
    const { mapleLLM } = await import('@/services/mapleWebGPU');
    await expect(mapleLLM.chat('hello')).rejects.toThrow('GPU device lost');
  });
});

describe('mapleDownloads', () => {
  beforeEach(() => {
    localStorage.clear();
    loadCalls.length = 0;
  });

  afterEach(async () => {
    const { mapleLLM } = await import('@/services/mapleWebGPU');
    mapleLLM.unloadForTests();
    vi.resetModules();
  });

  it('publishes progress snapshots and dedupes concurrent downloads', async () => {
    const { mapleDownloads } = await import('@/services/mapleWebGPU');
    const snapshots: Array<Record<string, { status: string; progress: number }>> = [];
    const unsub = mapleDownloads.subscribe((s) => snapshots.push(s));
    const a = mapleDownloads.download('deepgrove/maple-preview-webgpu');
    const b = mapleDownloads.download('deepgrove/maple-preview-webgpu');
    await Promise.all([a, b]);
    unsub();
    // One engine load for two callers.
    expect(loadCalls.length).toBe(1);
    // Progress was published, then cleared when done.
    expect(snapshots.length).toBeGreaterThan(1);
    expect(mapleDownloads.snapshot()).toEqual({});
  });

  it('rejects unknown model ids without touching the engine', async () => {
    const { mapleDownloads } = await import('@/services/mapleWebGPU');
    await expect(mapleDownloads.download('someone/else')).rejects.toThrow(/Unknown Maple model/);
    expect(loadCalls.length).toBe(0);
  });
});

describe('checkMapleDevice', () => {
  it('passes through the engine compatibility verdict', async () => {
    const { checkMapleDevice } = await import('@/services/mapleWebGPU');
    await expect(checkMapleDevice()).resolves.toMatchObject({ supported: true, adapterLabel: 'Test GPU' });
  });

  it('reports unsupported plainly when the engine refuses', async () => {
    compatibilityImpl = async () => ({ supported: false, reason: 'No WebGPU here.', mobile: false });
    const { checkMapleDevice } = await import('@/services/mapleWebGPU');
    await expect(checkMapleDevice()).resolves.toMatchObject({ supported: false, reason: 'No WebGPU here.' });
    compatibilityImpl = null;
  });
});

describe('Maple CPU tier (slow machines)', () => {
  beforeEach(async () => {
    localStorage.clear();
    const { resetMapleTierForTests } = await import('@/services/mapleWebGPU');
    resetMapleTierForTests();
    compatibilityImpl = null;
  });

  afterEach(async () => {
    const { resetMapleTierForTests } = await import('@/services/mapleWebGPU');
    resetMapleTierForTests();
    compatibilityImpl = null;
    vi.resetModules();
  });

  it("picks the fast engine when graphics exist, CPU when they don't", async () => {
    const { selectMapleTier } = await import('@/services/mapleWebGPU');
    await expect(selectMapleTier()).resolves.toBe('webgpu');

    const { resetMapleTierForTests: reset } = await import('@/services/mapleWebGPU');
    reset();
    compatibilityImpl = async () => ({ supported: false, reason: 'No WebGPU here.', mobile: false });
    await expect(selectMapleTier()).resolves.toBe('cpu');
  });

  it('runs CPU chat without thinking: short cap, legacy id, migrated marker', async () => {
    compatibilityImpl = async () => ({ supported: false, reason: 'No WebGPU here.', mobile: false });
    const maple = await import('@/services/mapleWebGPU');
    const gguf = await import('@/services/ggufLLM');

    localStorage.setItem('canvas-downloaded-offline-models', JSON.stringify(['deepgrove/maple-preview-GGUF']));
    await maple.initializeMapleCpu();
    expect(gguf.ggufLLM.initialize).toHaveBeenCalledWith(
      'deepgrove/maple-preview-GGUF', undefined, undefined, false,
    );
    // Legacy marker folded into the canonical id — no orphan second entry.
    expect(JSON.parse(localStorage.getItem('canvas-downloaded-offline-models') || '[]'))
      .toEqual(['deepgrove/maple-preview-webgpu']);

    const reply = await maple.chatMapleCpu('hi', { systemPrompt: 'Be brief.' });
    expect(gguf.ggufLLM.chat).toHaveBeenCalledWith(
      'deepgrove/maple-preview-GGUF',
      'hi',
      expect.objectContaining({ maxTokens: 256, systemPrompt: 'Be brief.' }),
    );
    expect(reply).toBe('cpu answer');
  });

  it('clears both tiers from the device', async () => {
    const maple = await import('@/services/mapleWebGPU');
    const gguf = await import('@/services/ggufLLM');
    await maple.clearMapleCache();
    expect(gguf.clearGgufModelCache).toHaveBeenCalledWith('deepgrove/maple-preview-GGUF');
  });
});
