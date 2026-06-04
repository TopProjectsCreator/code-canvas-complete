import { useEffect } from 'react'
import { useCADStore } from './store'
import { matchShortcut } from './keyboardShortcuts'

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const shortcut = matchShortcut(e)
      if (!shortcut) return

      e.preventDefault()
      const store = useCADStore.getState()

      switch (shortcut.action) {
        case 'tool-select': store.setToolMode('select'); break
        case 'tool-move': store.setToolMode('move'); store.setGizmoMode('translate'); break
        case 'tool-rotate': store.setToolMode('rotate'); store.setGizmoMode('rotate'); break
        case 'tool-scale': store.setToolMode('scale'); store.setGizmoMode('scale'); break
        case 'toggle-grid': store.toggleGrid(); break
        case 'toggle-snap': store.setSnapping(!store.gizmo.snapping); break
        case 'toggle-wireframe': store.toggleWireframe(); break
        case 'toggle-xray': store.toggleGhost(); break
        case 'toggle-section': store.toggleSection(); break
        case 'cycle-tool': {
          const cycle = ['select', 'move', 'rotate', 'scale'] as const
          const idx = cycle.indexOf(store.toolMode as typeof cycle[number])
          const next = cycle[(idx + 1) % cycle.length]
          store.setToolMode(next)
          break
        }
        case 'tool-sketch': store.setToolMode('sketch'); break
        case 'tool-extrude': store.setToolMode('extrude'); break
        case 'tool-revolve': store.setToolMode('revolve'); break
        case 'tool-sweep': store.setToolMode('sweep'); break
        case 'tool-loft': store.setToolMode('loft'); break
        case 'tool-coil': store.setToolMode('coil'); break
        case 'tool-fillet': store.setToolMode('fillet'); break
        case 'tool-chamfer': store.setToolMode('chamfer'); break
        case 'tool-shell': store.setToolMode('shell'); break
        case 'tool-draft': store.setToolMode('draft'); break
        case 'tool-hole': store.setToolMode('hole'); break
        case 'tool-thread': store.setToolMode('thread'); break
        case 'tool-boolean': store.setToolMode('boolean'); break
        case 'tool-mirror': store.setToolMode('mirror'); break
        case 'tool-pattern': store.setToolMode('pattern'); break
        case 'toggle-ortho': break // handled in viewport
        case 'undo': store.undo(); break
        case 'redo': case 'redo-alt': store.redo(); break
        case 'delete': case 'delete-alt': {
          if (store.selection.length > 0) {
            const sel = store.selection[0]
            if (sel.type === 'node') store.removeNode(sel.nodeId)
          }
          break
        }
        case 'deselect-all': store.deselectAll(); break
        case 'hide-selected': break
        case 'show-all': break
        case 'cancel-tool': store.setToolMode('select'); break
        case 'command-palette': store.openCommandPalette(); break
        default: break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
