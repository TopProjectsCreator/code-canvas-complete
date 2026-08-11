# Fix: auto thread cards save the image element but not the image binary

## Confirmed root cause (verified against live data)

The GPU thread (`QOTD: Should we add GPU support?`) has image-only content. Its automatic card on the board contains a real image element with `fileId 4f3835e3479500465fd32dd9c4f638da8bc9c641`, but the saved `scene.files` map holds only 5 binaries and none of them is that id. An image element whose binary is missing renders as an empty box, so the card shows only its title text — that is the "no image" symptom.

Why the binary is lost, in `src/pages/threads/GlobalWhiteboard.tsx`:

- The `threads` INSERT handler (new-card branch) and the `comments` INSERT handler build the card, call `addFiles`, `updateScene`, and then stop. They never call `persist` or `broadcastScene`, and they set `applyingRemoteRef` so the canvas `onChange` save is suppressed.
- The element list therefore reaches the database later, on some unrelated edit or from another session, at a point where the freshly built binary is no longer in that client's file map. `persist` trims files to referenced ids, finds none for the new card, and writes the element with no binary.

## Fix

1. In the `threads` INSERT new-card branch and the `comments` INSERT handler, mirror the already-correct update branch: reset the save signature, build `allFiles` from `getFiles()` plus the freshly built files, then `await persist(...)` and `broadcastScene(...)`.
2. In `persist`, treat a referenced image id with no available binary as a save hazard: pull the binary from the canvas file map, and if it is still missing, skip writing that orphaned image element rather than persisting a permanently blank image.
3. Repair the existing board: rebuild the GPU card (and any other generated card whose image id has no binary) so its image is re-fetched and its binary is written in the same save.

## Verification

- Query the saved scene and confirm every `image` element's `fileId` has a matching key in `scene.files`.
- Load `/threads/whiteboard` and confirm the GPU card renders its uploaded PNG.
- Create a new image-only thread, confirm its card appears with the image and that both the element and its binary are in the database immediately, and that it survives a reload.
