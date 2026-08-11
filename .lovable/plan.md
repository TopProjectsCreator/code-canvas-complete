# Fix new threads not appearing on the whiteboard

## Confirmed cause

New thread cards are currently generated only in one browser's memory, not reliably written to the shared whiteboard:

- **When the whiteboard opens:** missing threads are built and added to `initialData`, but those additions are never persisted to the database or broadcast.
- **When a new thread arrives live:** the handler builds the card and calls `updateScene`, while `applyingRemoteRef` suppresses the normal save callback. The handler then ends without calling `persist` or broadcasting the new scene.
- Therefore a new thread can briefly exist for one open browser, disappear after reload, and never appear for other viewers. It only becomes saved accidentally if a later unrelated board edit writes the whole scene.

The latest thread happens to exist in the current saved board now, but the code paths above explain why new threads do not appear reliably when created.

## Fix

1. **Persist startup reconciliation**
   - After building missing thread/reply cards during initial load, save the merged scene and generated image files once the whiteboard API is ready.
   - Broadcast the merged scene so already-open viewers receive it.

2. **Persist live new-thread cards immediately**
   - After the thread insert handler adds the generated cluster, explicitly save the resulting elements and files.
   - Broadcast the saved scene after success.
   - Show a visible error if generation or persistence fails instead of silently dropping the card.

3. **Make creation race-safe**
   - Before saving, re-read the current scene elements from the Excalidraw API and deduplicate by thread ID.
   - Prevent two open clients from producing duplicate cards for the same new thread.

4. **Preserve user-created work**
   - Append only the missing generated cluster.
   - Do not rebuild, reposition, or delete any existing manually arranged images, arrows, or drawings.

## Verification

- Create a new text thread: its card appears automatically and survives reload.
- Create a new image-only thread: its card includes the real image and survives reload.
- Open the whiteboard in a second browser: both new cards appear without drawing or refreshing.
- Confirm each thread ID has exactly one generated card and all manual elements retain their positions.
