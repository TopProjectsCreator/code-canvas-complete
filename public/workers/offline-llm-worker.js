let pipeline = null;
const HTML_RESPONSE_ERROR_RE = /Unexpected token '<'|"<!doctype "|<html/i;
const HF_REMOTE_CONFIGS = [
  // Try direct from Hugging Face first (works when browser can reach HF)
  { host: 'https://huggingface.co/', path: '{model}/resolve/{revision}' },
  // Fall back to same-origin proxy bridge
  { host: null, path: 'api/replit/proxy/hf/{model}/resolve/{revision}' },
  { host: null, path: 'api/proxy/hf/{model}/resolve/{revision}' },
];

const TRANSFORMERS_IMPORT_URLS = [
  `${self.location.origin}/api/replit/proxy/jsdelivr/npm/@xenova/transformers@2.17.2/+esm`,
  `${self.location.origin}/api/proxy/jsdelivr/npm/@xenova/transformers@2.17.2/+esm`,
  `${self.location.origin}/api/replit/proxy/unpkg/@xenova/transformers@2.17.2?module`,
  `${self.location.origin}/api/proxy/unpkg/@xenova/transformers@2.17.2?module`
];

const loadTransformers = async () => {
  let lastError = null;
  for (const url of TRANSFORMERS_IMPORT_URLS) {
    try {
      console.log(`[Worker] Attempting to load transformers from: ${url}`);
      const mod = await import(url);
      if (!mod?.pipeline || !mod?.env) {
        throw new Error(`Invalid transformers module shape from ${url}`);
      }
      return mod;
    } catch (error) {
      lastError = error;
      console.error(`[Worker] Failed to load from ${url}:`, error);
      try {
        const hostname = new URL(url).hostname;
        self.postMessage({
          type: 'status',
          text: `Could not load runtime from ${hostname}, trying fallback...`
        });
      } catch {
        self.postMessage({
          type: 'status',
          text: `Could not load runtime from local proxy, trying fallback...`
        });
      }
    }
  }
  throw lastError || new Error('Unable to load transformers runtime');
};

const normalizeOfflineError = (error) => {
  const raw = error?.message || String(error || 'Worker error');
  if (/is not defined/.test(raw)) {
    return 'Offline runtime module failed to initialize in this browser context. Retrying with bridge-compatible module endpoints may help; please try downloading the model again.';
  }
  if (HTML_RESPONSE_ERROR_RE.test(raw)) {
    return 'Offline runtime request returned HTML instead of JavaScript/JSON. This usually means a proxy, ad-blocker, VPN, or firewall rewrote the model request. Disable content filtering for this site and allow jsdelivr.net, unpkg.com, and huggingface.co.';
  }
  if (/unauthorized|403|401|gated|invalid username|access denied|password/i.test(raw)) {
    return `Hugging Face download rejected — all Hugging Face downloads now require authentication (even public models). Ask your deployment admin to set the HF_TOKEN environment variable, or try a different model.\n\nDetails: ${raw}`;
  }
  return raw;
};

self.onmessage = async (event) => {
  const { type, model, prompt } = event.data || {};
  try {
    if (type === 'init') {
      const [modelId, quant = 'q4'] = String(model || '').split('@');
      self.postMessage({ type: 'status', text: `Preparing ${modelId} (${quant})...` });
      
      const transformers = await loadTransformers();
      const { pipeline: createPipeline, env } = transformers;
      
      console.log('[Worker] Transformers loaded. Configuring environment...');
      
      const origin = self.location.origin;
      const originUrl = origin.endsWith('/') ? origin : `${origin}/`;
      env.allowLocalModels = false;
      
      let lastInitError = null;
      for (const config of HF_REMOTE_CONFIGS) {
        try {
          env.remoteHost = config.host || originUrl;
          env.remotePathTemplate = config.path;
          const label = config.host ? 'Hugging Face' : config.path.includes('/replit/') ? 'server bridge' : 'proxy fallback';
          self.postMessage({ type: 'status', text: `Downloading model via ${label}...` });
          pipeline = await createPipeline('text-generation', modelId, {
            dtype: quant === 'fp16' ? 'fp16' : quant === 'q8' ? 'q8' : 'q4',
            progress_callback: (progress) => {
              const pct = typeof progress?.progress === 'number' ? Math.max(0, Math.min(1, progress.progress)) : 0;
              self.postMessage({ type: 'progress', progress: pct, text: progress?.file || progress?.status || 'Downloading...' });
            }
          });
          break;
        } catch (err) {
          lastInitError = err;
          pipeline = null;
        }
      }
      if (!pipeline && lastInitError) throw lastInitError;
      self.postMessage({ type: 'progress', progress: 1, text: 'Download complete' });
      self.postMessage({ type: 'ready', model: `${modelId}@${quant}` });
      return;
    }

    if (type === 'generate') {
      if (!pipeline) throw new Error('Offline model is not initialized yet.');
      const output = await pipeline(prompt, { max_new_tokens: 180, temperature: 0.7, do_sample: true });
      const text = Array.isArray(output) ? output[0]?.generated_text || '' : output?.generated_text || '';
      self.postMessage({ type: 'result', text: text.replace(prompt, '').trim() || text.trim() });
      return;
    }
  } catch (error) {
    const reason = normalizeOfflineError(error);
    if (reason === 'Failed to fetch' || reason.includes('fetch')) {
      self.postMessage({
        type: 'error',
        error:
          'Network error: Failed to fetch model/runtime files. This IDE runs models locally in your browser, but it must download them first. Please check your internet connection and ensure jsdelivr.net, unpkg.com, and huggingface.co are not blocked by a firewall or VPN.'
      });
      return;
    }
    self.postMessage({ type: 'error', error: reason });
  }
};
