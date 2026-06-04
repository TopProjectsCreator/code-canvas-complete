import { useEffect, useState, useCallback, useRef } from 'react'
import { useCADStore } from '../store'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { SHORTCUTS } from '../keyboardShortcuts'
import { Search } from 'lucide-react'
import type { ToolMode } from '../types'

const ACTION_MAP: Record<string, () => void> = {
  'tool-select': () => useCADStore.getState().setToolMode('select'),
  'tool-move': () => { useCADStore.getState().setToolMode('move'); useCADStore.getState().setGizmoMode('translate') },
  'tool-rotate': () => { useCADStore.getState().setToolMode('rotate'); useCADStore.getState().setGizmoMode('rotate') },
  'tool-scale': () => { useCADStore.getState().setToolMode('scale'); useCADStore.getState().setGizmoMode('scale') },
  'toggle-grid': () => useCADStore.getState().toggleGrid(),
  'toggle-snap': () => useCADStore.getState().setSnapping(!useCADStore.getState().gizmo.snapping),
  'toggle-wireframe': () => useCADStore.getState().toggleWireframe(),
  'toggle-xray': () => useCADStore.getState().toggleGhost(),
  'tool-sketch': () => useCADStore.getState().setToolMode('sketch'),
  'tool-extrude': () => useCADStore.getState().setToolMode('extrude'),
  'tool-revolve': () => useCADStore.getState().setToolMode('revolve'),
  'tool-sweep': () => useCADStore.getState().setToolMode('sweep'),
  'tool-loft': () => useCADStore.getState().setToolMode('loft'),
  'tool-fillet': () => useCADStore.getState().setToolMode('fillet'),
  'tool-chamfer': () => useCADStore.getState().setToolMode('chamfer'),
  'tool-shell': () => useCADStore.getState().setToolMode('shell'),
  'tool-hole': () => useCADStore.getState().setToolMode('hole'),
  'tool-boolean': () => useCADStore.getState().setToolMode('boolean'),
  'tool-mirror': () => useCADStore.getState().setToolMode('mirror'),
  'tool-pattern': () => useCADStore.getState().setToolMode('pattern'),
  'undo': () => useCADStore.getState().undo(),
  'redo': () => useCADStore.getState().redo(),
  'deselect-all': () => useCADStore.getState().deselectAll(),
  'delete': () => { /* no-op without selection context */ },
  'command-palette': () => useCADStore.getState().closeCommandPalette(),
}

export function CommandPalette() {
  const open = useCADStore(s => s.commandPaletteOpen)
  const close = useCADStore(s => s.closeCommandPalette)
  const [search, setSearch] = useState('')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        if (open) close()
        else useCADStore.getState().openCommandPalette()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, close])

  const handleSelect = useCallback((action: string) => {
    const fn = ACTION_MAP[action]
    if (fn) fn()
    close()
    setSearch('')
  }, [close])

  return (
    <CommandDialog open={open} onOpenChange={o => { if (!o) close() }}>
      <CommandInput
        placeholder="Search commands..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="Commands">
          {SHORTCUTS.filter(s =>
            s.label.toLowerCase().includes(search.toLowerCase()) ||
            s.action.toLowerCase().includes(search.toLowerCase())
          ).map(s => (
            <CommandItem
              key={s.action}
              onSelect={() => handleSelect(s.action)}
            >
              <Search className="mr-2 h-4 w-4" />
              <span>{s.label}</span>
              <kbd className="ml-auto text-xs text-muted-foreground">
                {s.ctrl && 'Ctrl+'}
                {s.shift && 'Shift+'}
                {s.alt && 'Alt+'}
                {s.key}
              </kbd>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
