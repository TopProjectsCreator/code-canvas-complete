/**
 * Shared chat-role canonicalization for ALL offline backends.
 *
 * Strict chat templates (notably Gemma's, enforced both by transformers.js
 * and llama.cpp's minja renderer) raise:
 *   "Conversation roles must alternate user/assistant/user/assistant/..."
 * unless the turn list strictly alternates starting with 'user'
 * (an optional single leading 'system' turn is tolerated by some templates).
 *
 * Histories assembled on the main thread can transiently violate this:
 * aborted generations leave empty assistant turns, error paths replace
 * content, retries append tool turns, and custom roles ('system'/'tool')
 * can appear. Every backend must pass its EXACT template-bound array
 * through canonicalizeChatTurns() as the last step before inference.
 *
 * Plain dependency-free JS so it can be imported by Web Workers
 * (relative URL), the Vite bundle, and vitest alike.
 */

const coerceRole = (role) => (role === 'assistant' ? 'assistant' : 'user');

/**
 * Normalizes raw history turns: coerces unknown roles to 'user', drops
 * empty/whitespace-only turns, merges consecutive same-role turns, and
 * strips leading assistant turns. Output alternates starting with 'user'.
 */
export const normalizeChatTurns = (turns) => {
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

/**
 * Final safety net applied to the EXACT array handed to a chat template or
 * text-generation pipeline. Idempotent: well-formed input passes through
 * with identical roles (only fresh objects are returned).
 *
 * @param messages array of {role, ...} about to be sent to the template
 * @param appendUserText text for the trailing user turn; when non-empty it is
 *   appended to (or starts) the final user turn so the list always ends with
 *   a non-empty user turn.
 */
export const canonicalizeChatMessages = (messages, appendUserText = '') => {
  const turns = normalizeChatTurns(messages);
  const text = appendUserText === undefined || appendUserText === null ? '' : String(appendUserText);
  if (text.trim()) {
    const last = turns[turns.length - 1];
    if (last && last.role === 'user') last.content += `\n\n${text}`;
    else turns.push({ role: 'user', content: text });
  }
  return turns;
};

/**
 * Throws a descriptive error (including the role sequence) when messages
 * would trip strict templates. Workers call this right before inference so
 * any future regression surfaces as a diagnosable bug instead of a cryptic
 * template exception.
 */
export const assertAlternatingChatMessages = (messages) => {
  const roles = (Array.isArray(messages) ? messages : []).map(m => m?.role);
  for (let i = 0; i < roles.length; i++) {
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (roles[i] !== expected) {
      throw new Error(
        `Non-alternating chat roles [${roles.join(', ')}] at index ${i} (expected '${expected}'). ` +
        `This is an app bug — histories must be canonicalized before inference.`
      );
    }
  }
  return true;
};

/**
 * GGUF preflight: verified-unsupported architectures fail FAST with an
 * actionable error instead of burning a ~5GB download first.
 *
 * The pinned stock runtime (wllama 3.6.1) has no 'maple' model backend, so
 * official deepgrove/maple-preview-GGUF files can never load on it — the
 * failure is deterministic and must surface in milliseconds, not after
 * gigabytes. Unknown architectures are NOT blocked: the runtime surfaces
 * their real errors at load time.
 */
export const GGUF_ARCH_PREFLIGHT_BLOCKED = {
  maple: `Maple-Preview needs a Maple-capable browser runtime (this runtime has no 'maple' model backend). ` +
    `Official path: build the browser WASM from DeepGrove's official fork (github.com/deepgrove-ai/llama.cpp) ` +
    `with the wllama build scripts, then retry with its URL in wasmUrls. ` +
    `Weights stay the official deepgrove/maple-preview-GGUF file — nothing was downloaded.`,
};

const GGUF_TYPE_SIZES = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 1, 11: 8, 12: 8 };

/** Minimal GGUF header reader: magic + general.architecture (+name/license when present). */
export const parseGgufHeaderBytes = (buffer) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 24) throw new Error('GGUF header too small');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'GGUF') throw new Error('Not a GGUF file (bad magic)');
  const text = new TextDecoder();
  let off = 24;
  const out = { arch: '' };
  const kvTotal = Number(view.getBigUint64(16, true));
  const maxPairs = Math.min(Number.isFinite(kvTotal) ? kvTotal : 80, 80);
  for (let i = 0; i < maxPairs; i++) {
    if (off + 12 > bytes.length) break;
    const klen = Number(view.getBigUint64(off, true)); off += 8;
    if (!Number.isFinite(klen) || klen > 256 || off + klen + 4 > bytes.length) break;
    const key = text.decode(bytes.subarray(off, off + klen)); off += klen;
    const vtype = view.getUint32(off, true); off += 4;
    if (vtype === 8) {
      if (off + 8 > bytes.length) break;
      const vlen = Number(view.getBigUint64(off, true)); off += 8;
      if (!Number.isFinite(vlen) || vlen > 512 || off + vlen > bytes.length) break;
      const value = text.decode(bytes.subarray(off, off + vlen)); off += vlen;
      if (key === 'general.architecture') out.arch = value;
      else if (key === 'general.name') out.name = value;
      else if (key === 'general.license') out.license = value;
    } else if (vtype in GGUF_TYPE_SIZES) {
      off += GGUF_TYPE_SIZES[vtype];
    } else if (vtype === 9) {
      if (off + 12 > bytes.length) break;
      const etype = view.getUint32(off, true); off += 4;
      const alen = Number(view.getBigUint64(off, true)); off += 8;
      if (etype === 8) break;
      const esize = GGUF_TYPE_SIZES[etype];
      if (esize === undefined || !Number.isFinite(alen) || alen > 64) break;
      off += esize * alen;
    } else {
      break;
    }
    if (out.arch && out.name && out.license) break;
  }
  if (!out.arch) throw new Error('GGUF architecture not found in header');
  return out;
};

export const checkGgufArchSupported = (arch) => {
  if (arch && GGUF_ARCH_PREFLIGHT_BLOCKED[arch]) {
    throw new Error(GGUF_ARCH_PREFLIGHT_BLOCKED[arch]);
  }
  return true;
};

/**
 * Fetches only the first 64KB of a GGUF file and returns its header info.
 * fetchImpl/origin are injectable for tests. Direct Hugging Face first,
 * same-origin app proxy as fallback (firewalled networks).
 */
export const probeGgufArch = async (repo, file, { fetchImpl = fetch, origin = '' } = {}) => {
  const urls = [
    `https://huggingface.co/${repo}/resolve/main/${file}`,
    ...(origin ? [`${origin}/api/proxy/hf/${repo}/resolve/main/${file}`] : []),
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { headers: { Range: 'bytes=0-65535' } });
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
      return parseGgufHeaderBytes(new Uint8Array(await res.arrayBuffer()));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('GGUF header probe failed');
};
