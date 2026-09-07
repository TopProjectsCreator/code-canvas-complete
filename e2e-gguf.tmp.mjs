// Real-browser e2e for public/workers/gguf-llm-worker.js.
// A: init tiny SmolLM2-135M (~100MB) — proves runtime+download+arch+cache.
// B: generate on tiny model — proves template+streaming+result path.
// C: Maple init — must fail FAST with the Maple-capable message (no 5GB burn).
import { chromium } from 'playwright';

const ORIGIN = 'http://localhost:5000';

const DRIVER = (payload, waitMs) => `
  (async () => {
    const worker = new Worker('/workers/gguf-llm-worker.js', { type: 'module' });
    const events = [];
    try {
      const outcome = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('TIMEOUT; last events: ' + JSON.stringify(events.slice(-3)))),
          ${waitMs}
        );
        worker.onmessage = (e) => {
          const d = e.data || {};
          events.push({ t: d.type, p: typeof d.progress === 'number' ? Math.round(d.progress * 1000) / 1000 : undefined, text: String(d.text || d.error || '').slice(0, 160) });
          if (d.type === 'ready' || d.type === 'result' || d.type === 'cache-cleared') { clearTimeout(timer); resolve({ events, final: d }); }
          if (d.type === 'error') { clearTimeout(timer); resolve({ events, final: d, failed: true }); }
        };
        worker.onerror = (e) => { clearTimeout(timer); reject(new Error('worker onerror: ' + (e.message || 'unknown'))); };
        worker.postMessage(${JSON.stringify(payload)});
      });
      return { eventCount: outcome.events.length, tail: outcome.events.slice(-5), failed: !!outcome.failed, finalText: String(outcome.final.text || outcome.final.error || '').slice(0, 400) };
    } finally {
      worker.terminate();
    }
  })()
`;

const browser = await chromium.launch({
  args: ['--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 220)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 220)));
  await page.goto(`${ORIGIN}/workers/gguf-llm-worker.js`);

  console.log('=== A: init tiny model ===');
  const tA = Date.now();
  const a = await page.evaluate(DRIVER({
    type: 'init', model: 'tiny', requestId: 1,
    config: { repo: 'ggml-org/SmolLM2-135M-GGUF', file: 'SmolLM2-135M-Q4_K_M.gguf', n_ctx: 256, temperature: 0.7, top_p: 0.9, enableThinking: false },
  }, 720000));
  console.log('A ms:', Date.now() - tA, 'failed:', a.failed);
  console.log('A tail:', JSON.stringify(a.tail, null, 1).slice(0, 1200));
  console.log('A final:', a.finalText.slice(0, 200));

  if (!a.failed) {
    console.log('=== B: generate (fresh worker, cached model) ===');
    const tB = Date.now();
    const b = await page.evaluate(DRIVER({
      type: 'generate', prompt: 'Say hello in five words.', requestId: 2,
      config: { repo: 'ggml-org/SmolLM2-135M-GGUF', file: 'SmolLM2-135M-Q4_K_M.gguf', n_ctx: 256, temperature: 0.7, top_p: 0.9, enableThinking: false },
      history: [{ role: 'user', content: 'Hi' }, { role: 'user', content: 'Are you there?' }],
      maxTokens: 24,
    }, 420000));
    console.log('B ms:', Date.now() - tB, 'failed:', b.failed);
    console.log('B tail:', JSON.stringify(b.tail, null, 1).slice(0, 1200));
    console.log('B final:', b.finalText.slice(0, 300));
  }

  console.log('=== C: Maple preflight (must fail fast, no gigabytes) ===');
  const tC = Date.now();
  const c = await page.evaluate(DRIVER({
    type: 'init', model: 'maple', requestId: 3,
    config: { repo: 'deepgrove/maple-preview-GGUF', file: 'maple-preview-TQ1_0-head-Q4_K.gguf', n_ctx: 512, temperature: 1.0, top_p: 0.95, enableThinking: false },
  }, 180000));
  console.log('C ms:', Date.now() - tC, 'failed:', c.failed);
  console.log('C tail:', JSON.stringify(c.tail, null, 1).slice(0, 1200));
  console.log('C final:', c.finalText.slice(0, 400));
} finally {
  await browser.close();
}
console.log('E2E DONE');
