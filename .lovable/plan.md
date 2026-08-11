# Why thread images are not appearing on the whiteboard

## What I verified in the live data

1. **The card generator itself works.** Running the real GPU thread's stored content through the current builder produces a card containing a real embedded image plus its binary file. So the code that turns thread images into whiteboard images is not broken.

2. **The placeholder text is not in your data.** The string "Short body" does not exist anywhere: not in the live board, not in any board snapshot, not in any thread or reply, and not anywhere in the codebase. It came from a throwaway preview fixture of mine that no longer exists. Nothing on your real board contains it.

3. **The real defect: existing thread cards are generated once and never refreshed.** The board loader only adds a card for a thread that has no card yet. Every thread that already has a card is skipped entirely, forever. All four image-carrying threads on the board have cards created by an older version of the generator, from before image embedding existed, so those cards contain only a title rectangle and text. Adding an image to a thread afterwards can never reach its card. Confirmed: no generated card element on the live board carries an image at all.

4. **Second real defect: one image on the board has lost its binary data.** There is an image element roughly 853px wide whose file reference no longer exists in the board's stored files. Excalidraw has nothing to draw, so that element renders as an empty box. The save path only stores files it considers new, so a file added by one browser session can be dropped when another session saves, permanently orphaning the image.

## Fix

1. **Refresh a thread's card when its content changes**
   - Track a content fingerprint on each generated thread card.
   - On board load and on live thread updates, compare the fingerprint against the thread's current title, body, and images.
   - When it differs, regenerate only that thread's card in place, at its existing position, and drop the stale one.
   - Same treatment for reply cards whose content changed.

2. **Stop losing image binaries**
   - On save, include the binary for every referenced image that the stored board does not already have, instead of only the ones this session created.
   - On load, detect image elements whose binary is missing and re-fetch it from the original thread or reply image, so an orphaned image repairs itself.

3. **Never substitute text for a failed image**
   - When a thread body is only images, the card must be image-only, with no filler text.
   - If an image genuinely cannot be fetched, keep a clearly marked missing-image note rather than silently producing an empty-looking card.

4. **Repair the current board without disturbing your work**
   - Refresh only the four generated thread cards so they embed their real images.
   - Re-attach the binary for the orphaned image element.
   - Leave every element you placed or arranged yourself exactly where it is; no full-board rebuild, no repositioning.

## Verification

- Each generated thread card that has an image in its post contains an image element with matching binary data.
- No image element on the board references a missing binary.
- Editing a thread to add an image updates its card automatically, without a manual rebuild.
- After reload, images persist and your manually arranged elements keep their positions.
