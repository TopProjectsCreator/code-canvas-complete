/**
 * Syncs the pinned @wllama/wllama browser assets into public/wllama/ so the
 * GGUF worker (public/workers/gguf-llm-worker.js) loads version-pinned,
 * same-origin runtime files instead of depending on a CDN at inference time.
 *
 * Source of truth: node_modules/@wllama/wllama (v3.6.1, stock upstream build).
 * That build supports bailingmoe3 (Ling-3.0-tiny-GGUF, official) but does NOT
 * contain the `maple` architecture — Maple loads will fail with an explicit
 * unsupported-architecture error until a Maple-capable WASM (built from the
 * official deepgrove-ai/llama.cpp fork) is provided via MAPLE_WASM_URLS.
 *
 * Usage: node scripts/sync-wllama-assets.mjs
 */
import { copyFileSync, mkdirSync, existsSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const WLLAMA_VERSION = '3.6.1';

const copies = [
  ['node_modules/@wllama/wllama/esm/index.js', 'public/wllama/index.js'],
];

let failed = false;
for (const [srcRel, dstRel] of copies) {
  const src = path.join(root, srcRel);
  const dst = path.join(root, dstRel);
  if (!existsSync(src)) {
    console.error(`[sync-wllama-assets] MISSING: ${srcRel} — run npm install first`);
    failed = true;
    continue;
  }
  mkdirSync(path.dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  const kb = Math.round(statSync(dst).size / 1024);
  console.log(`[sync-wllama-assets] ${srcRel} -> ${dstRel} (${kb} KB)`);
}

// The 8MB wllama.wasm binary is also self-hosted so inference has no runtime
// CDN dependency. Re-copy it whenever the pinned version changes.
const wasmSrc = path.join(root, 'node_modules/@wllama/wllama/src/wasm/wllama.wasm');
const wasmDst = path.join(root, 'public/wllama/wllama.wasm');
if (existsSync(wasmSrc)) {
  copyFileSync(wasmSrc, wasmDst);
  console.log(`[sync-wllama-assets] wllama.wasm -> public/wllama/wllama.wasm (${Math.round(statSync(wasmDst).size / 1024)} KB)`);
} else {
  console.error('[sync-wllama-assets] MISSING wllama.wasm — worker will fall back to CDN');
  failed = true;
}

console.log(`[sync-wllama-assets] done (pinned @wllama/wllama@${WLLAMA_VERSION})`);
process.exit(failed ? 1 : 0);
