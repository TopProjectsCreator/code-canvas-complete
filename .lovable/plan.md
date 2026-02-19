## Fix: Line Numbers Not Scrolling With Code

### Problem

The line number gutter and code editor are separate sibling elements. The gutter has `overflow-hidden`, and the code area scrolls independently with `overflow-auto`. The previous "fix" tried to sync scroll positions via JS, but `scrollTop` on an `overflow-hidden` div has no visible effect. This is a structural layout issue, not a scroll-event wiring issue.

### Root Cause

```
Current (broken):
+--container (overflow-hidden, flex)----------+
|  +--gutter (overflow-hidden)--+  +--code (overflow-auto)--+
|  | 1                          |  | const x = 1;           |
|  | 2                          |  | const y = 2;           |
|  +----------------------------+  +-------------------------+
+-------------------------------------------------+
```

The gutter can't scroll because it's `overflow-hidden`. Even if changed to `overflow-auto`, two separate scroll areas will never stay perfectly in sync.

### Solution

Wrap both gutter and code content inside a single scrollable container. The gutter becomes a non-scrolling column within the same scroll context as the code, so they move together naturally with zero JS sync needed.

```
Fixed:
+--scrollable-container (overflow-auto)-------+
|  +--row-----------------------------------+ |
|  | [1] const x = 1;                       | |
|  | [2] const y = 2;                       | |
|  | [3] ...                                | |
|  +-----------------------------------------+ |
+----------------------------------------------+
```

### Technical Detail

**File: `src/components/ide/CodeEditor.tsx**`

1. Remove the `gutterRef` and the `onScroll` sync handler (they're unnecessary with this approach).
2. Restructure the layout so that the outer `div.flex-1.relative.overflow-hidden.flex` becomes a single scrollable container (`overflow-auto`) instead of two separate scrolling contexts.
3. Inside that scrollable container, use a table-like layout or a flex row where:
  - The gutter column renders line numbers (no `overflow-hidden`, no independent scroll)
  - The code column renders the editable content
  - Both sit inside the same scrolling parent, so vertical scroll moves both
4. The `contentEditable` div changes from `absolute inset-0 overflow-auto` to a relative/static element within the shared scroll container, so it participates in the same scroll flow.
5. Remove the `onScroll` handler entirely -- no JS sync needed.

### Additional Notes for `.lovable/plan.md`

Add a "Lessons Learned" section:

- Before implementing scroll-sync fixes, verify the `overflow` property of the target element. Setting `scrollTop` on `overflow-hidden` does nothing.
- Prefer single-scroll-container layouts over JS-based scroll synchronization, which is fragile and prone to jank.
- Always inspect the actual DOM/CSS behavior (mentally or via tools) before writing a fix.
- Always test after finishing and test what even is the problem using the tools that I have provided you and paid 100's of dollars for