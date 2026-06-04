# Editor Fixes — Quality & Architecture Improvements

## 1. Monolithic File Refactoring

### 1.1 ScratchPanel.tsx (4,747 lines → split into modules)

**Problem:** Single file combines VM integration, block rendering, stage runtime,
drag-drop, serialization, extension loading, and hardcoded color/block definitions.

**Plan:**

```
src/components/scratch/
├── ScratchPanel.tsx          ← thin orchestrator (was 4,747, target ~200)
├── ScratchBlockShape.tsx     ← already extracted
├── ShadowInput.tsx           ← already extracted
├── ScratchLibraryDialog.tsx  ← already extracted
├── vm/
│   ├── useScratchVM.ts       ← VM lifecycle, init, load archive
│   └── scratchExtensions.ts  ← Extension definitions & loading
├── blocks/
│   ├── BlockPalette.tsx      ← Left panel — category list + block list
│   ├── BlockRenderer.tsx     ← Renders a single block with slots
│   ├── blockDefinitions.ts   ← All block definitions (extracted from ScratchPanel)
│   └── blockColors.ts        ← Theme color constants (extracted hardcoded hex)
├── stage/
│   ├── StageRenderer.tsx     ← Canvas + sprite rendering
│   └── SpriteList.tsx        ← Sprite/costume/sound tabs
├── serialization/
│   └── sb3Serializer.ts     ← SB3 import/export (parse/stringify)
└── drag/
    └── useBlockDrag.ts      ← Drag-and-drop logic (pointer events, snap)
```

**Changes:**
- Add `<ErrorBoundary>` around ScratchPanel in `CodeEditor.tsx`
- Replace 28 `console.log/warn/error` with toast/notification
- Add React `key` props to all 58+ render `.map()` calls
- Remove 38 `as any` casts by typing VM interop surface
- Add loading overlay during VM init (takes 1-3s)
- Extract hardcoded hex colors into `blockColors.ts`

### 1.2 AutomationTemplatePane.tsx (3,223 lines → split)

**Problem:** Pipeline builder UI + Python codegen + JS/TS codegen + Docker export +
Systemd export + run history all in one file.

**Plan:**

```
src/components/ide/automation/
├── AutomationTemplatePane.tsx ← orchestrator (~200 lines)
├── PipelineCanvas.tsx         ← Block-based pipeline builder UI
├── BlockPalette.tsx           ← Category & block list
├── ParameterForm.tsx          ← Block parameter editors
├── codegen/
│   ├── generatePython.ts     ← Python pipeline generator
│   └── generateTypeScript.ts ← JS/TS pipeline generator
├── deploy/
│   ├── DockerExporter.tsx     ← Docker + Docker Compose export
│   └── SystemdExporter.tsx    ← Systemd service export
└── history/
    └── RunHistory.tsx         ← Run log + artifact viewer
```

**Changes:**
- Add React `key` props to all render `.map()` calls
- Add `<ErrorBoundary>` wrapping
- Fix ref memory leak in `artifactNodeRefs`

### 1.3 IDELayout.tsx (3,298 lines → split)

**Problem:** Layout, sync managers (Scratch, Automation), file management,
mobile/desktop responsive variants, template logic, collaboration — all in one.

**Plan:**

```
src/components/ide/
├── IDELayout.tsx              ← Orchestrator (~500 lines)
├── layout/
│   ├── DesktopLayout.tsx      ← Desktop ResizablePanelGroup variant
│   ├── MobileLayout.tsx       ← Mobile panel switcher variant
│   └── TemplateRouter.tsx     ← Routes template → custom panel component
├── sync/
│   ├── useScratchSync.ts      ← Scratch 2-way file↔pane sync
│   └── useAutomationSync.ts   ← Automation config 2-way sync
└── hooks/
    └── useTemplateSetup.ts    ← Template init (GITHUB_TEMPLATE_REPOS, files)
```

**Changes:**
- Fix `GITHUB_TEMPLATE_REPOS` missing entries / undefined access
- Remove non-null `result.error!` assertions
- Extract sync logic from inline ref mess

### 1.4 ToolsPanel.tsx (2,219 lines → split)

**Plan:**

```
src/components/ide/tools/
├── ToolsPanel.tsx          ← Tab router (~50 lines)
├── MediaConverter.tsx      ← FFmpeg converter
├── MediaFromScratch.tsx    ← Generate media from scratch
├── HexEditor.tsx           ← Hex file viewer
├── ImageTools.tsx          ← Image conversion/resize
└── FormatConverters.tsx    ← json↔csv, base64, url-encode
```

---

## 2. Test Coverage

**Problem:** Zero test files across 196 components / 70,686 lines.

**Priority test targets (by risk/complexity):**

| Order | Component | What to test |
|-------|-----------|-------------|
| 1 | `useCodeExecution.ts` | Code execution lifecycle, timeout, error states |
| 2 | `useWebContainer.ts` | Container lifecycle, file ops, command exec |
| 3 | `cad/store.ts` | All slice mutations, undo/redo, serialization |
| 4 | `cad/types.ts` | Document serialization round-trip validation |
| 5 | `cad/codegen.ts` | Feature geometry generation for each type |
| 6 | `ScratchPanel.tsx` → `serialization/` | SB3 round-trip, project.json parse |
| 7 | `AutomationTemplatePane.tsx` → `codegen/` | Python/JS code generation output |
| 8 | `EnvFileEditor.tsx` | Parse → edit → serialize round-trip |
| 9 | `DatabaseDesignerPane.tsx` | SQL generation, model serialization |
| 10 | `office/ExcelEditor.tsx` | Formula parsing, cell mutation |
| 11 | `AudioEditor.tsx` | Trim export, waveform data |
| 12 | `VideoEditor.tsx` | Trim regions, filter application |
| 13 | `office/WordEditor.tsx` | Document import/export round-trip |
| 14 | `svg-editor/` | Path ops, boolean ops, serialization |
| 15 | `editor/RTFEditor.tsx` | RTF↔HTML conversion round-trip |
| 16 | `editor/FontEditor.tsx` | Font parse → edit → export |
| 17 | `builder/` | UINode tree mutations, code generation |
| 18 | `arduino/simulator.ts` | Simulation state, pin logic |
| 19 | `ftc/HardwareConfigEditor.tsx` | Config XML generation |
| 20 | `components/cad/workers/` | Worker message handling |

**New files to create:**

```
src/components/cad/__tests__/store.test.ts
src/components/cad/__tests__/codegen.test.ts
src/components/cad/__tests__/types.test.ts
src/components/ide/__tests__/EnvFileEditor.test.tsx
src/components/ide/__tests__/DatabaseDesignerPane.test.tsx
src/components/ide/office/__tests__/ExcelEditor.test.tsx
src/components/ide/office/__tests__/WordEditor.test.tsx
src/components/ide/svg-editor/__tests__/pathUtils.test.ts
src/components/ide/svg-editor/__tests__/booleanOps.test.ts
src/components/ide/svg-editor/__tests__/svgUtils.test.ts
src/components/ide/__tests__/RTFEditor.test.tsx
src/components/ide/__tests__/FontEditor.test.tsx
src/components/ide/__tests__/AudioEditor.test.tsx
src/components/ide/__tests__/VideoEditor.test.tsx
src/components/scratch/__tests__/sb3Serializer.test.ts
src/components/ide/automation/__tests__/generatePython.test.ts
src/components/ide/automation/__tests__/generateTypeScript.test.ts
src/components/builder/__tests__/codeGenerator.test.ts
src/components/arduino/__tests__/simulator.test.ts
src/components/ftc/__tests__/HardwareConfigEditor.test.tsx
src/components/cad/workers/__tests__/worker.test.ts
```

---

## 3. Error Boundaries

**Problem:** Only 1 error boundary exists (`OfficeErrorBoundary`).

**Plan:**

Create reusable `EditorErrorBoundary` in `src/components/ui/EditorErrorBoundary.tsx`:

```tsx
interface EditorErrorBoundaryProps {
  editorName: string;       // e.g. "Scratch", "SVG Editor"
  fallback?: ReactNode;     // Optional custom fallback UI
  onError?: (error: Error) => void;  // Optional error reporting callback
  children: ReactNode;
}
```

**Wrap these editors** (in `CodeEditor.tsx`, `IDELayout.tsx`, and router):

| Editor | File to wrap in | Existing line |
|--------|----------------|---------------|
| ScratchPanel | `CodeEditor.tsx:504` | `<ScratchProjectView>` |
| SvgEditor | `CodeEditor.tsx` | File preview routing |
| CADEditor (old) | `CodeEditor.tsx` | `"cad"` previewType path |
| AIChat | `IDELayout.tsx` | AI panel rendering |
| IpynbViewer | `CodeEditor.tsx` | `.ipynb` file routing |
| ToolsPanel | `IDELayout.tsx` | Tools panel rendering |
| VideoEditor | `CodeEditor.tsx` | Video file routing |
| AudioEditor | `CodeEditor.tsx` | Audio file routing |
| Preview | `IDELayout.tsx` | Preview panel |
| AutomationTemplatePane | `IDELayout.tsx` | Automation panel |
| DatabaseDesignerPane | `IDELayout.tsx` | Database panel |
| FTCPanel | `IDELayout.tsx` | FTC panel |
| ArduinoPanel | `IDELayout.tsx` | Arduino panel |
| BuilderLayout | `IDELayout.tsx` | Design template |
| All `cad/` viewport components | `CadLayout.tsx` | Three.js canvas |
| MermaidEditor | `CodeEditor.tsx` | Mermaid file routing |

---

## 4. React `key` Props

**Problem:** ~377 `.map()` calls missing `key` across all editor directories.

**Affected files requiring fixes:**

| File | Missing key locations |
|------|---------------------|
| `ScratchPanel.tsx` | Lines 1378, 1423, 1456, 1501, 3616, 3686, 3725, 3798, 3835, 3863, 3926, 4289, 4340, 4538, 4628 |
| `CodeEditor.tsx` | Lines 689, 713, 753, 796, 831, 906, 917, 959 |
| `IDELayout.tsx` | Multiple render maps (panel loops, tab loops) |
| `AutomationTemplatePane.tsx` | Lines 2773, 2850, 3079, 3136, 3188 |
| `ChatWidgets.tsx` | Lines 216, 281 |
| `SvgEditor.tsx` | Lines 77, 135, 154, 166, 298, 318, 508, 587, 611, 635, 670, 681, 761 |
| `PropertyPanel.tsx` | Lines 47, 219, 249, 280, 315, 371, 389, 449, 458, 486, 532, 541 |
| `SvgCanvas.tsx` | Lines 377, 385, 616, 660 |
| `EnvFileEditor.tsx` | Lines 345, 420, 436 |
| `cad/` components | Toolbar, SceneGraph, Properties, History, Palette, Palette, ContextMenu, CommandPalette, etc. (15+ files) |
| `builder/` components | ComponentPalette, PropertiesPanel, ComponentTree, Canvas, CodePreview |

**Fix strategy:** For each location, determine stable unique key:
- If items have an `id` field → use that
- If items have a `name`/`key` field → use that
- If items are static (palette, definitions) → use `label` + `index` or unique string
- Never use bare `index` — use `${prefix}-${index}` at minimum

---

## 5. XSS — Sanitize `dangerouslySetInnerHTML`

**Problem:** 16 instances, only 2 sanitized.

**Plan:**

Create `src/lib/sanitizeHtml.ts`:

```ts
import DOMPurify from 'dompurify';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote', 'img', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'span', 'div', 'hr', 'sub', 'sup', 'del', 'ins'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style', 'width', 'height'],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
```

**Files to fix (add `sanitizeHtml()` call):**

| File | Line(s) | Content type |
|------|---------|-------------|
| `CodeEditor.tsx` | 790, 952, 969 | Syntax highlighted code, comment HTML |
| `MermaidEditor.tsx` | 119 | Mermaid SVG output |
| `TexEditor.tsx` | 761, 785 | KaTeX/LaTeX rendered HTML |
| `FilePreview.tsx` | 903, 926 | Mermaid SVG rendering |
| `IpynbViewer.tsx` | 247, 718 | Notebook cell HTML output |
| `DatabaseDesignerPane.tsx` | 1443 | Mammoth Word doc HTML |
| `InboxDialog.tsx` | 653 | Email body HTML (already uses sanitizeRichText) |
| `CollabDialog.tsx` | 384, 391 | Comment content (already uses sanitizeRichText) |
| `AdvancedWorkbench.tsx` | 510 | Thread content |

**Also:** Add `package.json` entry for `dompurify` + `@types/dompurify` if not present.

---

## 6. Console Statements → User-Facing Notifications

**Problem:** 83 `console.log/warn/error` statements in production components.

**Replacement strategy:**

| Destination | When | Component |
|------------|------|-----------|
| `toast.error(msg)` | User-actionable errors | `ScratchPanel`, `VideoEditor`, `AudioEditor`, `PDFEditor`, `CodeEditor`, `DatabaseDesignerPane`, `ArduinoPanel` |
| `toast.warning(msg)` | Non-critical failures | `Preview`, `LanguagePicker` |
| `logger.debug(msg)` | Development debugging only | All `console.log` in `ScratchPanel` (28 instances) |
| Remove entirely | Unused debug logging | `ScratchPanel` lines 1826-1952 (debug init traces) |

**Create a lightweight logger** in `src/lib/logger.ts`:

```ts
const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

export const logger = {
  debug: (...args: unknown[]) => { if (LOG_LEVEL === 'debug') console.debug('[CC]', ...args); },
  info: (...args: unknown[]) => { if (LOG_LEVEL !== 'silent') console.info('[CC]', ...args); },
  warn: (...args: unknown[]) => { console.warn('[CC]', ...args); },
  error: (...args: unknown[]) => { console.error('[CC]', ...args); },
};
```

---

## 7. Type Safety

### 7.1 `as any` casts (230+ occurrences)

**Highest priority (Supabase queries):**

| File | Lines | Fix |
|------|-------|-----|
| `InboxDialog.tsx` | 179, 293, 390 | Generate proper Supabase types or use `zod` schema |
| `ExtensionsPanel.tsx` | 309, 310, 481, 482 | Same |
| `InboxRulesManager.tsx` | 46 | Same |

**Medium priority (CAD store):**

| File | Lines | Fix |
|------|-------|-----|
| `cad/properties/FeatureProperties.tsx` | 57-248 | Type the select change handlers properly instead of `... as any` |
| `cad/store.ts` | Event handlers | Type the Zustand action payloads |

**Lower priority (Scratch VM interop):**

| File | Lines | Fix |
|------|-------|-----|
| `ScratchPanel.tsx` | 1962, 1980, 4426, 4436 | Create `ScratchVM` interface for the scratch-vm API surface |

### 7.2 Non-null assertions (12+ occurrences)

| File | Line | Code | Fix |
|------|------|------|-----|
| `DatabaseDesignerPane.tsx` | 174 | `h.past.pop()!` | `if (!h.past.length) return` guard already exists |
| `DatabaseDesignerPane.tsx` | 184 | `h.future.pop()!` | Same |
| `svg-editor/svgUtils.ts` | 520, 551 | `.find(...)!` | Add fallback or filter before |
| `IDELayout.tsx` | 1986, 2030 | `result.error!` | Handle null case |
| `AIChat.tsx` | 1234, 1247, 1261 | `step.toolCall!` | Guard before access |
| `AIChat.tsx` | 1280 | `step.codeChange!` | Guard before access |
| `Preview.tsx` | 1050 | `fix.snippet!` | Guard before access |

---

## 8. Loading / Empty / Error States

| Component | Missing state | Implementation |
|-----------|--------------|----------------|
| `ScratchPanel` | Loading during VM init (1-3s) | Full-screen skeleton overlay with spinner |
| `SVGEditor` | Loading during SVG parse | Inline spinner in canvas area |
| `FontEditor` | Loading during font parse | Spinner until opentype.js returns glyphs |
| `PDFEditor` | Loading during PDF.js init | Skeleton page thumbnails |
| `IpynbViewer` | Loading during notebook parse | Skeleton cell outlines |
| `VideoEditor` | Loading during metadata load | Skeleton player with progress bar |
| `BreadboardVisualizer` | Loading during simulation init | Canvas placeholder |
| `TexEditor` | Error state for compile failures | Inline error banner (currently only in console) |
| `MermaidEditor` | Error state for render failures | Error banner with details (currently inline but subtle) |
| `FontEditor` | Error state for font loading | Toast + inline error message |

---

## 9. Additional Fixes

### 9.1 Preview.tsx global console monkey-patch

**Lines 235-246:** Monkey-patches `console.log/warn/error/info` on iframe contentWindow.
**Fix:** Save original functions before patching, restore on cleanup in the `useEffect` return.

### 9.2 ArduinoPanel TODO

**Line 212:** `# TODO: Connect local LLM runtime here.`
**Fix:** Either implement the feature or convert to a tracked issue. Remove inline TODO.

### 9.3 Memory Leaks

| File | Issue | Fix |
|------|-------|-----|
| `Preview.tsx` | Console monkey-patch not restored | Save originals, restore in useEffect cleanup |
| `XTerminal.tsx:44` | WebSocket ref not cleaned | Add ws.close() in useEffect cleanup |
| `ScratchPanel.tsx:1635` | rAF loop without cleanup | Store rafId, cancel in cleanup |
| `AutomationTemplatePane.tsx:2668` | Ref map could grow unbounded | Clear refs on unmount |

### 9.4 `key={index}` instances

| File | Line | Fix |
|------|------|-----|
| `WhileYouWaitArcade.tsx` | 129 | Use item.id or stable identifier |
| `WhileYouWaitArcade.tsx` | 312 | Same |

---

## Implementation Order

| Phase | What | Est. effort |
|-------|------|-------------|
| **Phase 1** | Error boundaries (all editors) + console→toast + XSS sanitize | 2 days |
| **Phase 2** | Add React key props (377 locations across all files) | 1 day |
| **Phase 3** | Type safety — fix `as any` in Supabase queries + non-null assertions | 2 days |
| **Phase 4** | Loading/empty/error states | 1 day |
| **Phase 5** | Split monolithic files (ScratchPanel, AutomationTemplatePane, IDELayout, ToolsPanel) | 5 days |
| **Phase 6** | Test coverage (22 new test files) | 5 days |
| **Phase 7** | Memory leaks, Arduino TODO, Preview monkey-patch, key={index} | 1 day |
| **Total** | | **~17 days** |
