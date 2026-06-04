export interface ShortcutDef {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: string
  label: string
}

export const SHORTCUTS: ShortcutDef[] = [
  { key: '1', action: 'tool-select', label: 'Select tool' },
  { key: '2', action: 'tool-move', label: 'Move tool' },
  { key: '3', action: 'tool-rotate', label: 'Rotate tool' },
  { key: '4', action: 'tool-scale', label: 'Scale tool' },
  { key: 'g', action: 'toggle-grid', label: 'Grid toggle' },
  { key: 'g', shift: true, action: 'toggle-snap', label: 'Snap toggle' },
  { key: 'w', action: 'toggle-wireframe', label: 'Wireframe toggle' },
  { key: 'x', action: 'toggle-xray', label: 'X-ray mode toggle' },
  { key: 'z', action: 'toggle-section', label: 'Section view toggle' },
  { key: ' ', action: 'cycle-tool', label: 'Cycle tool' },
  { key: 's', action: 'tool-sketch', label: 'Sketch tool' },
  { key: 'e', action: 'tool-extrude', label: 'Extrude tool' },
  { key: 'r', action: 'tool-revolve', label: 'Revolve tool' },
  { key: 'e', shift: true, action: 'tool-sweep', label: 'Sweep tool' },
  { key: 'l', shift: true, action: 'tool-loft', label: 'Loft tool' },
  { key: 'c', action: 'tool-coil', label: 'Coil tool' },
  { key: 'f', action: 'tool-fillet', label: 'Fillet tool' },
  { key: 'f', shift: true, action: 'tool-chamfer', label: 'Chamfer tool' },
  { key: 'h', action: 'tool-shell', label: 'Shell tool' },
  { key: 'd', action: 'tool-draft', label: 'Draft tool' },
  { key: 'k', action: 'tool-hole', label: 'Hole tool' },
  { key: 't', action: 'tool-thread', label: 'Thread tool' },
  { key: 'b', action: 'tool-boolean', label: 'Boolean tool' },
  { key: 'm', action: 'tool-mirror', label: 'Mirror tool' },
  { key: 'p', action: 'tool-pattern', label: 'Pattern tool' },
  { key: 'o', action: 'toggle-ortho', label: 'Orthographic/perspective toggle' },
  { key: '/', action: 'frame-selected', label: 'Frame selected' },
  { key: 'f', ctrl: true, action: 'frame-all', label: 'Frame all' },
  { key: '.', action: 'focus-selected', label: 'Focus selected' },
  { key: 'z', ctrl: true, action: 'undo', label: 'Undo' },
  { key: 'z', ctrl: true, shift: true, action: 'redo', label: 'Redo' },
  { key: 'y', ctrl: true, action: 'redo-alt', label: 'Redo' },
  { key: 'Delete', action: 'delete', label: 'Delete selected' },
  { key: 'Backspace', action: 'delete-alt', label: 'Delete selected' },
  { key: 'd', shift: true, action: 'duplicate', label: 'Duplicate' },
  { key: 'd', ctrl: true, action: 'deselect-all', label: 'Deselect all' },
  { key: 'a', ctrl: true, action: 'select-all', label: 'Select all' },
  { key: 'i', ctrl: true, action: 'invert-selection', label: 'Invert selection' },
  { key: 'g', ctrl: true, action: 'group', label: 'Group selected' },
  { key: 'h', action: 'hide-selected', label: 'Hide selected' },
  { key: 'h', shift: true, action: 'show-all', label: 'Show all hidden' },
  { key: 'Enter', ctrl: true, action: 'apply-tool', label: 'Apply current tool' },
  { key: 'Escape', action: 'cancel-tool', label: 'Cancel tool' },
  { key: 'F2', action: 'rename', label: 'Rename selected' },
  { key: 'p', ctrl: true, action: 'command-palette', label: 'Command palette' },
  { key: 's', ctrl: true, shift: true, action: 'save-as', label: 'Save as' },
  { key: 's', ctrl: true, action: 'save', label: 'Save' },
  { key: 'o', ctrl: true, action: 'open', label: 'Open file' },
  { key: 'n', ctrl: true, action: 'new', label: 'New document' },
  { key: 'e', ctrl: true, shift: true, action: 'export', label: 'Export' },
  { key: 'i', ctrl: true, shift: true, action: 'import', label: 'Import' },
  { key: 'm', ctrl: true, shift: true, action: 'measure', label: 'Measure tool' },
]

export const SHORTCUT_MAP = new Map(SHORTCUTS.map(s => {
  const parts: string[] = []
  if (s.ctrl) parts.push('Ctrl')
  if (s.shift) parts.push('Shift')
  if (s.alt) parts.push('Alt')
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key)
  return [parts.join('+'), s]
}))

export function matchShortcut(e: KeyboardEvent): ShortcutDef | undefined {
  return SHORTCUTS.find(s => {
    if (s.key.length === 1 && e.key.toLowerCase() !== s.key) return false
    if (s.key.length > 1 && e.key !== s.key) return false
    if (s.ctrl && !e.ctrlKey && !e.metaKey) return false
    if (!s.ctrl && (e.ctrlKey || e.metaKey)) return false
    if (s.shift && !e.shiftKey) return false
    if (!s.shift && e.shiftKey && s.key.length === 1) return false
    if (s.alt && !e.altKey) return false
    if (!s.alt && e.altKey) return false
    return true
  })
}
