# Whiteboard cards: match the target sketch

The current cards are wide empty rectangles with a line of tiny text at the top and images reduced to `[image] <url>` text. The target is content-shaped cards: a highlighted title chip, real embedded images, wrapped body text, author lines, and arrows connecting parent to reply.

## What changes

1. **Real images instead of `[image] url` text**
   - Extract image URLs from thread/comment HTML (`<img src>` and markdown `![]()`).
   - Fetch each URL, convert to a data URL, and register it as an Excalidraw *file* (`addFiles`) plus an `image` element inside the card.
   - Cache by URL so the same image is only fetched/uploaded once; keep the file map incremental so the existing save-payload guard still holds (only new file blobs get sent).
   - If a fetch fails (CORS/404), fall back to the current text form for that one image only.

2. **Cards sized to their content, not fixed giant boxes**
   - Layout pass per card: title chip → body text block → image row → author line, stacking with real measured heights, then the rectangle height is the sum plus padding.
   - Images laid out to the right of the text block when there is body text (as in the sketch), stacked below when the text is short; capped to a max width/height with aspect ratio preserved.
   - No more 140px of dead space under short text.

3. **Title chip on the thread card**
   - The thread title (with category prefix) becomes its own small rounded rectangle at top-left with a light blue fill and blue text, matching the sketch. The post body renders as plain text beneath/next to it.

4. **Author lines on replies**
   - `@handle:` on its own first line, body text under it, images beside it — same as the sketch.

5. **Arrows**
   - Keep bound parent→child arrows, but route them from the parent card's bottom/right edge to the child's top/left edge with the new content-shaped geometry so they no longer overlap card bodies.

6. **Grouping**
   - Each card's rectangle, text elements and images share a `groupId` so dragging a card moves its contents together.

## Applies to
- New clusters rendered on load (`buildThreadCluster`)
- New replies appended live (`buildCommentCard`)
- Existing cramped cards stay untouched unless you want a one-time re-layout of the board — say the word and I'll add a "Rebuild layout" action for admins.

## Technical notes
- `src/lib/threadWhiteboardCards.ts`: card builders become async (image fetch), returning `{ elements, files, height }`; add `extractImageUrls`, `urlToFileData`, and a shared measure/stack helper. Text elements are emitted directly (not via `label`) so multi-block layout is possible.
- `src/pages/threads/GlobalWhiteboard.tsx` and `src/components/threads/ThreadWhiteboard.tsx`: await the builders, pass returned files to `addFiles`, and merge them into the new-files set used by `save_global_whiteboard_scene` / `save_thread_whiteboard_scene`.
- Image bytes are downscaled (max ~1000px wide, JPEG/PNG re-encode) before becoming data URLs, so the scene does not grow back toward the 9 MB failure point.
