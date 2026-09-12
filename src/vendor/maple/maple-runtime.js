import { Template } from "@huggingface/jinja";
import { Tokenizer } from "@huggingface/tokenizers";
import {
  buildKernels, KV_FORMATS, HIDDEN, VOCAB, NUM_LAYERS, HEADS, KV_HEADS, HEAD_DIM, KV, GQA,
  EXPERTS, TOPK, EDIM, WINDOW, MAX_CHUNKS, SAMPLE_WG,
} from "./kernels.js";

export { KV_FORMATS };

export const PRIMARY_MODEL = "deepgrove/maple-preview";
export const WEIGHT_PACK = "ProCreations/maple-preview-webgpu";
export const WEIGHT_REVISION = "main";
const DEFAULT_WEIGHT_BASE = `https://huggingface.co/${WEIGHT_PACK}/resolve/${WEIGHT_REVISION}`;

// A local pack can be pointed at with ?weights=http://localhost:8787 during
// development. Restricted to loopback so a link cannot aim a visitor's browser
// at someone else's weights.
function weightBase() {
  if (typeof location === "undefined") return DEFAULT_WEIGHT_BASE;
  const override = new URLSearchParams(location.search).get("weights");
  if (!override) return DEFAULT_WEIGHT_BASE;
  try {
    const host = new URL(override).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return override;
  } catch { /* fall through to the published pack */ }
  return DEFAULT_WEIGHT_BASE;
}

export const WEIGHT_BASE = weightBase();

// Matches the default the webml-community bonsai Space uses. Every extra token of
// context costs 24 layers x 512 kv dims x 4 bytes x 2 (keys and values) = 96 KiB,
// so the ceiling is a memory decision, not a model one.
export const CONTEXT_CHOICES = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];
export function contextBytesPerToken(kvFormat = "f32") {
  const format = KV_FORMATS[kvFormat] ?? KV_FORMATS.f32;
  return NUM_LAYERS * KV * format.bytes * 2 + (format.scales ? NUM_LAYERS * KV_HEADS * 2 * 4 : 0);
}
export const CONTEXT_BYTES_PER_TOKEN = contextBytesPerToken("f32");
export const MODEL_MAX_CONTEXT = 131072;

// The largest window whose per-layer key/value buffers this adapter can bind.
export function maxContextFor(adapter) {
  const limits = adapter?.limits;
  if (!limits) return DEFAULT_CONTEXT;
  const cap = Math.min(limits.maxBufferSize ?? 0, limits.maxStorageBufferBindingSize ?? 0, 536_870_912);
  const byBuffer = Math.floor(cap / (KV * 4));
  return Math.max(1024, Math.min(MODEL_MAX_CONTEXT, byBuffer));
}
const DEFAULT_CONTEXT = 4096;
const LOAD_CONCURRENCY = 6;
// Each in-flight file is buffered whole before upload, so concurrency is also a
// peak-host-memory dial. Phones and small integrated GPUs get a smaller one.
const LOAD_CONCURRENCY_LIMITED = 2;
export const CHECKPOINT_BYTES = 5.31e9;

export function isMobile() {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgentData?.mobile) return true;
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent || "");
}
const EOS_TOKEN_IDS = new Set([151645, 151643]);
const REQUIRED_MODEL_BUFFER = 160_000_000;
const REQUIRED_WORKGROUP_STORAGE = 20_608; // split-K attention on the portable path
const STEP_STRIDE = 256; // minUniformBufferOffsetAlignment
const DECODE_BATCH = 4; // decode steps queued per GPU round trip
const DECODE_WINDOW = 24; // trailing tokens re-decoded to derive each text delta
const STORAGE_COPY = () => GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;

// BF16 tables that stay packed on the GPU and widen in-shader. Keeping these as
// bf16 is bit-exact and removes ~45 MB of reads per token versus expanding to f32.
const KEEP_PACKED = /(\.mlp\.gate\.weight|lm_head\.(scales|biases)|word_embeddings\.(scales|biases))$/;

async function fetchRequired(url, signal) {
  const response = await fetch(url, { signal, cache: "force-cache", credentials: "omit" });
  if (!response.ok) throw new Error(`Tokenizer asset request failed (${response.status})`);
  return response;
}

async function loadMapleTokenizer(signal, onProgress) {
  onProgress?.({ phase: "LOADING TOKENIZER", loaded: 0, total: 1 });
  const base = `https://huggingface.co/${PRIMARY_MODEL}/resolve/main`;
  const [tokenizerJson, tokenizerConfig, chatSource] = await Promise.all([
    fetchRequired(`${base}/tokenizer.json`, signal).then((r) => r.json()),
    fetchRequired(`${base}/tokenizer_config.json`, signal).then((r) => r.json()),
    fetchRequired(`${base}/chat_template.jinja`, signal).then((r) => r.text()),
  ]);
  const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  const template = new Template(chatSource);
  return {
    encode: (text, options) => tokenizer.encode(text, options),
    decode: (ids, options) => tokenizer.decode(ids, options),
    apply_chat_template(messages, options = {}) {
      const rendered = template.render({
        messages,
        tools: null,
        bos_token: tokenizerConfig.bos_token,
        eos_token: tokenizerConfig.eos_token,
        add_generation_prompt: options.add_generation_prompt ?? true,
      });
      return options.tokenize === false
        ? rendered
        : tokenizer.encode(rendered, { add_special_tokens: false }).ids;
    },
  };
}

function align4(value) {
  return Math.max(4, (value + 3) & ~3);
}

// Hand the main thread back so the loader can paint. requestAnimationFrame alone
// is not enough: a backgrounded tab stops firing it entirely, which would stall a
// 5.31 GB load the moment someone switches away. Whichever fires first wins.
function nextFrame(timeout = 60) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, timeout);
  });
}

function formatAdapter(adapter) {
  const info = adapter?.info ?? adapter?.adapterInfo ?? {};
  return [info.vendor, info.architecture || info.device].filter(Boolean).join(" · ") || "WebGPU adapter";
}

function supportsSubgroups(adapter) {
  // ?portable forces the fallback path, for comparing the two on one machine.
  if (typeof location !== "undefined" && new URLSearchParams(location.search).has("portable")) return false;
  const info = adapter?.info ?? adapter?.adapterInfo ?? {};
  // One output row maps onto a 32-lane team, reduced with a shuffle butterfly that
  // stays inside each aligned 32-lane group. That is correct for any subgroup at
  // least 32 wide, so 64-wide AMD parts get the fast path too; only narrower
  // subgroups (some Intel) still have to fall back.
  return Boolean(adapter?.features?.has("subgroups")) && (info.subgroupMinSize ?? 0) >= 32;
}

function deviceDescriptor(adapter) {
  const limits = adapter.limits;
  return {
    requiredFeatures: supportsSubgroups(adapter) ? ["subgroups"] : [],
    requiredLimits: {
      // One KV buffer is context * 512 dims * 4 bytes, so a 131,072-token window
      // needs 256 MiB bindings. Ask for headroom above that up front: the context
      // can be raised after loading, and the device's limits are fixed at creation.
      maxBufferSize: Math.min(limits.maxBufferSize, 536_870_912),
      maxStorageBufferBindingSize: Math.min(limits.maxStorageBufferBindingSize, 536_870_912),
      maxComputeWorkgroupStorageSize: Math.min(limits.maxComputeWorkgroupStorageSize, 32_768),
    },
    defaultQueue: { label: "Maple inference queue" },
  };
}

function buffer(device, byteLength, usage = STORAGE_COPY(), label = "") {
  return device.createBuffer({ size: align4(byteLength), usage, label });
}

function f32Buffer(device, count, label) {
  return buffer(device, count * 4, STORAGE_COPY(), label);
}

function u32Buffer(device, count, label) {
  return buffer(device, count * 4, STORAGE_COPY(), label);
}

// One layer's key or value cache, sized for the active format.
function kvCache(device, context, kvFormat, label) {
  const bytes = context * KV * KV_FORMATS[kvFormat].bytes;
  return buffer(device, bytes, STORAGE_COPY(), label);
}

function kvScaleBuffer(device, context, kvFormat, label) {
  const needed = KV_FORMATS[kvFormat].scales ? context * KV_HEADS * 2 * 4 : 4;
  return buffer(device, needed, STORAGE_COPY(), label);
}

function bf16ToF32(source, target) {
  for (let i = 0; i < source.length; i++) target[i] = source[i] << 16;
}

// Incremental detokenizer.
//
// Two things make this less trivial than it looks. Re-decoding the whole
// sequence every token is quadratic, so only a bounded tail is decoded. And a
// character can span several tokens: mid-sequence the decoder emits U+FFFD for
// the part it has so far, then resolves it on the next token. Emitting that
// placeholder and then diffing against it is what produced the stray glyph and
// the duplicated paragraph — the "does the new text still start with the old
// text" test fails at exactly that point, and the old code fell back to
// re-emitting everything. So incomplete trailing characters are held back until
// they resolve.
function makeStream(tokenizer, windowSize) {
  const decode = (ids) => tokenizer.decode(ids, { skip_special_tokens: false });
  const complete = (text) => text.replace(/�+$/, "");
  const ids = [];
  let from = 0;
  let emitted = 0; // characters of the current window already handed out

  return {
    push(token) {
      ids.push(token);
      const start = Math.max(0, ids.length - windowSize);
      if (start !== from) {
        // The window slid. Re-express how much has been emitted in terms of the
        // new window by decoding the same tokens under the new start.
        from = start;
        emitted = complete(decode(ids.slice(from, -1))).length;
      }
      const text = complete(decode(ids.slice(from)));
      if (text.length <= emitted) return "";
      const delta = text.slice(emitted);
      emitted = text.length;
      return delta;
    },
  };
}

// Bind group plumbing -------------------------------------------------------

function layoutFor(device, kinds, label) {
  return device.createBindGroupLayout({
    label,
    entries: kinds.map((kind, binding) => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer:
        kind === "uniform"
          ? { type: "uniform" }
          : { type: kind === "rw" ? "storage" : "read-only-storage" },
    })),
  });
}

function groupFor(device, layout, buffers, label = "") {
  return device.createBindGroup({
    layout,
    label,
    entries: buffers.map((item, binding) => ({ binding, resource: { buffer: item } })),
  });
}

// Signatures for each kernel's @group(1). 'ro' read-only storage, 'rw' storage,
// 'uniform' a plain uniform block.
const SIGNATURES = {
  addRmsNorm: ["rw", "ro", "ro", "rw"],
  embed: ["ro", "ro", "ro", "rw", "ro"],
  qkv: ["ro", "ro", "ro", "rw", "rw", "rw"],
  qkNormRope: ["rw", "ro", "ro", "ro", "rw"],
  qkNorm: ["rw", "ro", "ro", "ro", "rw"],
  attentionSliding: ["ro", "ro", "ro", "ro", "rw", "rw"],
  attentionFull: ["ro", "ro", "ro", "ro", "rw", "rw"],
  storeKV: ["ro", "ro", "rw", "rw", "rw"],
  combineSliding: ["ro", "ro", "rw"],
  combineFull: ["ro", "ro", "rw"],
  gemv2: ["ro", "ro", "ro", "rw"],
  router: ["ro", "ro", "rw"],
  routerTopK: ["ro", "rw", "rw"],
  expertUpGate: ["ro", "ro", "ro", "ro", "ro", "ro", "rw"],
  expertDown: ["ro", "ro", "ro", "ro", "ro", "rw"],
  lmHead: ["ro", "ro", "ro", "ro", "rw"],
  logitsMax: ["ro", "rw"],
  sampleScan: ["ro", "ro", "rw", "rw", "uniform"],
  sampleFinal: ["ro", "ro", "rw"],
};

// Weight streaming ----------------------------------------------------------

async function openCacheDirectory(revision) {
  try {
    if (!navigator.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    const packs = await root.getDirectoryHandle("maple-pack", { create: true });
    // Drop packs from other revisions so a model update cannot silently serve stale weights.
    for await (const name of packs.keys?.() ?? []) {
      if (name !== revision) await packs.removeEntry(name, { recursive: true }).catch(() => {});
    }
    return await packs.getDirectoryHandle(revision, { create: true });
  } catch {
    return null;
  }
}

class PackedWeights {
  constructor(device, manifest, { signal, onProgress, cacheDir }) {
    this.device = device;
    this.manifest = manifest;
    this.signal = signal;
    this.onProgress = onProgress;
    this.cacheDir = cacheDir;
    this.loaded = 0;
    this.fromCache = 0;
    this.total = Object.values(manifest.files).reduce((sum, file) => sum + file.size, 0);
    this.buffers = new Set();
  }

  cacheName(filename) {
    return filename.replace(/\//g, "_");
  }

  async readFromCache(filename, expectedSize) {
    if (!this.cacheDir) return null;
    try {
      const handle = await this.cacheDir.getFileHandle(this.cacheName(filename));
      const file = await handle.getFile();
      if (file.size !== expectedSize) return null;
      return file;
    } catch {
      return null;
    }
  }

  async fetchFile(filename, phase) {
    const file = this.manifest.files[filename];
    if (!file) throw new Error(`Weight pack is missing ${filename}`);
    const report = () =>
      this.onProgress?.({ phase, loaded: this.loaded, total: this.total, detail: filename });
    report();

    const cached = await this.readFromCache(filename, file.size);
    if (cached) {
      const data = await cached.arrayBuffer();
      this.loaded += data.byteLength;
      this.fromCache += data.byteLength;
      report();
      return data;
    }

    const response = await fetch(`${WEIGHT_BASE}/${filename}`, {
      signal: this.signal,
      cache: "force-cache",
      credentials: "omit",
    });
    if (!response.ok) throw new Error(`Could not download ${filename} (${response.status})`);

    const output = new Uint8Array(file.size);
    if (!response.body) {
      const data = await response.arrayBuffer();
      output.set(new Uint8Array(data));
      this.loaded += data.byteLength;
      report();
    } else {
      const reader = response.body.getReader();
      let offset = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (this.signal?.aborted) throw new DOMException("Model load cancelled", "AbortError");
        output.set(value, offset);
        offset += value.byteLength;
        this.loaded += value.byteLength;
        report();
      }
      if (offset !== file.size) throw new Error(`${filename} was truncated (${offset}/${file.size} bytes)`);
    }
    this.writeToCache(filename, output);
    await this.drainCache();
    return output.buffer;
  }

  // Persisting to OPFS runs alongside the download rather than blocking it, but
  // with a cap: each queued file pins its bytes in memory until written, and the
  // pack is 5.31 GB, so an unbounded queue would be a straightforward way to run
  // the tab out of memory.
  writeToCache(filename, bytes) {
    if (!this.cacheDir) return;
    this.cachePending = (this.cachePending ?? 0) + bytes.byteLength;
    const task = async () => {
      const handle = await this.cacheDir.getFileHandle(this.cacheName(filename), { create: true });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
    };
    this.cacheWrites = (this.cacheWrites ?? Promise.resolve())
      .then(task)
      .catch(() => { this.cacheDir = null; })
      .finally(() => { this.cachePending -= bytes.byteLength; });
  }

  async drainCache(limitBytes = 700_000_000) {
    while (this.cacheDir && (this.cachePending ?? 0) > limitBytes) {
      await this.cacheWrites;
    }
  }

  // Upload straight into a mapped buffer: no queue.writeBuffer staging copy and
  // no second full-size allocation.
  uploadTensor(fileData, name) {
    const meta = this.manifest.tensors[name];
    if (!meta) throw new Error(`Weight pack tensor not found: ${name}`);
    if (!["BF16", "U32", "I32", "F32"].includes(meta.dtype)) {
      throw new Error(`Unsupported tensor dtype ${meta.dtype} for ${name}`);
    }
    const expand = meta.dtype === "BF16" && !KEEP_PACKED.test(name);
    const targetBytes = expand ? meta.nbytes * 2 : meta.nbytes;
    const target = this.device.createBuffer({
      size: align4(targetBytes),
      usage: STORAGE_COPY(),
      label: name,
      mappedAtCreation: true,
    });
    this.buffers.add(target);
    const range = target.getMappedRange();
    if (expand) {
      bf16ToF32(new Uint16Array(fileData, meta.offset, meta.nbytes / 2), new Uint32Array(range));
    } else {
      new Uint8Array(range).set(new Uint8Array(fileData, meta.offset, meta.nbytes));
    }
    target.unmap();
    return target;
  }

  async loadGroup(filename, phase) {
    const data = await this.fetchFile(filename, phase);
    const result = {};
    for (const name of this.manifest.files[filename].tensors) result[name] = this.uploadTensor(data, name);
    return result;
  }

  destroy() {
    for (const item of this.buffers) item.destroy();
    this.buffers.clear();
  }
}

export class MapleRuntime {
  static async validateWeightPack({ layer = false } = {}) {
    const compatibility = await this.compatibility();
    if (!compatibility.supported) throw new Error(compatibility.reason);
    const response = await fetch(`${WEIGHT_BASE}/manifest.json`, { cache: "no-cache", credentials: "omit" });
    if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
    const manifest = await response.json();
    const device = await compatibility.adapter.requestDevice(deviceDescriptor(compatibility.adapter));
    const weights = new PackedWeights(device, manifest, {});
    try {
      const filename = layer ? "layers/layer-00.mwg" : "final-norm.mwg";
      const tensors = await weights.loadGroup(filename, "VALIDATING WEIGHT PACK");
      await device.queue.onSubmittedWorkDone();
      return {
        ok: true,
        revision: manifest.source_revision,
        files: Object.keys(manifest.files).length,
        tensors: Object.keys(tensors).length,
      };
    } finally {
      weights.destroy();
      device.destroy();
    }
  }

  static async validateKernels() {
    const compatibility = await this.compatibility();
    if (!compatibility.supported) throw new Error(compatibility.reason);
    const device = await compatibility.adapter.requestDevice(deviceDescriptor(compatibility.adapter));
    const runtime = new MapleRuntime(device, compatibility.adapter, DEFAULT_CONTEXT);
    try {
      await runtime.compilePipelines();
      return {
        ok: true,
        device: runtime.deviceLabel,
        kernels: Object.keys(runtime.pipelines).length,
        mode: runtime.useSubgroups ? "32-lane subgroups" : "portable",
      };
    } finally {
      runtime.destroy();
    }
  }

  static async compatibility() {
    const result = {
      webgpu: Boolean(navigator.gpu),
      secure: window.isSecureContext,
      memory: navigator.deviceMemory ?? null,
      adapter: null,
      adapterLabel: "Not available",
      supported: false,
      reason: "",
    };
    if (!result.secure) {
      result.reason = "WebGPU requires a secure HTTPS context.";
      return result;
    }
    if (!result.webgpu) {
      result.reason = "WebGPU is unavailable. Use a current Chrome, Edge, or Safari browser.";
      return result;
    }
    try {
      result.adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      result.adapterLabel = formatAdapter(result.adapter);
      if (!result.adapter) {
        result.reason = "No high-performance WebGPU adapter was found.";
        return result;
      }
      const limits = result.adapter.limits;
      result.limits = {
        maxBufferSize: limits.maxBufferSize,
        maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize,
      };
      result.mobile = isMobile();
      if (limits.maxStorageBufferBindingSize < REQUIRED_MODEL_BUFFER || limits.maxBufferSize < REQUIRED_MODEL_BUFFER) {
        result.reason = `This GPU can only bind ${Math.round(Math.min(limits.maxBufferSize, limits.maxStorageBufferBindingSize) / 1e6)} MB per buffer; Maple's embedding table alone needs 156 MB.`;
        return result;
      }
      if (limits.maxComputeWorkgroupStorageSize < REQUIRED_WORKGROUP_STORAGE) {
        result.reason = `This GPU offers ${Math.round(limits.maxComputeWorkgroupStorageSize / 1024)} KB of workgroup memory; Maple's attention kernel needs ${Math.ceil(REQUIRED_WORKGROUP_STORAGE / 1024)} KB.`;
        return result;
      }
      result.subgroups = supportsSubgroups(result.adapter);
      result.supported = true;
      // Nothing in WebGPU reports how much memory the GPU actually has, so this
      // is the honest statement of what the model needs rather than a prediction.
      if (result.mobile) {
        result.warning = "Maple needs about 5.7 GB of GPU memory. Phones and tablets almost never have that much available to a browser tab, and the tab is usually killed part-way through loading.";
      }
      return result;
    } catch (error) {
      result.reason = error?.message || "WebGPU adapter request failed.";
      return result;
    }
  }

  static async load({ signal, onProgress, maxContext = DEFAULT_CONTEXT, cache = true, kvFormat = "f32" } = {}) {
    const compatibility = await this.compatibility();
    if (!compatibility.supported) throw new Error(compatibility.reason);
    onProgress?.({ phase: "REQUESTING WEBGPU DEVICE", loaded: 0, total: 1 });
    const device = await compatibility.adapter.requestDevice(deviceDescriptor(compatibility.adapter));
    const runtime = new MapleRuntime(device, compatibility.adapter, Math.min(Math.max(512, maxContext), MODEL_MAX_CONTEXT), kvFormat);
    // A 5.31 GB checkpoint is the kind of allocation that gets refused rather
    // than merely being slow. Scope it so an out-of-memory surfaces as a clear
    // message instead of an opaque failure or a killed tab.
    device.pushErrorScope("out-of-memory");
    let oomScope = true;
    const checkMemory = async () => {
      if (!oomScope) return;
      oomScope = false;
      const error = await device.popErrorScope();
      if (error) {
        throw new Error("Ran out of GPU memory while loading Maple. Try a shorter context window, or a device with more GPU memory.");
      }
    };
    try {
      // Kernels compile while the manifest and tokenizer are in flight, and the
      // first weight byte is requested as soon as the manifest lands.
      const tokenizerPromise = loadMapleTokenizer(signal, onProgress);
      const manifestPromise = fetch(`${WEIGHT_BASE}/manifest.json`, {
        signal, cache: "no-cache", credentials: "omit",
      }).then(async (response) => {
        if (!response.ok) throw new Error(`WebGPU weight manifest is unavailable (${response.status})`);
        return response.json();
      });
      onProgress?.({ phase: "COMPILING WEBGPU KERNELS", loaded: 0, total: 1 });
      const [manifest] = await Promise.all([manifestPromise, runtime.compilePipelines()]);
      if (manifest.format !== "maple-webgpu-pack-v1") throw new Error("Unsupported Maple WebGPU weight pack");
      runtime.packRevision = manifest.source_revision;
      const cacheDir = cache ? await openCacheDirectory(String(manifest.source_revision)) : null;
      runtime.cacheEnabled = Boolean(cacheDir);
      runtime.weights = new PackedWeights(device, manifest, { signal, onProgress, cacheDir });
      runtime.allocateWorkspaces();
      await runtime.loadWeights(onProgress);
      runtime.tokenizer = await tokenizerPromise;
      await device.queue.onSubmittedWorkDone();
      await checkMemory();
      onProgress?.({ phase: "READY", loaded: runtime.weights.total, total: runtime.weights.total });
      return runtime;
    } catch (error) {
      await checkMemory().catch((oom) => { error = oom; });
      runtime.destroy();
      throw error;
    }
  }

  constructor(device, adapter, maxContext, kvFormat = "f32") {
    this.device = device;
    this.kvFormat = KV_FORMATS[kvFormat] ? kvFormat : "f32";
    this.adapter = adapter;
    this.maxContext = maxContext;
    this.useSubgroups = supportsSubgroups(adapter);
    this.lmHeadGroups = VOCAB / 32;
    this.layers = [];
    this.destroyed = false;
    this.deviceLabel = formatAdapter(adapter);
    this.sampling = { temperature: 0, minP: 0 };
    this.resident = [];   // token ids currently mirrored in the GPU token buffer
    this.residentRun = 0; // how many of those positions have a valid KV entry
    this.salt = (Math.random() * 0xffffffff) >>> 0;
    this.device.lost.then((info) => {
      if (!this.destroyed) console.error("Maple WebGPU device lost", info);
    });
  }

  async compilePipelines() {
    const kernels = buildKernels({ subgroups: this.useSubgroups, kvFormat: this.kvFormat });
    const d = this.device;
    this.stepLayout = d.createBindGroupLayout({
      label: "step",
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 16 },
      }],
    });
    this.layouts = {};
    this.pipelines = {};
    d.pushErrorScope("validation");
    const built = await Promise.all(
      Object.entries(kernels).map(async ([name, code]) => {
        const module = d.createShaderModule({ code, label: `Maple ${name}` });
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter((m) => m.type === "error");
        if (errors.length) {
          throw new Error(`${name} shader: ${errors.map((e) => `${e.lineNum}: ${e.message}`).join("; ")}`);
        }
        const layout = layoutFor(d, SIGNATURES[name], name);
        const pipeline = await d.createComputePipelineAsync({
          layout: d.createPipelineLayout({ bindGroupLayouts: [this.stepLayout, layout] }),
          compute: { module, entryPoint: "main" },
          label: `Maple ${name}`,
        });
        return [name, layout, pipeline];
      }),
    );
    for (const [name, layout, pipeline] of built) {
      this.layouts[name] = layout;
      this.pipelines[name] = pipeline;
    }
    const validation = await d.popErrorScope();
    if (validation) throw validation;
  }

  allocateWorkspaces() {
    const d = this.device;
    this.work = {
      x: f32Buffer(d, HIDDEN, "hidden state"),
      norm: f32Buffer(d, HIDDEN, "normalized state"),
      temp: f32Buffer(d, HIDDEN, "block output"),
      zeros: f32Buffer(d, HIDDEN, "zero residual"),
      q: f32Buffer(d, HIDDEN, "queries"),
      k: f32Buffer(d, KV, "keys"),
      // Packed caches cannot be written a scalar at a time from the projection
      // and rope kernels, so those write here and storeKV packs the token.
      kStage: f32Buffer(d, KV, "staged keys"),
      vStage: f32Buffer(d, KV, "staged values"),
      attention: f32Buffer(d, HIDDEN, "attention output"),
      attnPartial: f32Buffer(d, HEADS * MAX_CHUNKS * HEAD_DIM, "attention partials"),
      attnMD: f32Buffer(d, HEADS * MAX_CHUNKS * 2, "attention max/denominator"),
      routerLogits: f32Buffer(d, EXPERTS, "router logits"),
      expertIds: u32Buffer(d, TOPK, "expert ids"),
      expertScores: f32Buffer(d, TOPK, "expert scores"),
      expertHidden: f32Buffer(d, TOPK * EDIM, "expert hidden"),
      logits: f32Buffer(d, VOCAB, "vocabulary logits"),
      maxPartial: f32Buffer(d, SAMPLE_WG, "logit max partials"),
      bestValue: f32Buffer(d, SAMPLE_WG, "sample partial values"),
      bestIndex: u32Buffer(d, SAMPLE_WG, "sample partial indices"),
      tokens: u32Buffer(d, this.maxContext + 1, "token ids"),
      predictions: u32Buffer(d, this.maxContext + 1, "forced-decode predictions"),
      tokensRead: d.createBuffer({
        size: align4((this.maxContext + 1) * 4),
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        label: "token readback",
      }),
      steps: d.createBuffer({
        size: (this.maxContext + 1) * STEP_STRIDE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "per-position step uniforms",
      }),
      samplerParams: d.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "sampler settings",
      }),
    };
    d.queue.writeBuffer(this.work.zeros, 0, new Float32Array(HIDDEN));
    this.stepGroup = this.device.createBindGroup({
      layout: this.stepLayout,
      label: "step",
      entries: [{ binding: 0, resource: { buffer: this.work.steps, size: 16 } }],
    });
    this.writeSampler();
  }

  writeSampler() {
    const data = new ArrayBuffer(16);
    new Float32Array(data, 0, 2).set([this.sampling.temperature, this.sampling.minP]);
    new Uint32Array(data, 8, 2).set([this.salt, 0]);
    this.device.queue.writeBuffer(this.work.samplerParams, 0, data);
  }

  setSampling({ temperature, minP }) {
    if (temperature !== undefined) this.sampling.temperature = Math.max(0, temperature);
    if (minP !== undefined) this.sampling.minP = Math.max(0, Math.min(1, minP));
    this.writeSampler();
  }

  async loadWeights(onProgress) {
    const [globals, finalNorm, head] = await Promise.all([
      this.weights.loadGroup("embeddings.mwg", "STREAMING TOKEN EMBEDDINGS"),
      this.weights.loadGroup("final-norm.mwg", "STREAMING FINAL NORM"),
      this.weights.loadGroup("lm-head.mwg", "STREAMING LANGUAGE HEAD"),
    ]);
    this.embedding = {
      weight: globals["model.word_embeddings.weight"],
      scales: globals["model.word_embeddings.scales"],
      biases: globals["model.word_embeddings.biases"],
    };
    this.finalNormWeight = finalNorm["model.norm.weight"];
    this.lmHead = {
      weight: head["lm_head.weight"],
      scales: head["lm_head.scales"],
      biases: head["lm_head.biases"],
    };
    await nextFrame();

    // Layers stream concurrently; each one is bound as soon as its bytes land.
    const retired = [];
    const concurrency = isMobile() ? LOAD_CONCURRENCY_LIMITED : LOAD_CONCURRENCY;
    for (let start = 0; start < NUM_LAYERS; start += concurrency) {
      const indices = Array.from(
        { length: Math.min(concurrency, NUM_LAYERS - start) },
        (_, offset) => start + offset,
      );
      const batch = await Promise.all(indices.map(async (index) => {
        const filename = `layers/layer-${String(index).padStart(2, "0")}.mwg`;
        const tensors = await this.weights.loadGroup(filename, `STREAMING LAYER ${index + 1} / ${NUM_LAYERS}`);
        return { index, tensors };
      }));
      for (const { index, tensors } of batch) {
        this.layers.push(this.makeLayer(index, `model.layers.${index}`, tensors, retired));
        onProgress?.({
          phase: `LAYER ${index + 1} RESIDENT ON GPU`,
          loaded: this.weights.loaded,
          total: this.weights.total,
        });
      }
      await nextFrame();
    }

    // The split q/k/v tensors were concatenated on the GPU; release the originals
    // once those copies have actually run.
    await this.device.queue.onSubmittedWorkDone();
    for (const item of retired) {
      this.weights.buffers.delete(item);
      item.destroy();
    }

    this.binding = {
      embedding: groupFor(this.device, this.layouts.embed, [
        this.embedding.weight, this.embedding.scales, this.embedding.biases, this.work.x, this.work.tokens,
      ], "embedding"),
      finalNorm: groupFor(this.device, this.layouts.addRmsNorm, [
        this.work.x, this.work.temp, this.finalNormWeight, this.work.norm,
      ], "final norm"),
      lmHead: groupFor(this.device, this.layouts.lmHead, [
        this.work.norm, this.lmHead.weight, this.lmHead.scales, this.lmHead.biases, this.work.logits,
      ], "lm head"),
      logitsMax: groupFor(this.device, this.layouts.logitsMax, [this.work.logits, this.work.maxPartial], "logit max"),
      sampleScan: groupFor(this.device, this.layouts.sampleScan, [
        this.work.logits, this.work.maxPartial, this.work.bestValue, this.work.bestIndex, this.work.samplerParams,
      ], "sample scan"),
      sampleFinal: groupFor(this.device, this.layouts.sampleFinal, [
        this.work.bestValue, this.work.bestIndex, this.work.tokens,
      ], "sample final"),
      // Same kernel, but predictions land beside the prompt instead of feeding
      // back into it, so a fixed token sequence can be teacher-forced.
      sampleForced: groupFor(this.device, this.layouts.sampleFinal, [
        this.work.bestValue, this.work.bestIndex, this.work.predictions,
      ], "sample forced"),
    };
  }

  makeLayer(index, prefix, t, retired) {
    const d = this.device;
    const L = this.layouts;
    const w = this.work;
    const get = (suffix) => {
      const item = t[`${prefix}.${suffix}`];
      if (!item) throw new Error(`Layer ${index} is missing ${suffix}`);
      return item;
    };
    const sliding = index % 4 !== 3;
    const layer = {
      index,
      sliding,
      kCache: kvCache(d, this.maxContext, this.kvFormat, `layer ${index} key cache`),
      vCache: kvCache(d, this.maxContext, this.kvFormat, `layer ${index} value cache`),
      kvScale: kvScaleBuffer(d, this.maxContext, this.kvFormat, `layer ${index} kv scales`),
    };
    const packed = this.kvFormat !== "f32";

    const qkvWeights = ["q_proj", "k_proj", "v_proj"].map((p) => get(`self_attn.${p}.weight`));
    const qkvAlpha = ["q_proj", "k_proj", "v_proj"].map((p) => get(`self_attn.${p}.row_alpha`));
    const sum = (list) => list.reduce((total, item) => total + item.size, 0);
    const combinedWeight = buffer(d, sum(qkvWeights), STORAGE_COPY(), `L${index} qkv weights`);
    const combinedAlpha = buffer(d, sum(qkvAlpha), STORAGE_COPY(), `L${index} qkv alpha`);
    this.weights.buffers.add(combinedWeight);
    this.weights.buffers.add(combinedAlpha);
    const encoder = d.createCommandEncoder({ label: `L${index} combine qkv` });
    let offset = 0;
    for (const source of qkvWeights) {
      encoder.copyBufferToBuffer(source, 0, combinedWeight, offset, source.size);
      offset += source.size;
    }
    offset = 0;
    for (const source of qkvAlpha) {
      encoder.copyBufferToBuffer(source, 0, combinedAlpha, offset, source.size);
      offset += source.size;
    }
    d.queue.submit([encoder.finish()]);
    retired.push(...qkvWeights, ...qkvAlpha);

    // Held so the attention bind groups can be rebuilt if the context is resized.
    layer.bound = {
      combinedWeight, combinedAlpha,
      qNorm: get("self_attn.q_norm.weight"),
      kNorm: get("self_attn.k_norm.weight"),
    };

    layer.groups = {
      inputNorm: groupFor(d, L.addRmsNorm, [w.x, w.zeros, get("input_layernorm.weight"), w.norm], `L${index} input norm`),
      inputAddNorm: groupFor(d, L.addRmsNorm, [w.x, w.temp, get("input_layernorm.weight"), w.norm], `L${index} input add norm`),
      postAddNorm: groupFor(d, L.addRmsNorm, [w.x, w.temp, get("post_attention_layernorm.weight"), w.norm], `L${index} post add norm`),
      qkv: groupFor(d, L.qkv, [w.norm, combinedWeight, combinedAlpha, w.q, w.k, packed ? w.vStage : layer.vCache], `L${index} qkv`),
      qk: groupFor(d, sliding ? L.qkNormRope : L.qkNorm, [
        w.q, w.k, get("self_attn.q_norm.weight"), get("self_attn.k_norm.weight"), packed ? w.kStage : layer.kCache,
      ], `L${index} qk norm`),
      store: packed
        ? groupFor(d, L.storeKV, [w.kStage, w.vStage, layer.kCache, layer.vCache, layer.kvScale], `L${index} store kv`)
        : null,
      attention: groupFor(d, sliding ? L.attentionSliding : L.attentionFull, [
        w.q, layer.kCache, layer.vCache, layer.kvScale, w.attnPartial, w.attnMD,
      ], `L${index} attention`),
      combine: groupFor(d, sliding ? L.combineSliding : L.combineFull, [
        w.attnPartial, w.attnMD, w.attention,
      ], `L${index} attention combine`),
      o: groupFor(d, L.gemv2, [
        w.attention, get("self_attn.o_proj.weight"), get("self_attn.o_proj.row_alpha"), w.temp,
      ], `L${index} o`),
      router: groupFor(d, L.router, [w.norm, get("mlp.gate.weight"), w.routerLogits], `L${index} router`),
      topK: groupFor(d, L.routerTopK, [w.routerLogits, w.expertIds, w.expertScores], `L${index} top k`),
      upGate: groupFor(d, L.expertUpGate, [
        w.norm, w.expertIds,
        get("mlp.switch_mlp.up_proj.weight"), get("mlp.switch_mlp.up_proj.row_alpha"),
        get("mlp.switch_mlp.gate_proj.weight"), get("mlp.switch_mlp.gate_proj.row_alpha"),
        w.expertHidden,
      ], `L${index} up gate`),
      down: groupFor(d, L.expertDown, [
        w.expertHidden, w.expertIds, w.expertScores,
        get("mlp.switch_mlp.down_proj.weight"), get("mlp.switch_mlp.down_proj.row_alpha"), w.temp,
      ], `L${index} down`),
    };
    return layer;
  }

  // Resize the KV cache in place. Everything that depends on the context length is
  // rebuilt: the per-layer caches, the token and step buffers, and every bind group
  // that names one of them. The conversation cache is dropped, so the next turn
  // re-prefills from scratch, but weights are untouched.
  async setContext(tokens) {
    const target = Math.max(512, Math.min(Math.round(tokens), MODEL_MAX_CONTEXT));
    if (target === this.maxContext) return this.maxContext;
    await this.device.queue.onSubmittedWorkDone();
    const d = this.device;
    const w = this.work;
    const previous = this.maxContext;
    this.maxContext = target;

    const stale = [w.tokens, w.predictions, w.tokensRead, w.steps];
    const fresh = {
      tokens: u32Buffer(d, target + 1, "token ids"),
      predictions: u32Buffer(d, target + 1, "forced-decode predictions"),
      tokensRead: d.createBuffer({
        size: align4((target + 1) * 4),
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        label: "token readback",
      }),
      steps: d.createBuffer({
        size: (target + 1) * STEP_STRIDE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "per-position step uniforms",
      }),
    };

    try {
      for (const layer of this.layers) {
        const kCache = kvCache(d, target, this.kvFormat, `layer ${layer.index} key cache`);
        const vCache = kvCache(d, target, this.kvFormat, `layer ${layer.index} value cache`);
        const kvScale = kvScaleBuffer(d, target, this.kvFormat, `layer ${layer.index} kv scales`);
        layer.kCache.destroy();
        layer.vCache.destroy();
        layer.kvScale.destroy();
        layer.kCache = kCache;
        layer.vCache = vCache;
        layer.kvScale = kvScale;
        const L = this.layouts;
        const b = layer.bound;
        const packed = this.kvFormat !== "f32";
        layer.groups.qkv = groupFor(d, L.qkv, [w.norm, b.combinedWeight, b.combinedAlpha, w.q, w.k, packed ? w.vStage : vCache], `L${layer.index} qkv`);
        layer.groups.qk = groupFor(d, layer.sliding ? L.qkNormRope : L.qkNorm, [w.q, w.k, b.qNorm, b.kNorm, packed ? w.kStage : kCache], `L${layer.index} qk norm`);
        layer.groups.store = packed
          ? groupFor(d, L.storeKV, [w.kStage, w.vStage, kCache, vCache, kvScale], `L${layer.index} store kv`)
          : null;
        layer.groups.attention = groupFor(d, layer.sliding ? L.attentionSliding : L.attentionFull, [w.q, kCache, vCache, kvScale, w.attnPartial, w.attnMD], `L${layer.index} attention`);
      }
    } catch (error) {
      this.maxContext = previous;
      for (const item of Object.values(fresh)) item.destroy();
      throw new Error(`Not enough GPU memory for a ${target.toLocaleString()}-token context.`);
    }

    Object.assign(w, fresh);
    for (const item of stale) item.destroy();
    this.stepGroup = d.createBindGroup({
      layout: this.stepLayout,
      label: "step",
      entries: [{ binding: 0, resource: { buffer: w.steps, size: 16 } }],
    });
    this.binding.embedding = groupFor(d, this.layouts.embed, [
      this.embedding.weight, this.embedding.scales, this.embedding.biases, w.x, w.tokens,
    ], "embedding");
    this.binding.sampleFinal = groupFor(d, this.layouts.sampleFinal, [w.bestValue, w.bestIndex, w.tokens], "sample final");
    this.binding.sampleForced = groupFor(d, this.layouts.sampleFinal, [w.bestValue, w.bestIndex, w.predictions], "sample forced");
    this.resident = [];
    this.residentRun = 0;
    return this.maxContext;
  }

  // Split-K plan for one position. Chunks are sized to keep the GPU busy at short
  // context without exceeding the fixed partial buffers.
  attentionPlan(position, sliding) {
    const first = sliding && position + 1 > WINDOW ? position + 1 - WINDOW : 0;
    const tokens = position + 1 - first;
    let chunks = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(tokens / 64)));
    let chunkSize = Math.ceil(Math.ceil(tokens / chunks) / 8) * 8;
    chunks = Math.ceil(tokens / chunkSize);
    return { chunkSize, chunks };
  }

  writeSteps(from, count) {
    const data = new Uint32Array(count * (STEP_STRIDE / 4));
    for (let i = 0; i < count; i++) {
      const position = from + i;
      const base = i * (STEP_STRIDE / 4);
      data[base] = position;
      data[base + 1] = this.attentionPlan(position, true).chunkSize;
      data[base + 2] = this.attentionPlan(position, false).chunkSize;
    }
    this.device.queue.writeBuffer(this.work.steps, from * STEP_STRIDE, data);
  }

  // One compute pass for the whole token. Every dispatch below reads what the
  // previous one wrote; WebGPU orders dispatches within a pass and makes those
  // writes visible, so nothing here needs a pass boundary.
  encodeToken(pass, position, sample, forced = false) {
    const p = this.pipelines;
    pass.setBindGroup(0, this.stepGroup, [position * STEP_STRIDE]);

    const run = (pipeline, group, x, y = 1) => {
      pass.setPipeline(pipeline);
      pass.setBindGroup(1, group);
      pass.dispatchWorkgroups(x, y);
    };

    run(p.embed, this.binding.embedding, 1);
    for (const layer of this.layers) {
      const g = layer.groups;
      const plan = this.attentionPlan(position, layer.sliding);
      run(p.addRmsNorm, layer.index === 0 ? g.inputNorm : g.inputAddNorm, 1);
      run(p.qkv, g.qkv, (HIDDEN + 2 * KV) / 8);
      run(layer.sliding ? p.qkNormRope : p.qkNorm, g.qk, HEADS + KV_HEADS);
      if (g.store) run(p.storeKV, g.store, KV_HEADS, 2);
      run(layer.sliding ? p.attentionSliding : p.attentionFull, g.attention, plan.chunks, KV_HEADS);
      run(layer.sliding ? p.combineSliding : p.combineFull, g.combine, HEADS);
      run(p.gemv2, g.o, HIDDEN / 8);
      run(p.addRmsNorm, g.postAddNorm, 1);
      run(p.router, g.router, EXPERTS / 8);
      run(p.routerTopK, g.topK, 1);
      run(p.expertUpGate, g.upGate, EDIM / 8, TOPK);
      run(p.expertDown, g.down, HIDDEN / 8);
    }
    run(p.addRmsNorm, this.binding.finalNorm, 1);
    if (!sample) return;
    run(p.lmHead, this.binding.lmHead, this.lmHeadGroups);
    run(p.logitsMax, this.binding.logitsMax, SAMPLE_WG);
    run(p.sampleScan, this.binding.sampleScan, SAMPLE_WG);
    run(p.sampleFinal, forced ? this.binding.sampleForced : this.binding.sampleFinal, 1);
  }

  // Run a fixed token sequence and record what the model would have predicted at
  // every position. Divergence from the reference here is a real per-step
  // numerical fault; divergence only in free running is ordinary greedy chaos.
  async teacherForce(tokenIds) {
    this.residentRun = 0;
    const n = Math.min(tokenIds.length, this.maxContext - 1);
    const ids = new Uint32Array(this.maxContext + 1);
    ids.set(tokenIds.slice(0, n));
    this.device.queue.writeBuffer(this.work.tokens, 0, ids, 0, n);
    this.writeSteps(0, n);
    const CHUNK = 32;
    for (let start = 0; start < n; start += CHUNK) {
      const count = Math.min(CHUNK, n - start);
      const d = this.device;
      const encoder = d.createCommandEncoder({ label: "teacher force" });
      const pass = encoder.beginComputePass();
      for (let i = 0; i < count; i++) this.encodeToken(pass, start + i, true, true);
      pass.end();
      d.queue.submit([encoder.finish()]);
      await nextFrame();
    }
    const staging = this.device.createBuffer({
      size: align4((n + 1) * 4),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.work.predictions, 0, staging, 0, align4((n + 1) * 4));
    this.device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const out = Array.from(new Uint32Array(staging.getMappedRange().slice(0)));
    staging.unmap();
    staging.destroy();
    return out;
  }

  // Encode a run of positions into one command buffer. Prefill samples only at
  // the very last prompt position; decode samples at every position. Sampling
  // anywhere else would overwrite a real prompt token in the tokens buffer.
  submitRange(from, count, { sampleAll = false, sampleLast = false, readFrom = 0, readCount = 0 } = {}) {
    const d = this.device;
    const encoder = d.createCommandEncoder({ label: `Maple ${from}..${from + count - 1}` });
    const pass = encoder.beginComputePass({ label: "Maple token" });
    for (let i = 0; i < count; i++) {
      this.encodeToken(pass, from + i, sampleAll || (sampleLast && i === count - 1), false);
    }
    pass.end();
    if (readCount) {
      encoder.copyBufferToBuffer(this.work.tokens, readFrom * 4, this.work.tokensRead, 0, readCount * 4);
    }
    d.queue.submit([encoder.finish()]);
  }

  async readTokens(count) {
    const view = this.work.tokensRead;
    await view.mapAsync(GPUMapMode.READ, 0, count * 4);
    const out = Array.from(new Uint32Array(view.getMappedRange(0, count * 4).slice(0)));
    view.unmap();
    return out;
  }

  encodeChat(messages) {
    let encoded;
    try {
      encoded = this.tokenizer.apply_chat_template(messages, {
        tokenize: true, add_generation_prompt: true, return_tensor: false,
      });
    } catch {
      const text = messages
        .map((m) => `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`)
        .join("") + "<|im_start|>assistant\n<think>\n";
      encoded = this.tokenizer.encode(text, { add_special_tokens: false });
    }
    const values = encoded?.input_ids ?? encoded?.data ?? encoded?.ids ?? encoded;
    return Array.from(values);
  }

  // Copy any device buffer back to the CPU. Debug/verification only.
  async readBuffer(source, byteLength) {
    const size = align4(byteLength);
    const staging = this.device.createBuffer({
      size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ, label: "readback",
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(source, 0, staging, 0, size);
    this.device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(staging.getMappedRange().slice(0));
    staging.unmap();
    staging.destroy();
    return out;
  }

  // Re-run one position layer by layer, snapshotting the residual stream after
  // each. Re-running rewrites the same KV entries, so it is idempotent.
  async traceToken(tokenIds, position) {
    this.residentRun = 0;
    const d = this.device;
    const p = this.pipelines;
    const w = this.work;
    const ids = new Uint32Array(this.maxContext + 1);
    ids.set(tokenIds.slice(0, position + 1));
    d.queue.writeBuffer(this.work.tokens, 0, ids, 0, position + 1);
    this.writeSteps(0, position + 1);
    if (position > 0) this.submitRange(0, position);

    const trace = {};
    const stage = (fn) => {
      const encoder = d.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setBindGroup(0, this.stepGroup, [position * STEP_STRIDE]);
      fn((pipeline, group, x, y = 1) => {
        pass.setPipeline(pipeline);
        pass.setBindGroup(1, group);
        pass.dispatchWorkgroups(x, y);
      });
      pass.end();
      d.queue.submit([encoder.finish()]);
    };

    stage((run) => run(p.embed, this.binding.embedding, 1));
    trace.embedding = await this.readBuffer(w.x, HIDDEN * 4);

    for (const layer of this.layers) {
      const g = layer.groups;
      const plan = this.attentionPlan(position, layer.sliding);
      stage((run) => {
        run(p.addRmsNorm, layer.index === 0 ? g.inputNorm : g.inputAddNorm, 1);
        run(p.qkv, g.qkv, (HIDDEN + 2 * KV) / 8);
        run(layer.sliding ? p.qkNormRope : p.qkNorm, g.qk, HEADS + KV_HEADS);
        if (g.store) run(p.storeKV, g.store, KV_HEADS, 2);
        run(layer.sliding ? p.attentionSliding : p.attentionFull, g.attention, plan.chunks, KV_HEADS);
        run(layer.sliding ? p.combineSliding : p.combineFull, g.combine, HEADS);
      });
      if (layer.index === 0) {
        trace["L0.a_input_norm"] = await this.readBuffer(w.norm, HIDDEN * 4);
        trace["L0.b_attn_raw"] = await this.readBuffer(w.attention, HIDDEN * 4);
      }
      stage((run) => {
        run(p.gemv2, g.o, HIDDEN / 8);
        run(p.addRmsNorm, g.postAddNorm, 1);
        run(p.router, g.router, EXPERTS / 8);
        run(p.routerTopK, g.topK, 1);
      });
      if (layer.index === 0) {
        trace["L0.b_attn_out"] = await this.readBuffer(w.temp, HIDDEN * 4);
        trace["L0.c_post_attn_residual"] = await this.readBuffer(w.x, HIDDEN * 4);
        trace["L0.d_post_norm"] = await this.readBuffer(w.norm, HIDDEN * 4);
        trace["L0.e_router_logits"] = await this.readBuffer(w.routerLogits, EXPERTS * 4);
        trace["L0.f_expert_ids"] = new Float32Array(
          new Uint32Array((await this.readBuffer(w.expertIds, TOPK * 4)).buffer),
        );
        trace["L0.g_expert_scores"] = await this.readBuffer(w.expertScores, TOPK * 4);
      }
      stage((run) => {
        run(p.expertUpGate, g.upGate, EDIM / 8, TOPK);
        run(p.expertDown, g.down, HIDDEN / 8);
      });
      if (layer.index === 0) trace["L0.h_moe_out"] = await this.readBuffer(w.temp, HIDDEN * 4);
      // The residual add that closes this layer is folded into the next norm, so
      // reproduce it here to get a comparable "layer output".
      const x = await this.readBuffer(w.x, HIDDEN * 4);
      const r = await this.readBuffer(w.temp, HIDDEN * 4);
      const out = new Float32Array(HIDDEN);
      for (let i = 0; i < HIDDEN; i++) out[i] = x[i] + r[i];
      trace[`layer${String(layer.index).padStart(2, "0")}.out`] = out;
    }

    stage((run) => {
      run(p.addRmsNorm, this.binding.finalNorm, 1);
      run(p.lmHead, this.binding.lmHead, this.lmHeadGroups);
    });
    trace.logits = await this.readBuffer(w.logits, VOCAB * 4);
    return trace;
  }

  // There is no fixed reply length: generation runs until the model emits a stop
  // token or the context window is actually full. Maple is a reasoning model and
  // routinely spends several hundred tokens thinking before it answers, so a
  // fixed cap truncates real answers mid-sentence.
  async *generate(messages, { maxNewTokens = Infinity, signal, onPrefill, promptIds } = {}) {
    const inputIds = promptIds ? Array.from(promptIds) : this.encodeChat(messages);
    if (inputIds.length >= this.maxContext - 1) {
      throw new Error(`Prompt exceeds the ${this.maxContext}-token browser context`);
    }
    const room = this.maxContext - inputIds.length - 1;
    maxNewTokens = Math.max(1, Math.min(maxNewTokens, room));

    const started = performance.now();
    this.salt = (Math.random() * 0xffffffff) >>> 0;
    this.writeSampler();
    const stream = makeStream(this.tokenizer, DECODE_WINDOW);

    // A cache entry at position p depends only on tokens 0..p, so any prompt
    // that starts with what is already resident can reuse those entries. Without
    // this every turn re-runs the whole conversation and time-to-first-token
    // grows with the transcript instead of with what the user just typed.
    let reuse = 0;
    const reusable = Math.min(this.residentRun, inputIds.length - 1);
    while (reuse < reusable && this.resident[reuse] === inputIds[reuse]) reuse++;
    // `resident` mirrors the GPU token buffer; `residentRun` is how many of those
    // positions have actually had a forward pass, and so how far the cache is
    // trustworthy.
    this.resident = inputIds.slice();
    this.residentRun = reuse;

    const prompt = new Uint32Array(this.maxContext + 1);
    prompt.set(inputIds);
    this.device.queue.writeBuffer(this.work.tokens, 0, prompt, 0, inputIds.length);
    this.writeSteps(reuse, inputIds.length - reuse);

    // Prefill the remainder, in chunks big enough to keep the GPU saturated but
    // small enough that the UI still gets a frame.
    const PREFILL_CHUNK = 32;
    for (let start = reuse; start < inputIds.length; start += PREFILL_CHUNK) {
      if (signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
      const count = Math.min(PREFILL_CHUNK, inputIds.length - start);
      const last = start + count === inputIds.length;
      this.submitRange(start, count, {
        sampleLast: last,
        readFrom: inputIds.length,
        readCount: last ? 1 : 0,
      });
      onPrefill?.(start + count - reuse, inputIds.length - reuse);
      if (!last) await nextFrame();
    }

    // Tokens the GPU has produced but the UI has not seen yet.
    const ready = await this.readTokens(1);
    this.residentRun = inputIds.length;
    this.resident.push(ready[0]);
    const prefillMs = performance.now() - started;
    const generated = [];
    let previousText = "";
    let emitted = 0;
    // Next position to run a forward pass at. The prompt's last position already
    // ran and produced ready[0].
    let position = inputIds.length;

    while (emitted < maxNewTokens) {
      if (signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
      if (ready.length === 0) {
        const batch = Math.min(DECODE_BATCH, maxNewTokens - emitted);
        if (position + batch > this.maxContext) break;
        this.writeSteps(position, batch);
        this.submitRange(position, batch, { sampleAll: true, readFrom: position + 1, readCount: batch });
        const produced = await this.readTokens(batch);
        ready.push(...produced);
        position += batch;
        // Those positions have now run, and their sampled tokens are what sits in
        // the GPU token buffer at the following positions.
        this.resident.push(...produced);
        this.residentRun = position;
      }
      const token = ready.shift();
      if (EOS_TOKEN_IDS.has(token)) break;
      generated.push(token);
      const delta = stream.push(token);
      if (delta) previousText += delta;
      yield { token, delta, text: previousText, index: emitted, elapsed: performance.now() - started, prefillMs };
      emitted++;
    }
  }

  // Timed decode on a synthetic context: measures the kernels alone, with no
  // tokenizer or DOM work in the way.
  async benchmark({ warmup = 8, steps = 64, at = 256 } = {}) {
    this.residentRun = 0;
    const ids = new Uint32Array(this.maxContext + 1);
    for (let i = 0; i <= at; i++) ids[i] = 1000 + (i % 500);
    this.device.queue.writeBuffer(this.work.tokens, 0, ids, 0, at + 1);
    this.writeSteps(0, Math.min(this.maxContext, at + warmup + steps + 20));
    this.submitRange(0, at, { sampleLast: true, readFrom: at, readCount: 1 });
    await this.readTokens(1);

    for (let i = 0; i < warmup; i++) {
      this.submitRange(at + i, 1, { sampleAll: true, readFrom: at + i + 1, readCount: 1 });
      await this.readTokens(1);
    }
    await this.device.queue.onSubmittedWorkDone();

    const base = at + warmup;
    const t0 = performance.now();
    for (let i = 0; i < steps; i += DECODE_BATCH) {
      const n = Math.min(DECODE_BATCH, steps - i);
      this.submitRange(base + i, n, { sampleAll: true, readFrom: base + i + 1, readCount: n });
      await this.readTokens(n);
    }
    const elapsed = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < 16; i++) {
      this.submitRange(base + steps + i, 1, { sampleAll: true, readFrom: base + steps + i + 1, readCount: 1 });
      await this.readTokens(1);
    }
    const serial = performance.now() - t1;

    // Same work without the language head or sampler, which isolates how much of
    // a token the 175 MB head costs.
    const t2 = performance.now();
    const bodyBase = base + steps + 16;
    for (let i = 0; i < 32; i += DECODE_BATCH) {
      this.submitRange(bodyBase + i, DECODE_BATCH);
    }
    await this.device.queue.onSubmittedWorkDone();
    const body = performance.now() - t2;

    return {
      tokensPerSecond: (steps / elapsed) * 1000,
      msPerToken: elapsed / steps,
      serialMsPerToken: serial / 16,
      bodyMsPerToken: body / 32,
      headMsPerToken: elapsed / steps - body / 32,
      context: at,
      mode: this.useSubgroups ? "subgroups" : "portable",
    };
  }

  details() {
    return {
      device: this.deviceLabel,
      weights: "Official 2-bit MLX",
      architecture: "20B · 1B active · 24 layers",
      context: `${this.maxContext.toLocaleString()} browser tokens`,
      runtime: `Custom WebGPU · ${this.useSubgroups ? "subgroup fast path" : "portable path"}`,
      "kv cache": KV_FORMATS[this.kvFormat].label,
      sampling: this.sampling.temperature > 0
        ? `temp ${this.sampling.temperature} · min-p ${this.sampling.minP}`
        : "greedy",
      cache: this.cacheEnabled ? "Weights cached on device" : "Streaming only",
      revision: this.packRevision?.slice(0, 12) ?? "main",
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.weights?.destroy();
    for (const item of Object.values(this.work ?? {})) item?.destroy?.();
    for (const layer of this.layers) {
      layer.kCache?.destroy();
      layer.vCache?.destroy();
      layer.kvScale?.destroy();
    }
    this.device?.destroy?.();
  }
}

export class DemoRuntime {
  constructor() {
    this.deviceLabel = "WebGPU demo mode";
    this.maxContext = 2048;
    this.sampling = { temperature: 0, minP: 0 };
  }
  setSampling() {}
  async *generate(messages, { signal } = {}) {
    const answer = `A useful way to see it is this: growth does not require every branch to move at once.\n</think>\n\nA maple tree changes by letting go with precision. It does not confuse permanence with strength; roots can stay deep while leaves turn, fall, and return in another form.\n\nIts lesson is gentle: **keep what anchors you, release what has finished, and make room for the next season.**`;
    const words = answer.split(/(\s+)/);
    let text = "";
    for (let i = 0; i < words.length; i++) {
      if (signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
      await new Promise((resolve) => setTimeout(resolve, 35));
      text += words[i];
      yield { token: i, delta: words[i], text, index: i, elapsed: i * 35, prefillMs: 120 };
    }
  }
  details() {
    return { device: this.deviceLabel, weights: "UI simulation", architecture: "20B · 1B active", context: "2,048 tokens", runtime: "Demo", sampling: "greedy", cache: "n/a", revision: "local" };
  }
  destroy() {}
}
