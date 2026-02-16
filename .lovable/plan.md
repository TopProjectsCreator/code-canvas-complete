

## Fix: Code Editor Text Selection Alignment

### The Root Problem

The current editor uses a **dual-layer approach**: a visible syntax-highlighted `div` underneath a transparent `textarea` on top. The user types into the invisible textarea while seeing the colored div below. This architecture is inherently fragile because:

- Browsers render text inside `<textarea>` and `<div>` elements with subtle differences (internal padding, border-box behavior, scroll mechanics)
- Each fix to one axis (horizontal/vertical) breaks the other
- This is why we keep going back and forth -- there is no perfect pixel alignment between textarea and div across all cases

### The Solution

Replace the dual-layer textarea+div overlay with a **single-layer contentEditable approach**, or more practically, use a single `<div>` with `contentEditable` for both editing and display. This eliminates the alignment problem entirely because there is only one element rendering text.

### Implementation Steps

1. **Remove the textarea entirely** -- no more invisible overlay
2. **Make the syntax-highlighted div contentEditable** -- it becomes both the display and the input
3. **Handle input events** on the contentEditable div to capture text changes and re-tokenize/re-render
4. **Preserve cursor position** across re-renders using `Selection` and `Range` APIs
5. **Keep existing features working**: Find/Replace, keyboard shortcuts, scroll sync, cursor position in status bar

### Technical Details

**File: `src/components/ide/CodeEditor.tsx`**

- Remove the `<textarea>` element and `textareaRef`
- Change the highlight `<div>` from `pointer-events-none` to `contentEditable="true"`
- Add `onInput` handler that reads `innerText` from the div, updates state, and re-renders with syntax highlighting
- Add cursor save/restore logic using `window.getSelection()` to maintain caret position after React re-renders the tokenized content
- Update `handleSelect` to work with the contentEditable div instead of textarea
- Update scroll sync (no longer needed since there is only one scrollable element)
- Update Find/Replace scroll-to-match logic to work with the single div

**File: `src/index.css`**

- No changes needed; `.code-line` styles remain the same

### Risk Mitigation

- `contentEditable` can have quirks with newlines and paste behavior -- we will handle `onKeyDown` for Enter/Tab and `onPaste` to normalize input
- IME (international keyboard) support via `onCompositionStart`/`onCompositionEnd`
- The existing `spellCheck={false}` attribute will be carried over

This is a one-time fix that permanently eliminates the alignment problem rather than continuing to adjust pixel offsets.

