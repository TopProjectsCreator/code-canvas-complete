# EPUB Viewer Implementation Plan

## Overview
Add an EPUB reader component that opens `.epub` files in the IDE's file editor area, following the same pattern as `PDFEditor.tsx`.

## Implementation Status — COMPLETE ✅

- [x] `epubjs@0.5.0-alpha.3` installed (npm install succeeded)
- [x] Types checked, API confirmed (uses `Epub`, `Rendition` classes)
- [x] `src/components/ide/EpubViewer.tsx` created (~195 lines)
- [x] `src/lib/filePreviewTypes.ts` — added `"epub"` to union + extension check
- [x] `src/components/ide/CodeEditor.tsx` — import + routing for epub type
- [x] `src/components/ide/index.ts` — optional export added
- [x] `npm run lint` — 0 errors
- [x] `npm run build` — succeeds
- [x] `npm run test` — 406 tests pass

## Implementation Summary

### `src/components/ide/EpubViewer.tsx`
Standard `{ file: FileNode; onContentChange }` component:
- Decodes binary via `decodeDataUrl()`
- Unzips EPUB with JSZip, stores all files in memory
- Creates `Epub` instance with custom `request` override serving from zip
- Renders via `Rendition` attached to a container div
- Toolbar: prev/next, TOC toggle sidebar, font-size +/- , day/night theme toggle, download
- Loading/error states matching PDFEditor pattern
- Cleanup (destroy book + rendition) on unmount
- ResizeObserver for responsive rendering
