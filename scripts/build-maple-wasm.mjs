#!/usr/bin/env node
/**
 * Rebuilds the Maple CPU translator (wllama-compatible WASM from DeepGrove's
 * official llama.cpp fork) using only this machine + Docker.
 *
 * Why this exists: the stock @wllama/wllama runtime has no `maple` backend,
 * so slow machines without WebGPU need a fork-built translator. The app loads
 * it as a `wasmUrls` override (see MAPLE_CPU_WASM_URLS in
 * src/services/ggufLLM.ts) — the stock ESM wrapper stays untouched.
 *
 * Pinned inputs (reproducible):
 *   - wllama tag 3.6.1
 *   - deepgrove-ai/llama.cpp @ 7e30f3adb34b444c3527f94c3343612d71b47d0d (main)
 *   - emscripten/emsdk:4.0.20 (same image wllama's own scripts use)
 *   - emdawn v20260317.182325 (same tag wllama's own scripts use)
 *
 * Build flavor: WLLAMA_COMPAT=ON (asyncify, no mem64 — widest CPU support,
 * incl. Safari/Firefox school browsers), GGML_WEBGPU=ON in the binary but the
 * app always passes n_gpu_layers: 0 on this road, single config only (no
 * second build), -j2 to respect small builders.
 *
 * Known glue drift fixed here (wllama 3.6.1 glue vs newer fork server API):
 *   - tokenize_input_prompts / format_prompt_rerank lost their trailing
 *     mtmd options argument
 *   - server_queue::yield_to_queue / worker_stop no longer exist (dead shims
 *     removed; nothing references them)
 *   - callback_new_task takes only the task now (returns void)
 *   - common_fit_params moved to common/fit.h without the `extra` parameter
 * If a future fork breaks the compile again, the error will name the exact
 * wllama-context.h line — patch the same way and re-run.
 *
 * Usage: node scripts/build-maple-wasm.mjs [workdir]
 * Output: public/wllama-maple/wllama.wasm (+ .map next to it for debugging)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const workdir = process.argv[2] || path.join('/tmp', 'build-maple-wasm');
const src = path.join(workdir, 'wllama');
const outDir = path.join(root, 'public', 'wllama-maple');

const WLLAMA_TAG = '3.6.1';
const FORK_SHA = '7e30f3adb34b444c3527f94c3343612d71b47d0d';
const DAWN_TAG = 'v20260317.182325';

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });

const replaceOnce = (file, oldStr, newStr) => {
  const content = readFileSync(file, 'utf8');
  if (content.split(oldStr).length - 1 !== 1) {
    throw new Error(`Patch target not found exactly once in ${file}: ${oldStr.slice(0, 70)}…`);
  }
  writeFileSync(file, content.replace(oldStr, newStr));
};

// 0. Sources (idempotent — skips finished steps on re-run).
mkdirSync(workdir, { recursive: true });
if (!existsSync(path.join(src, 'CMakeLists.txt'))) {
  run('git', ['clone', '--branch', WLLAMA_TAG, '--depth', '1', '--no-recurse-submodules',
    'https://github.com/ngxson/wllama.git', src]);
}
const forkDir = path.join(src, 'llama.cpp');
if (!existsSync(path.join(forkDir, 'src', 'models', 'maple.cpp'))) {
  run('git', ['clone', '--depth', '1', 'https://github.com/deepgrove-ai/llama.cpp.git', forkDir]);
  run('git', ['-C', forkDir, 'fetch', '--depth', '1', 'origin', FORK_SHA]);
  run('git', ['-C', forkDir, 'checkout', FORK_SHA]);
}

// 1. Glue patches (documented in the header above; build tree only).
const glue = path.join(src, 'cpp', 'wllama-context.h');
replaceOnce(glue,
  'tokenize_input_prompts(vocab, nullptr, prompt, true, true, mtmd_helper_init_opt_default())',
  'tokenize_input_prompts(vocab, nullptr, prompt, true, true)');
replaceOnce(glue,
  'format_prompt_rerank(model, vocab, nullptr, query, document, mtmd_helper_init_opt_default())',
  'format_prompt_rerank(model, vocab, nullptr, query, document)');
replaceOnce(glue,
  `void server_queue::yield_to_queue(std::function<void()> &&work)
{
  // no worker thread in wllama, run the work inline
  work();
}

void server_queue::worker_stop()
{
  // no worker thread in wllama, so this is a no-op
}

`,
  '');
replaceOnce(glue,
  'GGML_ASSERT(callback_new_task(std::move(task), false));',
  'callback_new_task(std::move(task));');
replaceOnce(glue, '    const common_fit_extra_model *extra,\n', '');
// Keep full wasm export names: the stock JS wrapper looks them up by name
// (wllama_malloc, malloc, ...). emsdk 4.x minifies them by default, which only
// works with a matching regenerated JS glue — we reuse stock's. (Note: the
// MINIFY_WASM_EXPORT_NAMES knob is internal and rejected on the command line;
// DECLARE_ASM_MODULE_EXPORTS=0 is the supported way to disable it.)
replaceOnce(
  path.join(src, 'CMakeLists.txt'),
  '    -sUSE_PTHREADS=1\n    -pthread\n',
  '    -sUSE_PTHREADS=1\n    -pthread\n    -sDECLARE_ASM_MODULE_EXPORTS=0\n');

// 2. Compile (CPU-only flavor, single config, 2 jobs for small builders).
const buildSh = path.join(workdir, 'run-build.sh');
writeFileSync(buildSh, `#!/bin/bash
set -e
cd /source
mkdir -p build && cd build && mkdir -p emdawn
EMDAWNWEBGPU_DIR="/source/build/emdawn/emdawnwebgpu_pkg"
if [ ! -d "$EMDAWNWEBGPU_DIR" ]; then
  curl -L -o emdawn.zip "https://github.com/google/dawn/releases/download/${DAWN_TAG}/emdawnwebgpu_pkg-${DAWN_TAG}.zip"
  python3 -c "import zipfile; zf=zipfile.ZipFile('emdawn.zip','r'); zf.extractall('/source/build/emdawn'); zf.close()"
fi
mkdir -p /source/build-maple-cpu && cd /source/build-maple-cpu
emcmake cmake .. -DWLLAMA_COMPAT=ON -DLLAMA_WASM_MEM64=OFF -DGGML_WEBGPU=ON -DGGML_WEBGPU_JSPI=OFF -DEMDAWNWEBGPU_DIR="$EMDAWNWEBGPU_DIR" -DWLLAMA_TEST_BACKEND=OFF
emmake make wllama -j2
ls -lh wllama.wasm
`);
run('docker', ['run', '--rm', '-v', `${src}:/source`, '-v', `${workdir}:/build`,
  'emscripten/emsdk:4.0.20', 'bash', '/build/run-build.sh']);

// 3. Collect + verify.
mkdirSync(outDir, { recursive: true });
const wasm = path.join(src, 'build-maple-cpu', 'wllama.wasm');
copyFileSync(wasm, path.join(outDir, 'wllama.wasm'));
const bytes = readFileSync(path.join(outDir, 'wllama.wasm'));
const text = bytes.toString('latin1');
for (const needle of ['maple', 'wllama_malloc', 'bailingmoe']) {
  if (!text.includes(needle)) throw new Error(`Built translator is missing expected marker: ${needle}`);
}
const kb = Math.round(statSync(path.join(outDir, 'wllama.wasm')).size / 1024);
console.log(`[build-maple-wasm] public/wllama-maple/wllama.wasm (${kb} KB) — maple/bailingmoe markers present`);
