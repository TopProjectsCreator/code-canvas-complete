

## Make the Scratch VM Fully Functional

### Problem
The current Scratch VM integration only instantiates `scratch-vm` and calls `start()`/`greenFlag()`, but never attaches the three required companion modules: **renderer**, **storage**, and **audio engine**. Without these, scripts execute blindly with no visual output, assets fail to load, and sounds do not play.

### Architecture

The Scratch ecosystem requires four packages working together:

```text
scratch-vm  (already installed)
  ├── attachRenderer()   ←  scratch-render  (WebGL canvas)
  ├── attachStorage()    ←  scratch-storage  (asset loading)
  └── attachAudioEngine() ← scratch-audio   (Web Audio API)
```

### Plan

**1. Install missing packages**

Add `scratch-render`, `scratch-storage`, and `scratch-audio` as dependencies. These are the official Scratch Foundation packages that `scratch-vm` already declares as peer/bundled dependencies.

**2. Rewrite VM initialization in ScratchPanel.tsx**

Replace the current bare `new VirtualMachine(); vm.start()` with proper setup:

- Create a `<canvas>` element (480x360, the standard Scratch stage size) in the preview area, replacing the current emoji/image placeholder.
- Instantiate `ScratchRender(canvas)` and call `vm.attachRenderer(renderer)`.
- Instantiate `ScratchStorage()`, register a custom web source that resolves asset URLs from the in-memory `archive.files` map (base64 decode), then call `vm.attachStorage(storage)`.
- Instantiate `AudioEngine()` and call `vm.attachAudioEngine(audioEngine)`.
- Start a `requestAnimationFrame` draw loop calling `renderer.draw()`.
- On `greenFlag()`, the VM will now actually execute scripts with visual and audio feedback.

**3. Replace the placeholder preview with a real canvas**

The right-side stage panel (lines 1176-1189) currently shows a positioned emoji. Replace with:
- A `<canvas ref={canvasRef} width={480} height={360} />` element.
- The renderer draws directly to this canvas.
- Remove the manual `stagePreview` x/y/direction state — instead read sprite properties from the renderer or VM runtime targets in the draw loop.

**4. Wire up syncFromVm for real-time sprite property display**

Keep the sprite info panel (x, y, size, direction) but read values from `vm.runtime.targets` during the animation frame callback instead of the current 120ms interval, which is unreliable.

**5. Fix project loading flow**

- When the archive changes, export it to `.sb3` ArrayBuffer and call `vm.loadProject(ab)` as currently done — but now with storage attached, the VM can actually resolve costume/sound assets from the archive.
- The custom storage web source will intercept asset requests and serve them from the base64 `archive.files` map, so no network requests are needed.

**6. Add type declarations**

Create `src/vite-env-scratch-render.d.ts`, `src/vite-env-scratch-audio.d.ts`, `src/vite-env-scratch-storage.d.ts` module declarations since these packages lack TypeScript types.

**7. Handle cleanup**

On unmount: stop the animation frame loop, call `renderer.destroy()` if available, disconnect audio engine, and `vm.stopAll()`.

### Technical Details

**Custom storage adapter** (key piece for offline/in-memory asset loading):
```typescript
const storage = new ScratchStorage();
const AssetType = storage.AssetType;

// Register a "web source" that reads from archive.files
storage.addWebStore(
  [AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound],
  (asset) => {
    // Return a data URI or handle via the archive's base64 map
    const key = `${asset.assetId}.${asset.dataFormat}`;
    const b64 = currentArchiveRef.current?.files?.[key];
    if (b64) return `data:application/octet-stream;base64,${b64}`;
    return ''; // fallback
  }
);
vm.attachStorage(storage);
```

**Render loop:**
```typescript
const drawStep = () => {
  renderer.draw();
  rafId = requestAnimationFrame(drawStep);
};
drawStep();
```

### Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `scratch-render`, `scratch-storage`, `scratch-audio` |
| `src/components/scratch/ScratchPanel.tsx` | Major rewrite of VM init, preview canvas, storage adapter, audio engine, draw loop |
| `src/vite-env-scratch-render.d.ts` | New type declaration |
| `src/vite-env-scratch-audio.d.ts` | New type declaration |
| `src/vite-env-scratch-storage.d.ts` | New type declaration |

