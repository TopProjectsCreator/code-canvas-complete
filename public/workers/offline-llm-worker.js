let pipelineFn = null;
const HTML_RESPONSE_ERROR_RE = /Unexpected token '<'|"<!doctype "|<html/i;

const TRANSFORMERS_IMPORT_URLS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm',
  'https://unpkg.com/@huggingface/transformers@4.2.0?module',
  `${self.location.origin}/api/replit/proxy/jsdelivr/npm/@huggingface/transformers@4.2.0/+esm`,
  `${self.location.origin}/api/proxy/jsdelivr/npm/@huggingface/transformers@4.2.0/+esm`,
];

const loadTransformers = async () => {
  let lastError = null;
  for (const url of TRANSFORMERS_IMPORT_URLS) {
    try {
      console.log(`[Worker] Attempting to load transformers from: ${url}`);
      const mod = await import(url);
      if (!mod?.pipeline) {
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
          text: `Could not load runtime, trying fallback...`
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
    return 'Offline runtime request returned HTML instead of JavaScript/JSON. This usually means a proxy, ad-blocker, VPN, or firewall rewrote the model request. Disable content filtering for this site and allow jsdelivr.net, huggingface.co.';
  }
  if (/unauthorized|403|401|gated|invalid username|access denied|password/i.test(raw)) {
    return `Hugging Face download rejected. Your deployment admin may need to set the HF_TOKEN environment variable, or the model may require authentication. Try a different model.\n\nDetails: ${raw}`;
  }
  return raw;
};

self.onmessage = async (event) => {
  const { type, model, prompt } = event.data || {};
  try {
    if (type === 'init') {
      const [modelId, quant = 'q4f16'] = String(model || '').split('@');
      self.postMessage({ type: 'status', text: `Preparing ${modelId} (${quant})...` });

      const transformers = await loadTransformers();
      const { pipeline } = transformers;

      self.postMessage({ type: 'status', text: `Downloading ${modelId}...` });

      pipelineFn = await pipeline('text-generation', modelId, {
        dtype: quant,
        device: 'webgpu',
        progress_callback: (progress) => {
          const pct = typeof progress?.progress === 'number' ? Math.max(0, Math.min(1, progress.progress)) : 0;
          self.postMessage({ type: 'progress', progress: pct, text: progress?.file || progress?.status || 'Downloading...' });
        },
      }).catch(async (webgpuError) => {
        self.postMessage({ type: 'status', text: 'WebGPU not available, falling back to CPU/WASM...' });
        try {
          return await pipeline('text-generation', modelId, {
            dtype: quant,
            progress_callback: (progress) => {
              const pct = typeof progress?.progress === 'number' ? Math.max(0, Math.min(1, progress.progress)) : 0;
              self.postMessage({ type: 'progress', progress: pct, text: progress?.file || progress?.status || 'Downloading...' });
            },
          });
        } catch (fallbackError) {
          throw new Error(`WebGPU failed: ${webgpuError.message}. CPU fallback also failed: ${fallbackError.message}`);
        }
      });

      self.postMessage({ type: 'progress', progress: 1, text: 'Download complete' });
      self.postMessage({ type: 'ready', model: `${modelId}@${quant}` });
      return;
    }

    if (type === 'generate') {
      if (!pipelineFn) throw new Error('Offline model is not initialized yet.');

      const messages = [{ role: 'user', content: prompt }];
      const output = await pipelineFn(messages, {
        max_new_tokens: 180,
        temperature: 0.7,
        do_sample: true,
      });

      const generated = output?.[0]?.generated_text;
      const text = Array.isArray(generated)
        ? generated.filter(m => m.role === 'assistant').map(m => m.content).join('\n') || generated.at(-1)?.content || ''
        : typeof generated === 'string' ? generated.replace(prompt, '').trim() : '';

      self.postMessage({ type: 'result', text: text.trim() || 'No response generated.' });
      return;
    }
  } catch (error) {
    const reason = normalizeOfflineError(error);
    if (/Failed to fetch/i.test(reason) || (/fetch/i.test(reason) && /network|failed|error|load/i.test(reason))) {
      self.postMessage({
        type: 'error',
        error:
          'Network error: Failed to fetch model/runtime files. This IDE runs models locally in your browser, but it must download them first. Please check your internet connection and ensure jsdelivr.net and huggingface.co are not blocked by a firewall or VPN.'
      });
      return;
    }
    self.postMessage({ type: 'error', error: reason });
  }
};
