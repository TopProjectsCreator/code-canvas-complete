# Fix automatic thread image cards

## Confirmed current state

- The GPU thread’s database content is an image-only HTML post with a valid image URL.
- That image URL loads successfully in the browser as a PNG.
- The automatically generated whiteboard card currently contains only the title rectangle/text; it has no image element or file entry.
- The large images shown elsewhere on the board are manually placed content and must remain untouched.

## Plan

1. **Reproduce the generator failure with the real GPU thread data**
   - Run the card builder against the exact stored thread content.
   - Inspect image extraction, browser decoding/downscaling, generated Excalidraw image elements, and file registration to identify precisely where the image is dropped.

2. **Fix automatic image generation for every path**
   - Ensure image-only thread bodies produce a card containing the actual image, not placeholder/sample body text.
   - Apply the same behavior when loading existing threads, receiving a newly created thread, and receiving a later thread-content update.
   - Keep failed-image handling explicit without substituting fabricated content.

3. **Update generated cards without touching user work**
   - Give every generated card and child element stable ownership metadata.
   - Replace only the affected generated thread card when its content changes.
   - Preserve all manually arranged images, arrows, drawings, and other user-created elements.

4. **Repair the GPU card from its real database content**
   - Regenerate only the automatic GPU thread card at its current position using the real stored image.
   - Do not rebuild or rearrange the full whiteboard.

5. **Verify with real data**
   - Confirm the GPU card contains an Excalidraw image element and matching binary file entry.
   - Create or simulate a new image-only thread and verify it automatically renders its image.
   - Reload the board and verify the image remains while manually placed elements retain their positions.

## Technical constraints

- No test fixture or placeholder text may be written to the live board.
- No full-board rebuild or destructive scene replacement.
- Automatic generated content and user-created content must be distinguishable before any surgical replacement.
