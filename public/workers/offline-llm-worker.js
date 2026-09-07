let pipelineFn = null;
let loadedProcessor = null;
let loadedModel = null;
let loadedKind = null;
// Shared role canonicalization (strict templates such as Gemma's raise
// "Conversation roles must alternate..." on any violation). Falls back to
// inline copies if the shared module is unreachable on a partial deploy.
let normalizeChatTurns;
let canonicalizeChatMessages;
let assertAlternatingChatMessages;
try {
  ({
    normalizeChatTurns,
    canonicalizeChatMessages,
    assertAlternatingChatMessages,
  } = await import('./chat-roles.js'));
} catch {
  const coerceRole = (role) => (role === 'assistant' ? 'assistant' : 'user');
  normalizeChatTurns = (turns) => {
    const out = [];
    for (const t of Array.isArray(turns) ? turns : []) {
      const role = coerceRole(t?.role);
      const content = String(t?.content ?? '').trim();
      if (!content) continue;
      const last = out[out.length - 1];
      if (last && last.role === role) last.content += '\n\n' + content;
      else out.push({ role, content });
    }
    while (out.length && out[0].role === 'assistant') out.shift();
    return out;
  };
  canonicalizeChatMessages = (messages, appendUserText = '') => {
    const turns = normalizeChatTurns(messages);
    const text = appendUserText === undefined || appendUserText === null ? '' : String(appendUserText);
    if (text.trim()) {
      const last = turns[turns.length - 1];
      if (last && last.role === 'user') last.content += `\n\n${text}`;
      else turns.push({ role: 'user', content: text });
    }
    return turns;
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
}
const normalizeTurns = (...args) => normalizeChatTurns(...args);
const HTML_RESPONSE_ERROR_RE = /Unexpected token '<'|"<!doctype "|<html/i;

const TRANSFORMERS_IMPORT_URLS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm',
  'https://unpkg.com/@huggingface/transformers@4.2.0?module',
  `${self.location.origin}/api/replit/proxy/jsdelivr/npm/@huggingface/transformers@4.2.0/+esm`,
  `${self.location.origin}/api/proxy/jsdelivr/npm/@huggingface/transformers@4.2.0/+esm`,
];

let transformersMod = null;
const loadTransformers = async () => {
  if (transformersMod?.pipeline) return transformersMod;
  let lastError = null;
  for (const url of TRANSFORMERS_IMPORT_URLS) {
    try {
      console.log(`[Worker] Attempting to load transformers from: ${url}`);
      const mod = await import(url);
      if (!mod?.pipeline) {
        throw new Error(`Invalid transformers module shape from ${url}`);
      }
      transformersMod = mod;
      return mod;
    } catch (error) {
      lastError = error;
      console.error(`[Worker] Failed to load from ${url}:`, error);
      try {
        const hostname = new URL(url).hostname;
        self.postMessage({ type: 'status', text: `Could not load runtime from ${hostname}, trying fallback...` });
      } catch {
        self.postMessage({ type: 'status', text: `Could not load runtime, trying fallback...` });
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

const detectKind = (modelId) => {
  if (/gemma-4/i.test(modelId)) return 'gemma4';
  if (/qwen3\.5/i.test(modelId)) return 'qwen35';
  return 'pipeline';
};

const QWEN35_DTYPES = { embed_tokens: 'q4', vision_encoder: 'fp16', decoder_model_merged: 'q4' };

/**
 * Same-origin mirror for Hugging Face files (see server /api/proxy/hf/*).
 * Lets firewalled/VPN networks load weights through the app instead of
 * reaching huggingface.co directly.
 */
const hfProxyOrigin = () => {
  try { return `${self.location.origin}/api/proxy/hf`; } catch { return null; }
};

const isFetchFailure = (error) => {
  const raw = String(error?.message || error || '');
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|HTTP [45]\d\d|\b401\b|\b403\b|\b404\b|unauthorized|gated/i.test(raw);
};

/**
 * Run a weights loader directly first (preserves behavior where the network
 * is open), then retry once through the app's own HF proxy. Non-network
 * errors (bad dtype, unsupported model class) are rethrown immediately so a
 * real configuration bug never triggers a pointless proxy retry.
 */
const withHfProxyRetry = async (label, loader) => {
  try {
    return { result: await loader(), via: 'direct' };
  } catch (directError) {
    if (!isFetchFailure(directError)) throw directError;
    const proxy = hfProxyOrigin();
    let runtime = null;
    try { runtime = await loadTransformers(); } catch { /* fall through to rethrow */ }
    const env = runtime?.env;
    if (!proxy || !env || typeof env.remoteHost === 'undefined') throw directError;
    const prevHost = env.remoteHost;
    self.postMessage({ type: 'status', text: `${label}: direct download blocked, retrying through app proxy...` });
    try {
      env.remoteHost = proxy;
      return { result: await loader(), via: 'proxy' };
    } catch (proxyError) {
      throw new Error(`${directError.message} | Proxy retry also failed: ${proxyError.message}`);
    } finally {
      try { env.remoteHost = prevHost; } catch { /* ignore */ }
    }
  }
};

const makeProgressCallback = () => (progress) => {
  const pct = typeof progress?.progress === 'number' ? Math.max(0, Math.min(1, progress.progress)) : 0;
  self.postMessage({ type: 'progress', progress: pct, text: progress?.file || progress?.status || 'Downloading...' });
};

const base64ToBlob = (b64, mime) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'image/png' });
};

/** Map local-model think tags onto the tags the app's parser already understands. */
const mapThinkTags = (text) =>
  text.replace(/<think>/gi, '<thinking_process>').replace(/<\/think>/gi, '</thinking_process>');

/**
 * Role normalization lives in ./chat-roles.js (shared with the GGUF worker
 * and unit-tested); normalizeTurns above is its alias. Strict templates such
 * as Gemma's raise "Conversation roles must alternate..." on violations, so
 * both generate paths canonicalize + assert the exact template-bound arrays.
 */

const loadPipelineModel = async (modelId, quant) => {
  const { pipeline } = await loadTransformers();
  const attempt = (device) => pipeline('text-generation', modelId, {
    dtype: quant,
    ...(device ? { device } : {}),
    progress_callback: makeProgressCallback(),
  });
  try {
    const { result, via } = await withHfProxyRetry('Loading model', () => attempt('webgpu'));
    self.postMessage({ type: 'status', text: `Model ready on WebGPU (${via})` });
    return { kind: 'pipeline', pipelineFn: result };
  } catch (webgpuError) {
    self.postMessage({ type: 'status', text: 'WebGPU not available, falling back to CPU/WASM...' });
    try {
      const { result, via } = await withHfProxyRetry('Loading model', () => attempt(undefined));
      self.postMessage({ type: 'status', text: `Model ready on CPU/WASM (${via})` });
      return { kind: 'pipeline', pipelineFn: result };
    } catch (fallbackError) {
      throw new Error(`WebGPU failed: ${webgpuError.message}. CPU fallback also failed: ${fallbackError.message}`);
    }
  }
};

const loadMultimodalModel = async (kind, modelId, quant) => {
  const t = await loadTransformers();
  const isGemma = kind === 'gemma4';
  const modelClass = isGemma ? t.Gemma4ForConditionalGeneration : t.Qwen3_5ForConditionalGeneration;
  if (!modelClass) throw new Error(`This runtime build lacks support for ${isGemma ? 'Gemma 4' : 'Qwen 3.5'} models.`);
  if (!t.AutoProcessor || !t.RawImage) throw new Error('Runtime build is missing multimodal primitives.');

  const dtype = isGemma ? quant : QWEN35_DTYPES;
  const load = async (device) => Promise.all([
    t.AutoProcessor.from_pretrained(modelId),
    modelClass.from_pretrained(modelId, { dtype, ...(device ? { device } : {}), progress_callback: makeProgressCallback() }),
  ]);

  let processor, model;
  try {
    const out = await withHfProxyRetry('Loading model', () => load('webgpu'));
    [processor, model] = out.result;
    self.postMessage({ type: 'status', text: `Model ready on WebGPU (${out.via})` });
  } catch (webgpuError) {
    self.postMessage({ type: 'status', text: 'WebGPU not available, falling back to CPU/WASM...' });
    try {
      const out = await withHfProxyRetry('Loading model', () => load(undefined));
      [processor, model] = out.result;
      self.postMessage({ type: 'status', text: `Model ready on CPU/WASM (${out.via})` });
    } catch (fallbackError) {
      throw new Error(`WebGPU failed: ${webgpuError.message}. CPU fallback also failed: ${fallbackError.message}`);
    }
  }
  return { kind, processor, model };
};

const extractPipelineText = (output) => {
  const generated = output?.[0]?.generated_text;
  return Array.isArray(generated)
    ? generated.filter(m => m.role === 'assistant').map(m => m.content).join('\n') || generated.at(-1)?.content || ''
    : typeof generated === 'string' ? '' : '';
};

self.onmessage = async (event) => {
  const { type, model, prompt, images, audio, enableThinking, requestId } = event.data || {};
  try {
    if (type === 'init') {
      const [modelId, quant = 'q4f16'] = String(model || '').split('@');
      self.postMessage({ type: 'status', text: `Preparing ${modelId} (${quant})...` });
      const kind = detectKind(modelId);
      self.postMessage({ type: 'status', text: `Downloading ${modelId}...` });

      let loaded;
      if (kind === 'pipeline') {
        loaded = await loadPipelineModel(modelId, quant);
        pipelineFn = loaded.pipelineFn;
      } else {
        loaded = await loadMultimodalModel(kind, modelId, quant);
        loadedProcessor = loaded.processor;
        loadedModel = loaded.model;
        pipelineFn = null;
      }
      loadedKind = kind;

      self.postMessage({ type: 'progress', progress: 1, text: 'Download complete' });
      self.postMessage({ type: 'ready', model: `${modelId}@${quant}`, requestId });
      return;
    }

    if (type === 'clear-cache') {
      const [modelId] = String(model || '').split('@');
      const { ModelRegistry } = await loadTransformers();
      if (!ModelRegistry?.clear_pipeline_cache) throw new Error('Runtime build cannot clear caches.');
      await ModelRegistry.clear_pipeline_cache('text-generation', modelId);
      self.postMessage({ type: 'cache-cleared', requestId });
      return;
    }

    if (type === 'generate') {
      if (loadedKind === 'pipeline' && !pipelineFn) throw new Error('Offline model is not initialized yet.');
      if (loadedKind !== 'pipeline' && !loadedModel) throw new Error('Offline model is not initialized yet.');
      const thinking = !!enableThinking;
      const systemPrompt = event.data.systemPrompt || null;
      const history = Array.isArray(event.data.history) ? event.data.history : [];

      const streamer = new (await loadTransformers()).TextStreamer(
        loadedKind === 'pipeline' ? pipelineFn.tokenizer : loadedProcessor.tokenizer,
        {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (delta) => {
            if (delta) self.postMessage({ type: 'token', text: delta, requestId });
          },
        }
      );

      let text = '';
      // System instructions ride inside the first user turn: several local
      // template families (e.g. Gemma) reject a dedicated 'system' role.
      const sysPrefix = systemPrompt ? `[Instructions]\n${systemPrompt}\n[/Instructions]` : null;
      if (loadedKind === 'pipeline') {
        const messages = canonicalizeChatMessages(
          history,
          `${sysPrefix ? `${sysPrefix}\n\n` : ''}${prompt}`
        );
        assertAlternatingChatMessages(messages);
        const output = await pipelineFn(messages, {
          max_new_tokens: 350,
          temperature: 0.7,
          do_sample: true,
          streamer,
        });
        text = extractPipelineText(output);
      } else {
        const contentParts = [];
        for (const img of Array.isArray(images) ? images : []) {
          if (img?.base64) contentParts.push({ type: 'image' });
        }
        if (audio) contentParts.push({ type: 'audio' });

        const conversation = [];
        for (const t of normalizeTurns(history)) {
          let turnText = t.content;
          if (sysPrefix && conversation.length === 0) turnText = `${sysPrefix}\n\n${turnText}`;
          conversation.push({ role: t.role, content: [{ type: 'text', text: turnText }] });
        }
        const userText = sysPrefix && conversation.length === 0 ? `${sysPrefix}\n\n${prompt}` : prompt;
        contentParts.push({ type: 'text', text: userText });
        if (conversation.length && conversation[conversation.length - 1].role === 'user') {
          conversation[conversation.length - 1].content.push(...contentParts);
        } else {
          conversation.push({ role: 'user', content: contentParts });
        }
        // Strict templates (Gemma family) raise on any role violation — verify
        // the exact array bound for the template.
        assertAlternatingChatMessages(conversation);

        const promptText = loadedProcessor.apply_chat_template(conversation, {
          add_generation_prompt: true,
          enable_thinking: thinking,
          tokenize: false,
        });

        const rawImages = [];
        const { RawImage } = await loadTransformers();
        for (const img of Array.isArray(images) ? images : []) {
          if (!img?.base64) continue;
          const blob = base64ToBlob(img.base64, img.mime);
          rawImages.push(await (await RawImage.fromBlob(blob)).resize(448, 448));
        }

        const inputs = await loadedProcessor(
          promptText,
          rawImages.length ? rawImages : null,
          audio instanceof Float32Array && audio.length ? audio : undefined,
          { add_special_tokens: false }
        );
        const outputs = await loadedModel.generate({
          ...inputs,
          max_new_tokens: thinking ? 900 : 350,
          do_sample: true,
          temperature: 0.7,
          top_p: 0.9,
          streamer,
        });
        const promptLen = inputs.input_ids.dims.at(-1);
        const sliced = typeof outputs.slice === 'function'
          ? outputs.slice(null, [promptLen, null])
          : outputs;
        text = loadedProcessor.batch_decode(sliced, { skip_special_tokens: true })[0] || '';
      }

      text = mapThinkTags(String(text).trim());
      self.postMessage({ type: 'result', text: text || 'No response generated.', requestId });
      return;
    }
  } catch (error) {
    const reason = normalizeOfflineError(error);
    if (/Failed to fetch/i.test(reason) || (/fetch/i.test(reason) && /network|failed|error|load/i.test(reason))) {
      self.postMessage({
        type: 'error',
        error:
          'Network error: Failed to fetch model/runtime files. This IDE runs models locally in your browser, but it must download them first. Please check your internet connection and ensure jsdelivr.net and huggingface.co are not blocked by a firewall or VPN.',
        requestId
      });
      return;
    }
    self.postMessage({ type: 'error', error: reason, requestId });
  }
};
