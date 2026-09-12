# Vendored Maple WebGPU runtime — attribution

Files in this directory (`kernels.js`, `maple-runtime.js`) are vendored **byte-identical**
from the community demo Space:

- Source: https://huggingface.co/spaces/ProCreations/maple-webgpu (`src/`)
- Author: ProCreations (community project, not affiliated with DeepGrove)
- Weight pack it loads: https://huggingface.co/ProCreations/maple-preview-webgpu
  (MIT-licensed repack of DeepGrove's official `deepgrove/maple-preview` checkpoint;
  no model values requantized)
- Tokenizer/chat template: loaded at runtime from `deepgrove/maple-preview`
  (`tokenizer.json`, `tokenizer_config.json`, `chat_template.jinja`)

Do NOT hand-edit the vendored files — re-sync them verbatim from the Space so
future upstream fixes (kernel accuracy, Safari fallbacks) apply cleanly:

```bash
curl -sL -o src/vendor/maple/kernels.js \
  https://huggingface.co/spaces/ProCreations/maple-webgpu/resolve/main/src/kernels.js
curl -sL -o src/vendor/maple/maple-runtime.js \
  https://huggingface.co/spaces/ProCreations/maple-webgpu/resolve/main/src/maple-runtime.js
```

Our integration lives in `src/services/mapleWebGPU.ts` (loader, chat, cache,
device check) and imports only the runtime's public surface
(`MapleRuntime`, `KV_FORMATS`, `CONTEXT_CHOICES`, …).

License note: the weight pack is MIT. The runtime code ships with no explicit
license file upstream — permission was requested from the author (see project
tracker). If permission is ever withdrawn, replace this directory with an
`<iframe>` embed of the Space; the service API in `mapleWebGPU.ts` is shaped to
make that swap local.
