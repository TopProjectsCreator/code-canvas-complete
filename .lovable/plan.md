# Fix automatic images in thread cards

## Exact issue

The previous verification was invalid: it used a fake text fixture containing “Short body” instead of the real image-only thread content. That fixture proved only that text cards render; it did not test automatic images.

On the real whiteboard:

- The small GPU card containing only “QOTD: Should we add GPU support?” is the automatically generated card.
- Its thread body contains only a real uploaded PNG.
- The automatic card contains no image element.
- The large images elsewhere on the board were manually added and arranged by the user; they are not evidence that automatic image generation works.

## Fix and verify

1. Use the real GPU thread row—its exact stored HTML image tag and uploaded PNG—as the test case. Do not use sample text, fixtures, or “Short body.”
2. Trace the real new-thread flow from the inserted thread payload through image URL extraction, image fetching/decoding, card construction, `addFiles`, and scene persistence. Capture the first step where the real image disappears.
3. Fix that exact failing step so an image-only thread creates an automatic card containing an Excalidraw image element and its matching binary file.
4. Regenerate only the small automatic GPU card at its existing position. Do not touch, move, replace, or treat the manually added images as generated content.
5. Verify by inspecting the resulting saved scene—not a mock page:
   - the GPU automatic card has an image element;
   - the image element's file ID exists in the saved scene files;
   - the image is visibly rendered inside the small automatic card;
   - a newly created image-only thread produces the same result automatically;
   - the result survives reload.
