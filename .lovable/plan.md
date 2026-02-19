## Fix: Line Numbers Not Scrolling With Code — RESOLVED

### Problem
Line numbers didn't scroll with code content.

### Root Cause
Gutter and code were in separate scroll contexts. JS-based `scrollTop` sync on `overflow-hidden` elements does nothing.

### Solution Applied
1. Single scrollable container wrapping both gutter and code (no JS sync needed)
2. Gutter uses `sticky left-0` to stay visible during horizontal scroll
3. Empty lines render as `<br>` instead of `<span>\n</span>` to prevent double-newline bugs in `textContent`
4. `white-space: pre` applied to `.code-line` CSS class (not the contentEditable container) to prevent line wrapping without breaking `innerText`/`textContent` parsing
5. `handleInput` extracts content by iterating child nodes instead of using `innerText` (which is unreliable with nested `<div>` elements)

### Lessons Learned
- Before implementing scroll-sync fixes, verify the `overflow` property of the target element. Setting `scrollTop` on `overflow-hidden` does nothing.
- Prefer single-scroll-container layouts over JS-based scroll synchronization, which is fragile and prone to jank.
- `white-space: pre` on a `contentEditable` div changes how `innerText` parses newlines from child `<div>` elements — apply it to inner elements instead.
- Empty line placeholders (`<span>\n</span>`) cause `textContent` to return `"\n"`, leading to double newlines when joining. Use `<br>` instead.
- Always inspect the actual DOM/CSS behavior before writing a fix.
- Always test after finishing — test the fix AND test that nothing else broke.
