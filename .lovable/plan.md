

## Fix: Remove gap between line numbers and code text

The issue is the `pl-2` (padding-left: 0.5rem) class on the editable code area, which creates unnecessary space between the gutter and the code.

### Change
In `src/components/ide/CodeEditor.tsx`, on the `contentEditable` div, replace `pl-2` with `pl-1` (or remove it entirely) to tighten the spacing between line numbers and code text.

### Technical Detail
- File: `src/components/ide/CodeEditor.tsx`
- The div with `className="absolute inset-0 font-mono text-sm leading-6 overflow-auto ide-scrollbar outline-none pt-[2px] pl-2 caret-foreground"` will have `pl-2` changed to `pl-1` for a subtle but tighter margin.

