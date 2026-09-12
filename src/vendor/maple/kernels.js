// WGSL kernels for Maple-Preview decode.
//
// Every kernel is generated from one template so the subgroup and portable paths
// cannot drift apart: `teamSum` is either a 32-lane subgroup shuffle butterfly or
// a shared-memory ladder, and nothing else changes.
//
// Conventions shared by all kernels:
//   @group(0) @binding(0)  Step uniform, bound ONCE per token with a dynamic
//                          offset. Every pipeline declares it (even when unused)
//                          so the binding stays valid across pipeline switches
//                          and the whole token can live in a single compute pass.
//   @group(1)              per-kernel storage buffers.
//
// Weights keep the checkpoint's own layout. 2-bit tensors are ternary with one
// scale per output row: value = (code - 1) * row_alpha, 16 codes per u32, low
// bits first. 4-bit tensors (embeddings, lm_head) are affine with group size 64:
// value = code * scale + bias, 8 codes per u32, low bits first. BF16 scale and
// bias tables are read as packed u32 pairs and widened in-shader, which is
// bit-exact and halves the bytes those tables cost per token.

export const HIDDEN = 2048;
export const VOCAB = 151936;
export const NUM_LAYERS = 24;
export const HEADS = 16;
export const KV_HEADS = 4;
export const HEAD_DIM = 128;
export const KV = KV_HEADS * HEAD_DIM; // 512
export const GQA = HEADS / KV_HEADS; // 4
export const EXPERTS = 256;
export const TOPK = 8;
export const EDIM = 512;
export const WINDOW = 512;
export const MAX_CHUNKS = 16;
export const SAMPLE_WG = 64;
export const RMS_EPS = 1e-6;
export const ATTN_SCALE = 1 / Math.sqrt(HEAD_DIM); // 0.08838834764831845

// Shared prelude -------------------------------------------------------------

const STEP = /* wgsl */ `
struct Step {
  position: u32,
  swaChunk: u32,
  fullChunk: u32,
  reserved: u32,
};
@group(0) @binding(0) var<uniform> step: Step;
`;

// BF16 tables are stored packed two-per-u32; widening is exact.
const BF16 = /* wgsl */ `
fn bf16lo(w: u32) -> f32 { return bitcast<f32>(w << 16u); }
fn bf16hi(w: u32) -> f32 { return bitcast<f32>(w & 0xffff0000u); }
`;

function teamSumDecl(subgroups, size = 256) {
  if (subgroups) {
    return /* wgsl */ `
fn teamSum(v: f32, tid: u32) -> f32 {
  var x = v;
  for (var m = 1u; m < 32u; m = m << 1u) { x = x + subgroupShuffleXor(x, m); }
  return x;
}
`;
  }
  return /* wgsl */ `
var<workgroup> teamRed: array<f32, ${size}>;
fn teamSum(v: f32, tid: u32) -> f32 {
  teamRed[tid] = v;
  workgroupBarrier();
  let lane = tid & 31u;
  let base = tid & 4294967264u;
  for (var s = 16u; s > 0u; s = s >> 1u) {
    if (lane < s) { teamRed[base + lane] = teamRed[base + lane] + teamRed[base + lane + s]; }
    workgroupBarrier();
  }
  let r = teamRed[base];
  workgroupBarrier();
  return r;
}
`;
}

function teamSum4Decl(subgroups, size = 256) {
  if (subgroups) {
    return /* wgsl */ `
fn teamSum4(v: vec4<f32>, tid: u32) -> vec4<f32> {
  var x = v;
  for (var m = 1u; m < 32u; m = m << 1u) { x = x + subgroupShuffleXor(x, m); }
  return x;
}
`;
  }
  return /* wgsl */ `
var<workgroup> teamRed4: array<vec4<f32>, ${size}>;
fn teamSum4(v: vec4<f32>, tid: u32) -> vec4<f32> {
  teamRed4[tid] = v;
  workgroupBarrier();
  let lane = tid & 31u;
  let base = tid & 4294967264u;
  for (var s = 16u; s > 0u; s = s >> 1u) {
    if (lane < s) { teamRed4[base + lane] = teamRed4[base + lane] + teamRed4[base + lane + s]; }
    workgroupBarrier();
  }
  let r = teamRed4[base];
  workgroupBarrier();
  return r;
}
`;
}

// Decode 16 ternary codes packed in one u32 against 16 shared activations.
const DOT16 = /* wgsl */ `
fn dot16(w: u32, base: u32) -> f32 {
  var a = 0.0;
  for (var i = 0u; i < 16u; i = i + 1u) {
    a = a + shared_[base + i] * (f32((w >> (i * 2u)) & 3u) - 1.0);
  }
  return a;
}
fn dot64(p: vec4<u32>, base: u32) -> f32 {
  return dot16(p.x, base) + dot16(p.y, base + 16u) + dot16(p.z, base + 32u) + dot16(p.w, base + 48u);
}
`;

// KV cache formats. The cache is the only thing that grows with context, so it is
// where a long window is won or lost. f16 and q8 both use core WGSL packing
// builtins, so neither needs an optional feature.
//   f32  4 bytes/element, exact
//   f16  2 bytes, pack2x16float
//   q8   1 byte,  pack4x8snorm with one scale per (position, kv head)
const KV_READERS = {"f32": "\nfn readK(ci: u32, t: u32, head: u32) -> vec4<f32> {\n  return vec4<f32>(kCache[ci], kCache[ci + 1u], kCache[ci + 2u], kCache[ci + 3u]);\n}\nfn readV(ci: u32, t: u32, head: u32) -> vec4<f32> {\n  return vec4<f32>(vCache[ci], vCache[ci + 1u], vCache[ci + 2u], vCache[ci + 3u]);\n}\n", "f16": "\nfn readK(ci: u32, t: u32, head: u32) -> vec4<f32> {\n  let w = ci >> 1u;\n  let a = unpack2x16float(kCache[w]);\n  let b = unpack2x16float(kCache[w + 1u]);\n  return vec4<f32>(a.x, a.y, b.x, b.y);\n}\nfn readV(ci: u32, t: u32, head: u32) -> vec4<f32> {\n  let w = ci >> 1u;\n  let a = unpack2x16float(vCache[w]);\n  let b = unpack2x16float(vCache[w + 1u]);\n  return vec4<f32>(a.x, a.y, b.x, b.y);\n}\n", "q8": "\nfn readK(ci: u32, t: u32, head: u32) -> vec4<f32> {\n  return unpack4x8snorm(kCache[ci >> 2u]) * kvScale[(t * 4u + head) * 2u];\n}\nfn readV(ci: u32, t: u32, head: u32) -> vec4<f32> {\n  return unpack4x8snorm(vCache[ci >> 2u]) * kvScale[(t * 4u + head) * 2u + 1u];\n}\n"};

export const KV_FORMATS = {
  f32: { label: "f32 · exact", bytes: 4, scales: false },
  f16: { label: "f16 · half", bytes: 2, scales: false },
  q8: { label: "8-bit · quarter", bytes: 1, scales: true },
};

export function buildKernels({ subgroups, kvFormat = "f32" }) {
  const packed = kvFormat !== "f32";
  const readers = KV_READERS[kvFormat];
  const enable = subgroups ? "enable subgroups;\n" : "";
  const sum = teamSumDecl(subgroups);
  const sum4 = teamSum4Decl(subgroups);
  const K = {};

  // Residual add + RMSNorm, fused. Layer 0 passes a zero residual, and the final
  // norm folds in what used to be a separate add pass.
  K.addRmsNorm = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read_write> hidden: array<f32>;
@group(1) @binding(1) var<storage, read> residual: array<f32>;
@group(1) @binding(2) var<storage, read> weight: array<f32>;
@group(1) @binding(3) var<storage, read_write> normalized: array<f32>;
var<workgroup> red: array<f32, 256>;
@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) l: vec3<u32>) {
  let tid = l.x;
  var acc = 0.0;
  for (var i = tid; i < ${HIDDEN}u; i = i + 256u) {
    let v = hidden[i] + residual[i];
    hidden[i] = v;
    acc = acc + v * v;
  }
${subgroups ? `
  var part = acc;
  for (var m = 1u; m < 32u; m = m << 1u) { part = part + subgroupShuffleXor(part, m); }
  if ((tid & 31u) == 0u) { red[tid >> 5u] = part; }
  workgroupBarrier();
  var total = 0.0;
  for (var i = 0u; i < 8u; i = i + 1u) { total = total + red[i]; }
` : `
  red[tid] = acc;
  workgroupBarrier();
  for (var s = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) { red[tid] = red[tid] + red[tid + s]; }
    workgroupBarrier();
  }
  let total = red[0];
`}
  let scale = inverseSqrt(total / ${HIDDEN}.0 + ${RMS_EPS});
  for (var i = tid; i < ${HIDDEN}u; i = i + 256u) {
    normalized[i] = hidden[i] * scale * weight[i];
  }
}`;

  // 4-bit affine embedding lookup. The token id comes from the tokens buffer so
  // prefill and decode can both be encoded ahead of time with no CPU round trip.
  K.embed = /* wgsl */ `${enable}${STEP}${BF16}
@group(1) @binding(0) var<storage, read> weights: array<u32>;
@group(1) @binding(1) var<storage, read> scales: array<u32>;
@group(1) @binding(2) var<storage, read> biases: array<u32>;
@group(1) @binding(3) var<storage, read_write> output: array<f32>;
@group(1) @binding(4) var<storage, read> tokens: array<u32>;
@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) l: vec3<u32>) {
  let token = tokens[step.position];
  for (var i = l.x; i < ${HIDDEN}u; i = i + 256u) {
    let packed = weights[token * 256u + (i >> 3u)];
    let code = f32((packed >> ((i & 7u) * 4u)) & 15u);
    let g = token * 32u + (i >> 6u);
    let sw = scales[g >> 1u];
    let bw = biases[g >> 1u];
    let even = (g & 1u) == 0u;
    let sc = select(bf16hi(sw), bf16lo(sw), even);
    let bi = select(bf16hi(bw), bf16lo(bw), even);
    output[i] = code * sc + bi;
  }
}`;

  // Fused q/k/v projection. Values need no norm or rope, so they are written
  // straight into the KV cache; that removes the per-layer buffer copies that
  // used to force the token to be split across hundreds of compute passes.
  K.qkv = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> input: array<f32>;
@group(1) @binding(1) var<storage, read> weights: array<vec4<u32>>;
@group(1) @binding(2) var<storage, read> alpha: array<f32>;
@group(1) @binding(3) var<storage, read_write> queries: array<f32>;
@group(1) @binding(4) var<storage, read_write> keys: array<f32>;
@group(1) @binding(5) var<storage, read_write> vOut: array<f32>;
var<workgroup> shared_: array<f32, ${HIDDEN}>;
${sum}${DOT16}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  for (var i = l.x; i < ${HIDDEN}u; i = i + 256u) { shared_[i] = input[i]; }
  workgroupBarrier();
  let lane = l.x & 31u;
  let row = g.x * 8u + (l.x >> 5u);
  let acc = dot64(weights[row * 32u + lane], lane * 64u);
  let total = teamSum(acc, l.x);
  if (lane == 0u) {
    let r = total * alpha[row];
    if (row < ${HIDDEN}u) { queries[row] = r; }
    else if (row < ${HIDDEN + KV}u) { keys[row - ${HIDDEN}u] = r; }
    else { vOut[${packed ? '' : `step.position * ${KV}u + `}(row - ${HIDDEN + KV}u)] = r; }
  }
}`;

  // Per-head RMSNorm on q and k, then partial RoPE, then k straight to cache.
  // Two variants: sliding layers rotate, global layers are NoPE.
  const qkNormRope = (rope) => /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read_write> queries: array<f32>;
@group(1) @binding(1) var<storage, read> keys: array<f32>;
@group(1) @binding(2) var<storage, read> qWeight: array<f32>;
@group(1) @binding(3) var<storage, read> kWeight: array<f32>;
@group(1) @binding(4) var<storage, read_write> kOut: array<f32>;
var<workgroup> vals: array<f32, ${HEAD_DIM}>;
var<workgroup> red: array<f32, ${HEAD_DIM}>;
@compute @workgroup_size(${HEAD_DIM})
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  let head = g.x;
  let d = l.x;
  let isQ = head < ${HEADS}u;
  var raw = 0.0;
  var nw = 1.0;
  if (isQ) { raw = queries[head * ${HEAD_DIM}u + d]; nw = qWeight[d]; }
  else { raw = keys[(head - ${HEADS}u) * ${HEAD_DIM}u + d]; nw = kWeight[d]; }
${subgroups ? `
  var part = raw * raw;
  for (var m = 1u; m < 32u; m = m << 1u) { part = part + subgroupShuffleXor(part, m); }
  if ((d & 31u) == 0u) { red[d >> 5u] = part; }
  workgroupBarrier();
  var total = 0.0;
  for (var i = 0u; i < ${HEAD_DIM / 32}u; i = i + 1u) { total = total + red[i]; }
` : `
  red[d] = raw * raw;
  workgroupBarrier();
  for (var s = ${HEAD_DIM / 2}u; s > 0u; s = s >> 1u) {
    if (d < s) { red[d] = red[d] + red[d + s]; }
    workgroupBarrier();
  }
  let total = red[0];
`}
  let scale = inverseSqrt(total / ${HEAD_DIM}.0 + ${RMS_EPS});
  vals[d] = raw * scale * nw;
  workgroupBarrier();
  var result = vals[d];
${rope ? `
  if (d < 64u) {
    let p = select(d - 32u, d, d < 32u);
    let pair = select(d - 32u, d + 32u, d < 32u);
    let theta = f32(step.position) * pow(10000.0, -f32(p) / 32.0);
    let c = cos(theta);
    let s = sin(theta);
    let other = vals[pair];
    result = select(result * c + other * s, result * c - other * s, d < 32u);
  }
` : ""}
  if (isQ) { queries[head * ${HEAD_DIM}u + d] = result; }
  else { kOut[${packed ? '' : `step.position * ${KV}u + `}(head - ${HEADS}u) * ${HEAD_DIM}u + d] = result; }
}`;
  K.qkNormRope = qkNormRope(true);
  K.qkNorm = qkNormRope(false);


  // Packs one position's keys and values into the cache. Only built for the
  // reduced-precision formats; f32 writes straight through from the projection
  // and rope kernels and never runs this.
  if (packed) {
    K.storeKV = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> keysIn: array<f32>;
@group(1) @binding(1) var<storage, read> valuesIn: array<f32>;
@group(1) @binding(2) var<storage, read_write> kCache: array<u32>;
@group(1) @binding(3) var<storage, read_write> vCache: array<u32>;
@group(1) @binding(4) var<storage, read_write> kvScale: array<f32>;
var<workgroup> red: array<f32, 32>;
@compute @workgroup_size(32)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  let head = g.x;
  let which = g.y;
  let lane = l.x;
  let base = head * ${HEAD_DIM}u + lane * 4u;
  var v: vec4<f32>;
  if (which == 0u) {
    v = vec4<f32>(keysIn[base], keysIn[base + 1u], keysIn[base + 2u], keysIn[base + 3u]);
  } else {
    v = vec4<f32>(valuesIn[base], valuesIn[base + 1u], valuesIn[base + 2u], valuesIn[base + 3u]);
  }
  let slot = step.position * ${KV}u + base;
${kvFormat === "q8" ? `
  // One scale per (position, kv head): the 128 dims of a head share a range, and
  // a finer scale would cost more to store than it saves.
  red[lane] = max(max(abs(v.x), abs(v.y)), max(abs(v.z), abs(v.w)));
  workgroupBarrier();
  for (var s = 16u; s > 0u; s = s >> 1u) {
    if (lane < s) { red[lane] = max(red[lane], red[lane + s]); }
    workgroupBarrier();
  }
  let scale = max(red[0], 1e-12);
  let word = pack4x8snorm(v / scale);
  if (which == 0u) { kCache[slot >> 2u] = word; } else { vCache[slot >> 2u] = word; }
  if (lane == 0u) { kvScale[(step.position * ${KV_HEADS}u + head) * 2u + which] = scale; }
` : `
  let lo = pack2x16float(v.xy);
  let hi = pack2x16float(v.zw);
  let word = slot >> 1u;
  if (which == 0u) { kCache[word] = lo; kCache[word + 1u] = hi; }
  else { vCache[word] = lo; vCache[word + 1u] = hi; }
`}
}`;
  }

  // Split-K flash decode. One workgroup per (kv head, chunk): the four query
  // heads that share a kv head are handled together so K and V are read once
  // instead of four times, which is the single largest saving in the whole
  // token. Eight subgroups walk the chunk in parallel, so the only barrier is
  // the final merge instead of one per key.
  const attention = (sliding) => /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> queries: array<f32>;
@group(1) @binding(1) var<storage, read> kCache: array<${packed ? "u32" : "f32"}>;
@group(1) @binding(2) var<storage, read> vCache: array<${packed ? "u32" : "f32"}>;
@group(1) @binding(3) var<storage, read> kvScale: array<f32>;
@group(1) @binding(4) var<storage, read_write> partial: array<f32>;
@group(1) @binding(5) var<storage, read_write> partialMD: array<vec2<f32>>;
var<workgroup> shAcc: array<f32, ${8 * GQA * HEAD_DIM}>;
var<workgroup> shMD: array<vec2<f32>, ${8 * GQA}>;
${sum4}${readers}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  let kvHead = g.y;
  let chunk = g.x;
  let sg = l.x >> 5u;
  let lane = l.x & 31u;
  let d0 = lane * 4u;
  let pos = step.position;
${sliding
    ? `  let first = select(0u, pos + 1u - ${WINDOW}u, pos + 1u > ${WINDOW}u);
  let chunkSize = step.swaChunk;`
    : `  let first = 0u;
  let chunkSize = step.fullChunk;`}
  let start = first + chunk * chunkSize;
  let end = min(pos + 1u, start + chunkSize);

  let qBase = kvHead * ${GQA}u;
  let q0 = vec4<f32>(queries[(qBase + 0u) * ${HEAD_DIM}u + d0], queries[(qBase + 0u) * ${HEAD_DIM}u + d0 + 1u], queries[(qBase + 0u) * ${HEAD_DIM}u + d0 + 2u], queries[(qBase + 0u) * ${HEAD_DIM}u + d0 + 3u]);
  let q1 = vec4<f32>(queries[(qBase + 1u) * ${HEAD_DIM}u + d0], queries[(qBase + 1u) * ${HEAD_DIM}u + d0 + 1u], queries[(qBase + 1u) * ${HEAD_DIM}u + d0 + 2u], queries[(qBase + 1u) * ${HEAD_DIM}u + d0 + 3u]);
  let q2 = vec4<f32>(queries[(qBase + 2u) * ${HEAD_DIM}u + d0], queries[(qBase + 2u) * ${HEAD_DIM}u + d0 + 1u], queries[(qBase + 2u) * ${HEAD_DIM}u + d0 + 2u], queries[(qBase + 2u) * ${HEAD_DIM}u + d0 + 3u]);
  let q3 = vec4<f32>(queries[(qBase + 3u) * ${HEAD_DIM}u + d0], queries[(qBase + 3u) * ${HEAD_DIM}u + d0 + 1u], queries[(qBase + 3u) * ${HEAD_DIM}u + d0 + 2u], queries[(qBase + 3u) * ${HEAD_DIM}u + d0 + 3u]);

  var m = vec4<f32>(-3.402823e+38);
  var den = vec4<f32>(0.0);
  var a0 = vec4<f32>(0.0);
  var a1 = vec4<f32>(0.0);
  var a2 = vec4<f32>(0.0);
  var a3 = vec4<f32>(0.0);

  // Iteration count is workgroup-uniform on purpose: teamSum4 contains a
  // workgroup barrier on the portable path, so every invocation must reach it
  // the same number of times. Lanes past the end of the chunk contribute zero.
  let span = select(0u, end - start, end > start);
  let iters = (span + 7u) / 8u;
  for (var it = 0u; it < iters; it = it + 1u) {
    let t = start + it * 8u + sg;
    let inRange = t < end;
    let ci = select(0u, t * ${KV}u + kvHead * ${HEAD_DIM}u + d0, inRange);
    let k = readK(ci, t, kvHead);
    let raw = vec4<f32>(dot(q0, k), dot(q1, k), dot(q2, k), dot(q3, k));
    let pd = teamSum4(select(vec4<f32>(0.0), raw, inRange), l.x);
    if (inRange) {
      let s = pd * ${ATTN_SCALE};
      let nm = max(m, s);
      let os = exp(m - nm);
      let ns = exp(s - nm);
      let v = readV(ci, t, kvHead);
      a0 = a0 * os.x + v * ns.x;
      a1 = a1 * os.y + v * ns.y;
      a2 = a2 * os.z + v * ns.z;
      a3 = a3 * os.w + v * ns.w;
      den = den * os + ns;
      m = nm;
    }
  }

  let ab = sg * ${GQA * HEAD_DIM}u + d0;
  shAcc[ab + 0u * ${HEAD_DIM}u] = a0.x; shAcc[ab + 0u * ${HEAD_DIM}u + 1u] = a0.y; shAcc[ab + 0u * ${HEAD_DIM}u + 2u] = a0.z; shAcc[ab + 0u * ${HEAD_DIM}u + 3u] = a0.w;
  shAcc[ab + 1u * ${HEAD_DIM}u] = a1.x; shAcc[ab + 1u * ${HEAD_DIM}u + 1u] = a1.y; shAcc[ab + 1u * ${HEAD_DIM}u + 2u] = a1.z; shAcc[ab + 1u * ${HEAD_DIM}u + 3u] = a1.w;
  shAcc[ab + 2u * ${HEAD_DIM}u] = a2.x; shAcc[ab + 2u * ${HEAD_DIM}u + 1u] = a2.y; shAcc[ab + 2u * ${HEAD_DIM}u + 2u] = a2.z; shAcc[ab + 2u * ${HEAD_DIM}u + 3u] = a2.w;
  shAcc[ab + 3u * ${HEAD_DIM}u] = a3.x; shAcc[ab + 3u * ${HEAD_DIM}u + 1u] = a3.y; shAcc[ab + 3u * ${HEAD_DIM}u + 2u] = a3.z; shAcc[ab + 3u * ${HEAD_DIM}u + 3u] = a3.w;
  if (lane == 0u) {
    shMD[sg * ${GQA}u + 0u] = vec2<f32>(m.x, den.x);
    shMD[sg * ${GQA}u + 1u] = vec2<f32>(m.y, den.y);
    shMD[sg * ${GQA}u + 2u] = vec2<f32>(m.z, den.z);
    shMD[sg * ${GQA}u + 3u] = vec2<f32>(m.w, den.w);
  }
  workgroupBarrier();

  for (var o = l.x; o < ${GQA * HEAD_DIM}u; o = o + 256u) {
    let h = o >> 7u;
    let d = o & 127u;
    var gmax = -3.402823e+38;
    for (var s = 0u; s < 8u; s = s + 1u) { gmax = max(gmax, shMD[s * ${GQA}u + h].x); }
    var acc = 0.0;
    var dsum = 0.0;
    for (var s = 0u; s < 8u; s = s + 1u) {
      let md = shMD[s * ${GQA}u + h];
      let w = exp(md.x - gmax);
      acc = acc + shAcc[s * ${GQA * HEAD_DIM}u + h * ${HEAD_DIM}u + d] * w;
      dsum = dsum + md.y * w;
    }
    let qh = qBase + h;
    partial[(qh * ${MAX_CHUNKS}u + chunk) * ${HEAD_DIM}u + d] = acc;
    if (d == 0u) { partialMD[qh * ${MAX_CHUNKS}u + chunk] = vec2<f32>(gmax, dsum); }
  }
}`;
  K.attentionSliding = attention(true);
  K.attentionFull = attention(false);

  const combine = (sliding) => /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> partial: array<f32>;
@group(1) @binding(1) var<storage, read> partialMD: array<vec2<f32>>;
@group(1) @binding(2) var<storage, read_write> output: array<f32>;
@compute @workgroup_size(${HEAD_DIM})
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  let qh = g.x;
  let d = l.x;
  let pos = step.position;
${sliding
    ? `  let first = select(0u, pos + 1u - ${WINDOW}u, pos + 1u > ${WINDOW}u);
  let chunkSize = step.swaChunk;`
    : `  let first = 0u;
  let chunkSize = step.fullChunk;`}
  let nTok = pos + 1u - first;
  let nChunks = min(${MAX_CHUNKS}u, (nTok + chunkSize - 1u) / chunkSize);
  var gmax = -3.402823e+38;
  for (var c = 0u; c < nChunks; c = c + 1u) { gmax = max(gmax, partialMD[qh * ${MAX_CHUNKS}u + c].x); }
  var acc = 0.0;
  var den = 0.0;
  for (var c = 0u; c < nChunks; c = c + 1u) {
    let md = partialMD[qh * ${MAX_CHUNKS}u + c];
    let w = exp(md.x - gmax);
    acc = acc + partial[(qh * ${MAX_CHUNKS}u + c) * ${HEAD_DIM}u + d] * w;
    den = den + md.y * w;
  }
  output[qh * ${HEAD_DIM}u + d] = acc / max(den, 1e-20);
}`;
  K.combineSliding = combine(true);
  K.combineFull = combine(false);

  // Generic 2-bit ternary GEMV over the full hidden state (used for o_proj).
  K.gemv2 = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> input: array<f32>;
@group(1) @binding(1) var<storage, read> weights: array<vec4<u32>>;
@group(1) @binding(2) var<storage, read> alpha: array<f32>;
@group(1) @binding(3) var<storage, read_write> output: array<f32>;
var<workgroup> shared_: array<f32, ${HIDDEN}>;
${sum}${DOT16}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  for (var i = l.x; i < ${HIDDEN}u; i = i + 256u) { shared_[i] = input[i]; }
  workgroupBarrier();
  let lane = l.x & 31u;
  let row = g.x * 8u + (l.x >> 5u);
  let acc = dot64(weights[row * 32u + lane], lane * 64u);
  let total = teamSum(acc, l.x);
  if (lane == 0u) { output[row] = total * alpha[row]; }
}`;

  // Router logits. The gate stays BF16 on the GPU and widens in-shader, which is
  // exactly what the reference does (it accumulates the gemv in float32).
  K.router = /* wgsl */ `${enable}${STEP}${BF16}
@group(1) @binding(0) var<storage, read> input: array<f32>;
@group(1) @binding(1) var<storage, read> weights: array<vec4<u32>>;
@group(1) @binding(2) var<storage, read_write> output: array<f32>;
var<workgroup> shared_: array<f32, ${HIDDEN}>;
${sum}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  for (var i = l.x; i < ${HIDDEN}u; i = i + 256u) { shared_[i] = input[i]; }
  workgroupBarrier();
  let lane = l.x & 31u;
  let row = g.x * 8u + (l.x >> 5u);
  var acc = 0.0;
  for (var w = lane; w < 256u; w = w + 32u) {
    let p = weights[row * 256u + w];
    let b = w * 8u;
    acc = acc + shared_[b] * bf16lo(p.x) + shared_[b + 1u] * bf16hi(p.x)
              + shared_[b + 2u] * bf16lo(p.y) + shared_[b + 3u] * bf16hi(p.y)
              + shared_[b + 4u] * bf16lo(p.z) + shared_[b + 5u] * bf16hi(p.z)
              + shared_[b + 6u] * bf16lo(p.w) + shared_[b + 7u] * bf16hi(p.w);
  }
  let total = teamSum(acc, l.x);
  if (lane == 0u) { output[row] = total; }
}`;

  // Top-8 over 256 experts, then softmax across the selection. The reference
  // softmaxes all 256 and renormalizes the top 8, which is identical.
  // Selection runs one thread per expert; the old kernel did this serially on a
  // single lane, 16k iterations deep, 24 times per token.
  K.routerTopK = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> logits: array<f32>;
@group(1) @binding(1) var<storage, read_write> indices: array<u32>;
@group(1) @binding(2) var<storage, read_write> scores: array<f32>;
var<workgroup> partMax: array<f32, 8>;
var<workgroup> partIdx: array<u32, 8>;
var<workgroup> selVal: array<f32, ${TOPK}>;
var<workgroup> selIdx: array<u32, ${TOPK}>;
${subgroups ? "" : `
var<workgroup> rmax: array<f32, 256>;
var<workgroup> ridx: array<u32, 256>;`}
@compute @workgroup_size(${EXPERTS})
fn main(@builtin(local_invocation_id) l: vec3<u32>) {
  let e = l.x;
  let sg = e >> 5u;
  let lane = e & 31u;
  var v = logits[e];
  for (var k = 0u; k < ${TOPK}u; k = k + 1u) {
${subgroups ? `
    let sm = subgroupMax(v);
    if (lane == 0u) { partMax[sg] = sm; }
    workgroupBarrier();
    var gmax = partMax[0];
    for (var i = 1u; i < 8u; i = i + 1u) { gmax = max(gmax, partMax[i]); }
    let cand = select(${EXPERTS}u, e, v == gmax);
    let smin = subgroupMin(cand);
    if (lane == 0u) { partIdx[sg] = smin; }
    workgroupBarrier();
    var gidx = partIdx[0];
    for (var i = 1u; i < 8u; i = i + 1u) { gidx = min(gidx, partIdx[i]); }
` : `
    rmax[e] = v;
    ridx[e] = e;
    workgroupBarrier();
    for (var s = 128u; s > 0u; s = s >> 1u) {
      if (e < s) {
        let o = e + s;
        if (rmax[o] > rmax[e] || (rmax[o] == rmax[e] && ridx[o] < ridx[e])) {
          rmax[e] = rmax[o];
          ridx[e] = ridx[o];
        }
      }
      workgroupBarrier();
    }
    let gmax = rmax[0];
    let gidx = ridx[0];
`}
    if (e == 0u) { selVal[k] = gmax; selIdx[k] = gidx; }
    if (e == gidx) { v = -3.402823e+38; }
    workgroupBarrier();
  }
  if (e == 0u) {
    let top = selVal[0];
    var total = 0.0;
    for (var k = 0u; k < ${TOPK}u; k = k + 1u) {
      let s = exp(selVal[k] - top);
      scores[k] = s;
      total = total + s;
    }
    for (var k = 0u; k < ${TOPK}u; k = k + 1u) {
      scores[k] = scores[k] / total;
      indices[k] = selIdx[k];
    }
  }
}`;

  // Expert up and gate in one pass, then the reference's clamped SwiGLU:
  // silu(min(gate, 7)) * clamp(up, -7, 7). Those clamps are part of the trained
  // forward pass, not a guard.
  K.expertUpGate = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> input: array<f32>;
@group(1) @binding(1) var<storage, read> indices: array<u32>;
@group(1) @binding(2) var<storage, read> upWeights: array<vec4<u32>>;
@group(1) @binding(3) var<storage, read> upAlpha: array<f32>;
@group(1) @binding(4) var<storage, read> gateWeights: array<vec4<u32>>;
@group(1) @binding(5) var<storage, read> gateAlpha: array<f32>;
@group(1) @binding(6) var<storage, read_write> output: array<f32>;
var<workgroup> shared_: array<f32, ${HIDDEN}>;
${sum}${DOT16}
fn silu(x: f32) -> f32 { return x / (1.0 + exp(-x)); }
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  for (var i = l.x; i < ${HIDDEN}u; i = i + 256u) { shared_[i] = input[i]; }
  workgroupBarrier();
  let lane = l.x & 31u;
  let row = g.x * 8u + (l.x >> 5u);
  let slot = g.y;
  let rowIndex = indices[slot] * ${EDIM}u + row;
  let base = lane * 64u;
  let up = teamSum(dot64(upWeights[rowIndex * 32u + lane], base), l.x);
  let gate = teamSum(dot64(gateWeights[rowIndex * 32u + lane], base), l.x);
  if (lane == 0u) {
    let upValue = clamp(up * upAlpha[rowIndex], -7.0, 7.0);
    let gateValue = min(gate * gateAlpha[rowIndex], 7.0);
    output[slot * ${EDIM}u + row] = silu(gateValue) * upValue;
  }
}`;

  // Expert down projection, weighted by the router scores. All eight experts'
  // hidden vectors are staged once up front; the previous version reloaded them
  // per row and paid ~224 barriers per workgroup for it.
  K.expertDown = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> input: array<f32>;
@group(1) @binding(1) var<storage, read> indices: array<u32>;
@group(1) @binding(2) var<storage, read> scores: array<f32>;
@group(1) @binding(3) var<storage, read> weights: array<u32>;
@group(1) @binding(4) var<storage, read> alpha: array<f32>;
@group(1) @binding(5) var<storage, read_write> output: array<f32>;
var<workgroup> shared_: array<f32, ${TOPK * EDIM}>;
${sum}${DOT16}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  for (var i = l.x; i < ${TOPK * EDIM}u; i = i + 256u) { shared_[i] = input[i]; }
  workgroupBarrier();
  let lane = l.x & 31u;
  let row = g.x * 8u + (l.x >> 5u);
  var combined = 0.0;
  for (var slot = 0u; slot < ${TOPK}u; slot = slot + 1u) {
    let rowIndex = indices[slot] * ${HIDDEN}u + row;
    let acc = dot16(weights[rowIndex * 32u + lane], slot * ${EDIM}u + lane * 16u);
    let total = teamSum(acc, l.x);
    if (lane == 0u) { combined = combined + total * alpha[rowIndex] * scores[slot]; }
  }
  if (lane == 0u) { output[row] = combined; }
}`;

  // 4-bit affine language head over the full vocabulary. Each vec4 load covers
  // 32 codes, which sit inside a single quantization group, so the scale and bias
  // are fetched once per load.
  K.lmHead = /* wgsl */ `${enable}${STEP}${BF16}
@group(1) @binding(0) var<storage, read> input: array<f32>;
@group(1) @binding(1) var<storage, read> weights: array<vec4<u32>>;
@group(1) @binding(2) var<storage, read> scales: array<u32>;
@group(1) @binding(3) var<storage, read> biases: array<u32>;
@group(1) @binding(4) var<storage, read_write> output: array<f32>;
var<workgroup> shared_: array<f32, ${HIDDEN}>;
${sum}
fn code8(w: u32, base: u32) -> vec2<f32> {
  var c = 0.0;
  var x = 0.0;
  for (var i = 0u; i < 8u; i = i + 1u) {
    let v = shared_[base + i];
    c = c + v * f32((w >> (i * 4u)) & 15u);
    x = x + v;
  }
  return vec2<f32>(c, x);
}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  for (var i = l.x; i < ${HIDDEN}u; i = i + 256u) { shared_[i] = input[i]; }
  workgroupBarrier();
  let lane = l.x & 31u;
  let team = l.x >> 5u;
  for (var r = 0u; r < 4u; r = r + 1u) {
    let row = g.x * 32u + team * 4u + r;
    var acc = 0.0;
    for (var w = lane; w < 64u; w = w + 32u) {
      let p = weights[row * 64u + w];
      let gi = row * 32u + (w >> 1u);
      let sw = scales[gi >> 1u];
      let bw = biases[gi >> 1u];
      let even = (gi & 1u) == 0u;
      let sc = select(bf16hi(sw), bf16lo(sw), even);
      let bi = select(bf16hi(bw), bf16lo(bw), even);
      let b = w * 32u;
      let s = code8(p.x, b) + code8(p.y, b + 8u) + code8(p.z, b + 16u) + code8(p.w, b + 24u);
      acc = acc + sc * s.x + bi * s.y;
    }
    let total = teamSum(acc, l.x);
    if (lane == 0u) { output[row] = total; }
  }
}`;

  // Sampling. Pass 1 reduces the max logit, pass 2 picks the winner. Sampling is
  // Gumbel-max, which draws exactly from softmax(logits / temperature) in a
  // single parallel pass with no sort, and min-p is a pure threshold on the same
  // scale. temperature == 0 degenerates to argmax.
  const SAMPLER = /* wgsl */ `
struct Sampler { temperature: f32, minP: f32, salt: u32, mode: u32 };
fn hash(x: u32) -> u32 {
  var v = x * 747796405u + 2891336453u;
  v = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u;
  return (v >> 22u) ^ v;
}
fn uniformRand(i: u32, salt: u32) -> f32 {
  return max(f32(hash(i ^ (salt * 2654435761u))) * 2.3283064e-10, 1e-9);
}
`;

  K.logitsMax = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> logits: array<f32>;
@group(1) @binding(1) var<storage, read_write> partial: array<f32>;
var<workgroup> red: array<f32, 256>;
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  var best = -3.402823e+38;
  for (var i = g.x * 256u + l.x; i < ${VOCAB}u; i = i + ${SAMPLE_WG * 256}u) { best = max(best, logits[i]); }
  red[l.x] = best;
  workgroupBarrier();
  for (var s = 128u; s > 0u; s = s >> 1u) {
    if (l.x < s) { red[l.x] = max(red[l.x], red[l.x + s]); }
    workgroupBarrier();
  }
  if (l.x == 0u) { partial[g.x] = red[0]; }
}`;

  K.sampleScan = /* wgsl */ `${enable}${STEP}${SAMPLER}
@group(1) @binding(0) var<storage, read> logits: array<f32>;
@group(1) @binding(1) var<storage, read> maxPartial: array<f32>;
@group(1) @binding(2) var<storage, read_write> bestValue: array<f32>;
@group(1) @binding(3) var<storage, read_write> bestIndex: array<u32>;
@group(1) @binding(4) var<uniform> cfg: Sampler;
var<workgroup> rv: array<f32, 256>;
var<workgroup> ri: array<u32, 256>;
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) g: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  rv[l.x] = select(-3.402823e+38, maxPartial[l.x], l.x < ${SAMPLE_WG}u);
  workgroupBarrier();
  for (var s = 128u; s > 0u; s = s >> 1u) {
    if (l.x < s) { rv[l.x] = max(rv[l.x], rv[l.x + s]); }
    workgroupBarrier();
  }
  let gmax = rv[0];
  workgroupBarrier();
  let greedy = cfg.temperature <= 0.0;
  let invT = select(1.0 / cfg.temperature, 1.0, greedy);
  let cutoff = select(gmax * invT + log(max(cfg.minP, 1e-9)), -3.402823e+38, greedy || cfg.minP <= 0.0);
  let salt = cfg.salt ^ (step.position * 0x9e3779b9u);

  var bv = -3.402823e+38;
  var bi = ${VOCAB}u;
  for (var i = g.x * 256u + l.x; i < ${VOCAB}u; i = i + ${SAMPLE_WG * 256}u) {
    let z = logits[i] * invT;
    if (z < cutoff) { continue; }
    var score = z;
    if (!greedy) {
      score = z - log(-log(uniformRand(i, salt)));
    }
    if (score > bv || (score == bv && i < bi)) { bv = score; bi = i; }
  }
  rv[l.x] = bv;
  ri[l.x] = bi;
  workgroupBarrier();
  for (var s = 128u; s > 0u; s = s >> 1u) {
    if (l.x < s) {
      let o = l.x + s;
      if (rv[o] > rv[l.x] || (rv[o] == rv[l.x] && ri[o] < ri[l.x])) { rv[l.x] = rv[o]; ri[l.x] = ri[o]; }
    }
    workgroupBarrier();
  }
  if (l.x == 0u) { bestValue[g.x] = rv[0]; bestIndex[g.x] = ri[0]; }
}`;

  // Final reduction writes the sampled id straight into the tokens buffer at the
  // next position, so a run of decode steps can be queued without the CPU ever
  // seeing the intermediate ids.
  K.sampleFinal = /* wgsl */ `${enable}${STEP}
@group(1) @binding(0) var<storage, read> bestValue: array<f32>;
@group(1) @binding(1) var<storage, read> bestIndex: array<u32>;
@group(1) @binding(2) var<storage, read_write> tokens: array<u32>;
var<workgroup> rv: array<f32, ${SAMPLE_WG}>;
var<workgroup> ri: array<u32, ${SAMPLE_WG}>;
@compute @workgroup_size(${SAMPLE_WG})
fn main(@builtin(local_invocation_id) l: vec3<u32>) {
  rv[l.x] = bestValue[l.x];
  ri[l.x] = bestIndex[l.x];
  workgroupBarrier();
  for (var s = ${SAMPLE_WG / 2}u; s > 0u; s = s >> 1u) {
    if (l.x < s) {
      let o = l.x + s;
      if (rv[o] > rv[l.x] || (rv[o] == rv[l.x] && ri[o] < ri[l.x])) { rv[l.x] = rv[o]; ri[l.x] = ri[o]; }
    }
    workgroupBarrier();
  }
  if (l.x == 0u) { tokens[step.position + 1u] = ri[0]; }
}`;

  return K;
}
