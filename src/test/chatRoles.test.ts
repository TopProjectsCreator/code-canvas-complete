import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  normalizeChatTurns,
  canonicalizeChatMessages,
  assertAlternatingChatMessages,
} from '@/lib/chatRoles';
// Worker copy must stay behavior-identical (single logic, two homes: the
// workers are static files that cannot import from src/).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - plain JS worker module without types
import * as workerRoles from '../../public/workers/chat-roles.js';

/** Mirrors the Gemma template's strict rule (verified against the real
 *  onnx-community/gemma-3-270m-it-ONNX chat template with transformers 4.2):
 *  after an optional leading system turn, (role=='user') === (index even). */
const passesGemmaRule = (messages: Array<{ role: string }>) => {
  const loop = messages[0]?.role === 'system' ? messages.slice(1) : messages;
  return loop.every((m, i) => (m.role === 'user') === (i % 2 === 0));
};

describe('normalizeChatTurns', () => {
  it('merges consecutive same-role turns and drops empties', () => {
    expect(normalizeChatTurns([
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: '   ' },
      { role: 'assistant', content: 'c' },
    ])).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
    ]);
  });

  it('strips leading assistants and coerces unknown roles to user', () => {
    expect(normalizeChatTurns([
      { role: 'assistant', content: 'partial (aborted)' },
      { role: 'system', content: 'notice' },
      { role: 'tool', content: 'output' },
      { role: 'user', content: 'go' },
    ])).toEqual([{ role: 'user', content: 'notice\n\noutput\n\ngo' }]);
  });

  it('handles garbage input without throwing', () => {
    expect(normalizeChatTurns(undefined)).toEqual([]);
    expect(normalizeChatTurns(null)).toEqual([]);
    expect(normalizeChatTurns('nope')).toEqual([]);
    expect(normalizeChatTurns([{ role: undefined, content: undefined }])).toEqual([]);
  });
});

describe('canonicalizeChatMessages', () => {
  it('appends trailing user text to a final user turn, else pushes one', () => {
    expect(canonicalizeChatMessages([{ role: 'user', content: 'a' }], 'b'))
      .toEqual([{ role: 'user', content: 'a\n\nb' }]);
    expect(canonicalizeChatMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }], 'c'))
      .toEqual([
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' },
      ]);
    expect(canonicalizeChatMessages([], 'hello')).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('leaves turns untouched when there is nothing to append', () => {
    expect(canonicalizeChatMessages([{ role: 'user', content: 'a' }], '')).toEqual([{ role: 'user', content: 'a' }]);
  });
});

describe('assertAlternatingChatMessages', () => {
  it('accepts alternating sequences starting with user', () => {
    expect(assertAlternatingChatMessages([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ])).toBe(true);
    expect(assertAlternatingChatMessages([])).toBe(true);
  });

  it('throws a diagnosable error naming the role sequence', () => {
    expect(() => assertAlternatingChatMessages([
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
    ])).toThrow(/user, user/);
    expect(() => assertAlternatingChatMessages([{ role: 'assistant', content: 'b' }])).toThrow(/index 0/);
  });
});

describe('chat-roles fuzzer (worker parity + Gemma rule)', () => {
  const roles = ['user', 'assistant', 'system', 'tool', undefined, null];
  const contents = ['hello', '', '   ', 'question?', 'answer.', '  padded  '];
  const appends = ['new prompt', '', '   '];

  // Deterministic PRNG so failures reproduce.
  const rand = (() => { let s = 42; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  it('canonical output always satisfies the strict template rule on 3000 adversarial histories', () => {
    for (let n = 0; n < 3000; n++) {
      const len = Math.floor(rand() * 6);
      const history = Array.from({ length: len }, () => ({ role: pick(roles), content: pick(contents) }));
      const out = canonicalizeChatMessages(history, pick(appends));
      expect(() => assertAlternatingChatMessages(out)).not.toThrow();
      expect(passesGemmaRule(out)).toBe(true);
    }
  });

  it('public/workers/chat-roles.js behaves identically to src/lib/chatRoles.ts', () => {    for (let n = 0; n < 500; n++) {
      const len = Math.floor(rand() * 5);
      const history = Array.from({ length: len }, () => ({ role: pick(roles), content: pick(contents) }));
      const append = pick(appends);
      expect(workerRoles.normalizeChatTurns(history)).toEqual(normalizeChatTurns(history));
      expect(workerRoles.canonicalizeChatMessages(history, append)).toEqual(canonicalizeChatMessages(history, append));
    }
    // assert parity: both throw on the same inputs, both pass on the same inputs
    expect(() => workerRoles.assertAlternatingChatMessages([{ role: 'user' }, { role: 'user' }])).toThrow();
    expect(workerRoles.assertAlternatingChatMessages([{ role: 'user' }, { role: 'assistant' }])).toBe(true);
  });
});

describe('GGUF arch preflight (fail fast before gigabytes download)', () => {
  const loadFixture = (name: string) => {
    const buf = readFileSync(path.resolve(process.cwd(), 'src/test/fixtures', name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  };

  it('parses real official headers in the worker module too', () => {
    expect(workerRoles.parseGgufHeaderBytes(loadFixture('maple-gguf-head.bin')).arch).toBe('maple');
    expect(workerRoles.parseGgufHeaderBytes(loadFixture('ling-gguf-head.bin')).arch).toBe('bailingmoe3');
    expect(() => workerRoles.parseGgufHeaderBytes(new TextEncoder().encode('nope').buffer as ArrayBuffer)).toThrow(/GGUF/);
  });

  it('blocks only the verified-unsupported maple backend', () => {
    expect(() => workerRoles.checkGgufArchSupported('maple')).toThrow(/Maple-capable browser runtime/);
    expect(workerRoles.checkGgufArchSupported('bailingmoe3')).toBe(true);
    expect(workerRoles.checkGgufArchSupported('qwen3')).toBe(true);
    expect(workerRoles.checkGgufArchSupported('')).toBe(true);
  });

  it('probes arch over fetch with proxy fallback, and throws when unreachable', async () => {
    const mapleBytes = loadFixture('maple-gguf-head.bin');
    const okOnce = () => Promise.resolve({ ok: true, status: 206, arrayBuffer: () => Promise.resolve(mapleBytes) });
    const fail = () => Promise.resolve({ ok: false, status: 403, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

    const seen: string[] = [];
    const rec = (url: string) => { seen.push(url); return okOnce(); };
    const info = await workerRoles.probeGgufArch('deepgrove/maple-preview-GGUF', 'f.gguf', { fetchImpl: rec, origin: 'https://app.test' });
    expect(info.arch).toBe('maple');
    expect(seen[0]).toBe('https://huggingface.co/deepgrove/maple-preview-GGUF/resolve/main/f.gguf');

    // Direct blocked -> same-origin proxy retry.
    seen.length = 0;
    let calls = 0;
    const flaky = (url: string) => { calls++; seen.push(url); return calls === 1 ? fail() : okOnce(); };
    const info2 = await workerRoles.probeGgufArch('r', 'f', { fetchImpl: flaky, origin: 'https://app.test' });
    expect(info2.arch).toBe('maple');
    expect(seen[1]).toBe('https://app.test/api/proxy/hf/r/resolve/main/f');

    // Unreachable everywhere (offline) -> throws so callers can skip preflight.
    await expect(workerRoles.probeGgufArch('r', 'f', { fetchImpl: fail, origin: '' })).rejects.toThrow();
  });
});
