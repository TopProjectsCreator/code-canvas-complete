

## Root Cause Analysis

After 6+ failed attempts using HTML5 drag-and-drop (`dragstart`/`dragover`/`drop` + `dataTransfer`), reporters still won't snap into slots. The session replay confirms why: the workspace uses **pointer-based dragging** (`onPointerDown`/`onPointerMove` with `setPointerCapture`), not HTML5 drag. Evidence:

- Session replay shows `cursor-grab` + manual `left`/`top` style updates (pointer drag), NOT native drag ghost
- Memory `mem://features/scratch-blocks-engine` explicitly states: *"custom pointer-based drag-and-drop system (replacing the native HTML5)"*
- Console logs show ZERO `[scratch-drop]` events firing — because no `drop` event ever happens
- Highlighting works because it's driven by `pointermove`, but the "drop" handler is on `dragend`/`drop` which never fires

The HTML5 `dataTransfer` payload only exists for flyout→workspace drags. Workspace→workspace reporter moves use pointer events with internal state (`dragBlockId`), and the `pointerup` handler never checks for slot targets — it just drops the block at the cursor position as a free-floating stack.

## The Guaranteed Fix

Stop relying on HTML5 drop events entirely. Hook into the **existing pointer-up handler** that already runs at the end of every drag (both flyout and workspace).

### Changes to `src/components/scratch/ScratchPanel.tsx`

1. **Locate the global `pointerup` handler** that finalizes block drags (where `dragBlockId` is cleared and the block is committed to its new position).

2. **Before committing the position**, if the dragged block's shape is `reporter` or `boolean`:
   - Convert pointer client coords → workspace coords (subtract workspace `getBoundingClientRect()`, divide by `workspaceZoom`)
   - Call `findSlotDropTarget(blocks, x, y, shape, excludeSet)` with the dragged block excluded
   - If a target slot is found → call `attachReporterToSlot(draggedBlockData, target.blockId, target.inputKey)` and SKIP the normal "place at x,y" logic
   - Else → fall through to normal placement

3. **For flyout drags** (which currently use HTML5): convert them to pointer-based too by starting a synthetic pointer drag on `pointerdown` of flyout items, so the same unified `pointerup` handler resolves them. This eliminates the dual-path complexity.

4. **Remove all the failed HTML5 patches**: `onDragOver`/`onDrop` on block divs, `isHtml5Dragging` window listeners, `handleWorkspaceDrop` HTML5 path. Keep only pointer logic.

5. **Visual confirmation**: When `findSlotDropTarget` returns a hit during pointer drag, set a `hoveredSlot` state and render a 3px solid blue outline on that slot's bounding rect (replaces current yellow tint which is misleading).

### Why this is guaranteed to work
- The pointer-up handler is **already firing today** (that's how blocks get placed when you drop them on empty workspace). We're just adding a slot-check branch before the placement step.
- No browser drag-cancel quirks, no z-index/pointer-events interference from `ShadowInput` overlays, no `dataTransfer` payloads to lose.
- Single code path for flyout + workspace drags.

### Files
- `src/components/scratch/ScratchPanel.tsx` (only file)

### Out of scope (unrelated noise in logs)
- `pen.*` translation warnings — cosmetic, ignore
- `lovable.dev` postMessage origin error — Lovable script, not ours
- `scratch-audio` constructor error — pre-existing, unrelated
- "No V2 Bitmap adapter" — pre-existing costume loader warning

