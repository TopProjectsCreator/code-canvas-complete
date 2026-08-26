import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
const gpu = await page.evaluate(async () => {
  if (!navigator.gpu) return { supported: false };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: true, adapter: false };
    const feats = adapter.features ? [...adapter.features].slice(0, 6) : [];
    return { supported: true, adapter: true, features: feats };
  } catch (e) { return { supported: true, error: String(e).slice(0, 120) }; }
});
console.log('WebGPU in headless:', JSON.stringify(gpu));
// also check inside a worker context (our LLM runs in workers)
const workerGpu = await page.evaluate(() => new Promise((res) => {
  const w = new Worker(URL.createObjectURL(new Blob([`
    self.onmessage = async (e) => {
      if (!navigator.gpu) { self.postMessage({ supported: false }); return; }
      try {
        const a = await navigator.gpu.requestAdapter();
        self.postMessage({ supported: true, adapter: !!a });
      } catch (err) { self.postMessage({ supported: true, error: String(err).slice(0, 100) }); }
    };`], { type: 'text/javascript' })));
  w.onmessage = (e) => res(e.data);
  w.postMessage('go');
  setTimeout(() => res({ timeout: true }), 8000);
}));
console.log('WebGPU in worker:', JSON.stringify(workerGpu));
await browser.close();
process.exit(0);
