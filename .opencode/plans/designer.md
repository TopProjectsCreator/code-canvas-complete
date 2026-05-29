# Visual UI Builder — Phase 1 Implementation Plan

## 1. Overview

A drag-and-drop UI builder that lets users compose shadcn/ui components on a visual canvas and generates clean, editable TSX code. Follows the same pattern as the existing `DrawEditor` / `whiteboard` template — design data stored as JSON, rendered in a dedicated editor panel.

---

## 2. Files to Create

All new files under `src/components/builder/`:

| # | File | Purpose |
|---|------|---------|
| 1 | `types.ts` | UINode, BuilderComponentConfig, PropConfig, BuilderAction, BuilderState, DropPosition |
| 2 | `registry.ts` | Registry of 17 draggable shadcn components with props, categories, default values |
| 3 | `useBuilderStore.ts` | React context + useReducer (state: rootNodes, selectedId, history for undo) |
| 4 | `BuilderLayout.tsx` | Top-level orchestration: 3-panel layout (Palette \| Canvas+Tree \| Properties) |
| 5 | `ComponentPalette.tsx` | Left panel: categorized draggable component list (dnd-kit `useDraggable`) |
| 6 | `Canvas.tsx` | Center: drop zone (`useDroppable`), renders UINode tree, manages drop position indicators |
| 7 | `ComponentWrapper.tsx` | Wraps each rendered component: selection ring, drag handle, duplicate/delete buttons |
| 8 | `DropIndicator.tsx` | Thin colored line showing where a component will land |
| 9 | `ComponentTree.tsx` | Bottom-left tree hierarchy (click to select, drag to reorder) |
| 10 | `PropertiesPanel.tsx` | Right panel: dynamic form generated from `propConfig`, className editor |
| 11 | `codeGenerator.ts` | UINode[] → formatted TSX string with imports |

---

## 3. Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `src/data/templateRegistry.ts` | Add `"design"` to `LanguageTemplate` union + `TEMPLATES` entry |
| 2 | `src/data/defaultFiles.ts` | Add `"design"` case in `getTemplateFiles` + `designTemplate` FileNode[] |
| 3 | `src/components/ide/IDELayout.tsx` | Import `BuilderLayout`, add `"design"` branches in 7 places |

---

## 4. Data Model (`types.ts`)

```ts
export interface UINode {
  id: string;
  componentType: string;
  props: Record<string, any>;
  children: UINode[];
}

export interface BuilderComponentConfig {
  type: string;
  label: string;
  icon: string;
  category: 'layout' | 'form' | 'display' | 'feedback' | 'navigation' | 'html';
  component: React.ComponentType<any>;
  defaultProps: Record<string, any>;
  propsConfig: PropConfig[];
  allowedChildren: string[];
  isContainer: boolean;
  isVoid: boolean;
  textContent?: string;
  importPath: string;
  importName: string;
}

export interface PropConfig {
  name: string;
  label: string;
  type: 'string' | 'boolean' | 'number' | 'select' | 'class';
  options?: { label: string; value: string }[];
  defaultValue: any;
  category: 'content' | 'appearance' | 'behavior';
}

export interface DropPosition {
  parentId: string | null;
  index: number;
}

export interface BuilderState {
  rootNodes: UINode[];
  selectedNodeId: string | null;
  dropPosition: DropPosition | null;
  isDragging: boolean;
  history: UINode[][];
  historyIndex: number;
}

export type BuilderAction =
  | { type: 'ADD_NODE'; componentType: string; position: DropPosition }
  | { type: 'REMOVE_NODE'; nodeId: string }
  | { type: 'UPDATE_PROPS'; nodeId: string; props: Record<string, any> }
  | { type: 'MOVE_NODE'; nodeId: string; position: DropPosition }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'DUPLICATE_NODE'; nodeId: string }
  | { type: 'SET_DROP_POSITION'; position: DropPosition | null }
  | { type: 'SET_DRAGGING'; isDragging: boolean }
  | { type: 'LOAD'; rootNodes: UINode[] }
  | { type: 'UNDO' }
  | { type: 'REDO' };
```

---

## 5. Component Registry (`registry.ts`) — 17 Components

| type | label | category | isContainer | defaultProps |
|------|-------|----------|-------------|-------------|
| `html/div` | Container | layout | true | `{ className: 'flex flex-col gap-4 p-4' }` |
| `ui/button` | Button | form | false | `{ variant: 'default', size: 'default' }` (textContent: 'Button') |
| `ui/input` | Input | form | false | `{ placeholder: 'Enter text...', type: 'text' }` |
| `ui/textarea` | Textarea | form | false | `{ placeholder: 'Enter text...', rows: 4 }` |
| `ui/select` | Select | form | false | `{ placeholder: 'Select an option' }` |
| `ui/checkbox` | Checkbox | form | false | `{ checked: false }` |
| `ui/switch` | Switch | form | false | `{ checked: false }` |
| `ui/slider` | Slider | form | false | `{ defaultValue: [50], max: 100, step: 1 }` |
| `ui/label` | Label | form | false | `{}` (textContent: 'Label') |
| `ui/card` | Card | layout | true | `{ className: 'w-full' }` |
| `ui/card-header` | Card Header | layout | true | `{}` |
| `ui/card-content` | Card Content | layout | true | `{ className: 'space-y-4' }` |
| `ui/card-footer` | Card Footer | layout | true | `{}` |
| `ui/card-title` | Card Title | display | false | `{}` (textContent: 'Card Title') |
| `ui/badge` | Badge | display | false | `{ variant: 'default' }` (textContent: 'Badge') |
| `ui/alert` | Alert | feedback | true | `{ variant: 'default' }` |
| `ui/separator` | Separator | display | false | `{}` |

---

## 6. State Management (`useBuilderStore.ts`)

React context + `useReducer`. Actions:
- `ADD_NODE`: creates UINode with random ID, defaultProps, inserts at DropPosition
- `REMOVE_NODE`: recursive find & remove, clears selection if removed
- `UPDATE_PROPS`: shallow merge into existing props
- `MOVE_NODE`: remove from old parent, insert at new position
- `DUPLICATE_NODE`: deep clone with new IDs, insert after original
- `SELECT_NODE`: set selectedNodeId
- `UNDO`/`REDO`: 50-entry history stack

Context exposes: `{ state, dispatch, getCode, toJSON, loadFromJSON }`

---

## 7. Canvas Rendering (`Canvas.tsx`)

- `DndContext` wrapping a droppable root div
- Recursive `renderNode()` for the UINode tree
- `DropIndicator` between children at the current `dropPosition`
- On `onDragEnd`: ADD_NODE from palette or MOVE_NODE within canvas
- Collision detection via `closestCenter` + pointer Y position for index calculation
- Empty state: centered "Drag components here" placeholder

---

## 8. ComponentWrapper (`ComponentWrapper.tsx`)

- Selection ring (blue, `ring-2 ring-primary`)
- Hover toolbar: duplicate (Copy icon), delete (Trash2 icon)
- Drag handle: GripVertical icon, uses `useSortable`
- Click handler to select the node

---

## 9. ComponentPalette (`ComponentPalette.tsx`)

- ~240px wide, ScrollArea, grouped by category
- `useDraggable` on each item with `{ from: 'palette', type }` data
- Search input to filter components
- Each item shows lucide icon + label

---

## 10. ComponentTree (`ComponentTree.tsx`)

- Hierarchical tree with indentation
- Click selects, highlights current selection
- Collapsible containers (toggle arrow)
- Right-click context menu (delete, duplicate)

---

## 11. PropertiesPanel (`PropertiesPanel.tsx`)

- ~280px wide, ScrollArea
- Dynamic form built from the selected node's `propsConfig`
- Property inputs: string→Input, boolean→Switch, number→Slider/Input, select→Select, class→Textarea with Tailwind suggestions
- Grouped by category (Content, Appearance, Behavior)

---

## 12. Code Generator (`codeGenerator.ts`)

- `collectImports()`: walks tree, collects unique imports from registry
- `generateJSX()`: recursive, tracks indent depth
- Output: import block + `export function MyComponent() { return ( ... ) }`
- Handles void elements (self-closing), containers (wrapping children), textContent

---

## 13. Integration into IDELayout

- Add `"design"` to `LanguageTemplate` union in `templateRegistry.ts`
- Add template entry + default files in `defaultFiles.ts`
- Auto-open `main.design.json` tab when template is selected
- Add `"design"` alongside `"whiteboard"` in 7 conditionals in `IDELayout.tsx`:
  1. Mobile editor filter
  2. Mobile preview filter (render `BuilderLayout`)
  3. Desktop editor filter
  4. Desktop ResizablePanel defaultSize (100%)
  5. Desktop preview panel (render `BuilderLayout`)

---

## 14. Implementation Order

| Step | File | What |
|------|------|------|
| 1 | `types.ts` | Interfaces, types, action union |
| 2 | `registry.ts` | 17 components with propsConfig |
| 3 | `codeGenerator.ts` | Recursive code generation |
| 4 | `useBuilderStore.ts` | Reducer, context, history |
| 5 | `DropIndicator.tsx` | Visual drop line |
| 6 | `ComponentWrapper.tsx` | Selection ring, toolbar, drag handle |
| 7 | `Canvas.tsx` | DndContext, droppable, recursive render |
| 8 | `ComponentPalette.tsx` | Categorized draggable list |
| 9 | `ComponentTree.tsx` | Hierarchy view |
| 10 | `PropertiesPanel.tsx` | Dynamic form |
| 11 | `BuilderLayout.tsx` | 3-panel orchestrator |
| 12 | Integration | templateRegistry, defaultFiles, IDELayout |
| 13 | Verify | lint + build |
