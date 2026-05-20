let pipeline = null;

const TRANSFORMERS_IMPORT_URLS = [
  `${self.location.origin}/api/proxy/jsdelivr/npm/@xenova/transformers@2.17.2`,
  `${self.location.origin}/api/proxy/unpkg/@xenova/transformers@2.17.2`,
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',
  'https://unpkg.com/@xenova/transformers@2.17.2'
];

const loadTransformers = async () => {
  let lastError = null;
  for (const url of TRANSFORMERS_IMPORT_URLS) {
    try {
      console.log(`[Worker] Attempting to load transformers from: ${url}`);
      return await import(url);
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

self.onmessage = async (event) => {
  const { type, model, prompt } = event.data || {};
  try {
    if (type === 'init') {
      const [modelId, quant = 'q4'] = String(model || '').split('@');
      self.postMessage({ type: 'status', text: `Preparing ${modelId} (${quant})...` });
      
      const transformers = await loadTransformers();
      const { pipeline: createPipeline, env } = transformers;
      
      console.log('[Worker] Transformers loaded. Configuring environment...');
      
      // Configure env to use our local proxy for model files
      const origin = self.location.origin;
      env.allowLocalModels = false;
      env.remoteHost = origin.endsWith('/') ? origin : `${origin}/`;
      env.remotePathTemplate = 'api/proxy/hf/{model}/resolve/{revision}/{file}';
      
      console.log(`[Worker] env.remoteHost set to: ${env.remoteHost}`);
      console.log(`[Worker] env.remotePathTemplate set to: ${env.remotePathTemplate}`);
      
      pipeline = await createPipeline('text-generation', modelId, {
        dtype: quant === 'fp16' ? 'fp16' : quant === 'q8' ? 'q8' : 'q4',
        progress_callback: (progress) => {
          const pct = typeof progress?.progress === 'number' ? Math.max(0, Math.min(1, progress.progress)) : 0;
          self.postMessage({ type: 'progress', progress: pct, text: progress?.file || progress?.status || 'Downloading...' });
        }
      });
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
    const reason = error?.message || 'Worker error';
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
