/**
 * GGUF offline worker — runs official GGUF models (llama.cpp format) locally
 * in the browser via @wllama/wllama v3 (llama.cpp WASM + WebGPU).
 *
 * Official weight sources only — no conversions, no third-party repacks:
 *   - inclusionAI/Ling-3.0-tiny-GGUF (arch bailingmoe3, Q4_K_M ~4.82GB)
 *     runs on the stock pinned runtime below.
 *   - deepgrove/maple-preview-GGUF (arch maple, TQ1_0-head-Q4_K ~4.98GB)
 *     needs a Maple-capable WASM built from the official
 *     deepgrove-ai/llama.cpp fork. The stock runtime below does NOT contain
 *     the maple architecture, so Maple loads fail with an explicit,
 *     actionable error. A fork-built WASM can be dropped in later via the
 *     `wasmUrls` init override with zero worker changes.
 *
 * Protocol mirrors offline-llm-worker.js OfflineEvents:
 *   in:  {type:'init', model, requestId, config:{repo,file,n_ctx,
 *           temperature,top_p,enableThinking,wasmUrls?,modelUrlOverride?}}
 *        {type:'generate', prompt, requestId, systemPrompt, history,
 *           enableThinking, maxTokens}
 *        {type:'unload', requestId}
 *        {type:'clear-cache', requestId}
 *   out: {type:'status'|'progress'|'token'|'ready'|'result'|
 *           'cache-cleared'|'error', ..., requestId}
 */

const WLLAMA_JS_URLS = [
  `${self.location.origin}/wllama/index.js`,
  'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.6.1/esm/index.js',
  'https://unpkg.com/@wllama/wllama@3.6.1/esm/index.js',
  `${self.location.origin}/api/proxy/jsdelivr/npm/@wllama/wllama@3.6.1/esm/index.js`,
  `${self.location.origin}/api/replit/proxy/jsdelivr/npm/@wllama/wllama@3.6.1/esm/index.js`,
];

const wllamaOrigin = () => {
  try { return self.location.origin; } catch { return ''; }
};

const defaultWasmUrls = () => [
  `${wllamaOrigin()}/wllama/wllama.wasm`,
  'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.6.1/src/wasm/wllama.wasm',
  'https://unpkg.com/@wllama/wllama@3.6.1/src/wasm/wllama.wasm',
  `${wllamaOrigin()}/api/proxy/jsdelivr/npm/@wllama/wllama@3.6.1/src/wasm/wllama.wasm`,
];

let wllamaMod = null;
// Shared role canonicalization — strict templates raise
// "Conversation roles must alternate..." on any violation.
let canonicalizeChatMessages;
let assertAlternatingChatMessages;
let probeGgufArch;
let checkGgufArchSupported;
try {
  ({ canonicalizeChatMessages, assertAlternatingChatMessages, probeGgufArch, checkGgufArchSupported } = await import('./chat-roles.js'));
} catch {
  canonicalizeChatMessages = (messages, appendUserText = '') => {
    const out = [];
    for (const t of Array.isArray(messages) ? messages : []) {
      const role = t?.role === 'assistant' ? 'assistant' : 'user';
      const content = String(t?.content ?? '').trim();
      if (!content) continue;
      const last = out[out.length - 1];
      if (last && last.role === role) last.content += '\n\n' + content;
      else out.push({ role, content });
    }
    while (out.length && out[0].role === 'assistant') out.shift();
    const text = appendUserText === undefined || appendUserText === null ? '' : String(appendUserText);
    if (text.trim()) {
      const last = out[out.length - 1];
      if (last && last.role === 'user') last.content += `\n\n${text}`;
      else out.push({ role: 'user', content: text });
    }
    return out;
  };
  assertAlternatingChatMessages = (messages) => {
    const roles = (Array.isArray(messages) ? messages : []).map(m => m?.role);
    for (let i = 0; i < roles.length; i++) {
      const expected = i % 2 === 0 ? 'user' : 'assistant';
      if (roles[i] !== expected) {
        throw new Error(`Non-alternating chat roles [${roles.join(', ')}] at index ${i}.`);
      }
    }
    return true;
  };
  // Fallback preflight mirrors chat-roles.js: only the verified-unsupported
  // 'maple' backend is blocked; everything else attempts a normal load.
  // NOTE: this deliberately cannot parse headers (kept dependency-free) —
  // without the shared module the full preflight is skipped and the runtime
  // surfaces the real load error instead.
  probeGgufArch = async () => ({ arch: '', skipped: true });
  checkGgufArchSupported = (arch) => {
    if (arch === 'maple') {
      throw new Error(`Maple-Preview needs a Maple-capable browser runtime (this runtime has no 'maple' model backend).`);
    }
    return true;
  };
}
const loadWllama = async () => {
  if (wllamaMod?.Wllama) return wllamaMod;
  let lastError = null;
  for (const url of WLLAMA_JS_URLS) {
    try {
      const mod = await import(url);
      if (!mod?.Wllama) throw new Error(`Invalid wllama module shape from ${url}`);
      wllamaMod = mod;
      return mod;
    } catch (error) {
      lastError = error;
      try {
        self.postMessage({ type: 'status', text: `GGUF runtime: CDN fallback (${new URL(url).hostname})...` });
      } catch { /* non-URL origins */ }
    }
  }
  throw lastError || new Error('Unable to load GGUF runtime (wllama)');
};

/** Pick the first reachable WASM binary so a missing self-hosted file falls through to CDN. */
const pickWasmUrl = async (candidates) => {
  let lastError = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return url;
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
  }
  // Last resort: return the first candidate and let the loader surface the real error.
  if (candidates.length) return candidates[0];
  throw lastError || new Error('No WASM URLs configured');
};

const isMapleArchError = (error) => {
  const raw = String(error?.message || error || '');
  return /unknown model architecture|unsupported.*architecture|no model.*maple|maple/i.test(raw)
    && /arch|model|support|unknown/i.test(raw);
};

const mapleUnsupportedMessage = (raw) =>
  `Maple-Preview needs a Maple-capable browser runtime (the stock runtime has no 'maple' architecture). ` +
  `Official path: build the browser WASM from DeepGrove's official fork (github.com/deepgrove-ai/llama.cpp) ` +
  `with the wllama build scripts, then retry with its URL in wasmUrls. ` +
  `Weights stay the official deepgrove/maple-preview-GGUF file. Details: ${raw}`;

let instance = null;
let loadedKey = null;
let loadedThinking = null;

const destroyInstance = async () => {
  if (instance) {
    try { await instance.exit(); } catch { /* already gone */ }
  }
  instance = null;
  loadedKey = null;
  loadedThinking = null;
};

const modelKeyOf = (config) => `${config.repo}/${config.file}@ctx${config.n_ctx || 4096}`;

const ensureLoaded = async (config, onProgress) => {
  const { Wllama } = await loadWllama();
  const key = modelKeyOf(config);
  const thinking = !!config.enableThinking;
  if (instance && loadedKey === key && loadedThinking === thinking) return instance;
  if (instance) await destroyInstance();

  // Preflight: fail fast on deterministically-unsupported architectures
  // (verified: 'maple' has no backend in the stock runtime) instead of
  // burning a ~5GB download first. Probe failures are NON-FATAL so cached /
  // offline loads keep working with no network.
  try {
    onProgress(0, 'Checking model compatibility...');
  } catch { /* listener gone */ }
  try {
    const info = await probeGgufArch(config.repo, config.file, { origin: wllamaOrigin() });
    if (info && !info.skipped && info.arch) checkGgufArchSupported(info.arch);
  } catch (error) {
    if (error && /Maple-capable browser runtime/.test(String(error.message || ''))) throw error;
    // Probe unreachable (offline cache use, firewall) — continue to normal load.
  }

  const wasmUrl = await pickWasmUrl(
    Array.isArray(config.wasmUrls) && config.wasmUrls.length ? config.wasmUrls : defaultWasmUrls()
  );
  const wllama = new Wllama(
    { default: wasmUrl, 'wllama.wasm': wasmUrl },
    { allowOffline: true, parallelDownloads: 4 }
  );
  // Safari / older browsers fall back to compat WASM (slower); Firefox keeps
  // WebGPU disabled rather than the extremely-slow compat path.
  try { wllama.setCompat('default', 'safari'); } catch { /* older builds */ }

  const loadParams = {
    n_ctx: config.n_ctx || 4096,
    n_threads: config.n_threads,
    n_gpu_layers: config.n_gpu_layers,
    ...(thinking ? { default_template_kwargs: { enable_thinking: true } } : {}),
  };
  const downloadOpts = {
    progressCallback: ({ loaded, total }) => {
      const pct = total > 0 ? Math.max(0, Math.min(1, loaded / total)) : 0;
      try {
        onProgress(pct, total > 0 ? `${(loaded / 1e9).toFixed(2)} / ${(total / 1e9).toFixed(2)} GB` : 'Downloading...');
      } catch { /* listener gone */ }
    },
  };

  // Direct Hugging Face first (official file); same-origin proxy retry when a
  // firewall/VPN blocks huggingface.co or its XET CDN.
  const attempts = [{ repo: config.repo, file: config.file }];
  try {
    self.postMessage({ type: 'status', text: `Loading ${config.repo}...` });
    await wllama.loadModelFromHF(attempts[0], { ...loadParams, ...downloadOpts });
  } catch (directError) {
    const msg = String(directError?.message || directError || '');
    const looksNetwork = /failed to fetch|fetch failed|network|load failed|HTTP [45]\d\d|CORS|redirect/i.test(msg);
    if (!looksNetwork || instance) throw directError;
    try { await wllama.exit(); } catch { /* ignore */ }
    const proxyBase = `${wllamaOrigin()}/api/proxy/hf`;
    self.postMessage({ type: 'status', text: 'Direct download blocked, retrying through app proxy...' });
    const wllama2 = new Wllama(
      { default: wasmUrl, 'wllama.wasm': wasmUrl },
      { allowOffline: true, parallelDownloads: 4 }
    );
    try { wllama2.setCompat('default', 'safari'); } catch { /* ignore */ }
    const proxied = `${proxyBase}/${config.repo}/resolve/main/${config.file}`;
    await wllama2.loadModelFromUrl({ url: proxied }, { ...loadParams, ...downloadOpts });
    instance = wllama2;
    loadedKey = key;
    loadedThinking = thinking;
    return instance;
  }
  instance = wllama;
  loadedKey = key;
  loadedThinking = thinking;
  return instance;
};

self.onmessage = async (event) => {
  const { type, requestId } = event.data || {};
  const post = (msg) => self.postMessage({ ...msg, requestId });
  try {
    if (type === 'init') {
      const config = event.data.config || {};
      if (!config.repo || !config.file) throw new Error('GGUF init needs config.repo + config.file (official Hugging Face GGUF)');
      post({ type: 'status', text: `Preparing ${config.repo}...` });
      await ensureLoaded(config, (progress, text) => post({ type: 'progress', progress, text }));
      post({ type: 'progress', progress: 1, text: 'Download complete' });
      post({ type: 'ready', model: `${config.repo}/${config.file}`, requestId });
      return;
    }

    if (type === 'unload') {
      await destroyInstance();
      post({ type: 'cache-cleared', requestId });
      return;
    }

    if (type === 'clear-cache') {
      try {
        const { Wllama } = await loadWllama();
        const tmp = new Wllama({ default: await pickWasmUrl(defaultWasmUrls()) }, { allowOffline: true });
        const target = event.data.config?.file || '';
        if (target && tmp.cacheManager?.delete) {
          try { await tmp.cacheManager.delete(target); } catch { /* best effort */ }
        } else if (tmp.cacheManager?.clear) {
          // No filename given: only clear entries for this repo prefix is unsupported, so skip global clear.
        }
      } catch { /* best effort */ }
      await destroyInstance();
      post({ type: 'cache-cleared', requestId });
      return;
    }

    if (type === 'generate') {
      const config = event.data.config || {};
      if (!config.repo || !config.file) throw new Error('GGUF model is not initialized yet.');
      const wllama = await ensureLoaded(config, (progress, text) => post({ type: 'progress', progress, text }));
      const history = Array.isArray(event.data.history) ? event.data.history : [];
      const sysPrefix = event.data.systemPrompt
        ? `[Instructions]\n${event.data.systemPrompt}\n[/Instructions]`
        : null;
      const prompt = String(event.data.prompt ?? '');
      const messages = canonicalizeChatMessages(
        history,
        sysPrefix ? `${sysPrefix}\n\n${prompt}` : prompt
      );
      // Strict templates raise on any role violation — verify the exact
      // array bound for the chat template.
      assertAlternatingChatMessages(messages);

      const stream = await wllama.createChatCompletion({
        messages,
        max_tokens: event.data.maxTokens || 512,
        temperature: typeof config.temperature === 'number' ? config.temperature : 1.0,
        top_p: typeof config.top_p === 'number' ? config.top_p : 0.95,
        stream: true,
      });
      let full = '';
      for await (const chunk of stream) {
        const delta = chunk?.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          post({ type: 'token', text: delta });
        }
      }
      post({ type: 'result', text: full.trim() || 'No response generated.' });
      return;
    }

    throw new Error(`Unknown GGUF worker message: ${type}`);
  } catch (error) {
    const raw = error?.message || String(error || 'GGUF worker error');
    if (isMapleArchError(error)) {
      post({ type: 'error', error: mapleUnsupportedMessage(raw) });
      return;
    }
    if (/failed to fetch|Failed to fetch/i.test(raw)) {
      post({
        type: 'error',
        error: 'Network error: Failed to fetch GGUF model/runtime files. The model downloads once (~5GB) then runs offline from browser cache. Check your connection and ensure huggingface.co is reachable (or use the app proxy).',
      });
      return;
    }
    post({ type: 'error', error: raw });
  }
};
