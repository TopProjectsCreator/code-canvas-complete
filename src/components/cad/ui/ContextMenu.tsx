import { useEffect, useRef, useCallback } from 'react'
import { useCADStore } from '../store'
import type { Feature, SceneNode } from '../types'

export function ContextMenu() {
  const menu = useCADStore(s => s.contextMenu)
  const hideContextMenu = useCADStore(s => s.hideContextMenu)
  const removeFeature = useCADStore(s => s.removeFeature)
  const updateFeature = useCADStore(s => s.updateFeature)
  const removeNode = useCADStore(s => s.removeNode)
  const setNodeVisibility = useCADStore(s => s.setNodeVisibility)
  const setNodeLock = useCADStore(s => s.setNodeLock)
  const renameNode = useCADStore(s => s.renameNode)
  const ref = useRef<HTMLDivElement>(null)

  const handleAction = useCallback((item: NonNullable<typeof menu>['items'][number]) => {
    switch (item.action) {
      case 'edit-feature':
        if (item.featureId && item.bodyId) {
          useCADStore.getState().openEditDialog(item.featureId, item.bodyId)
        }
        break
      case 'toggle-suppress':
        if (item.featureId && item.bodyId) {
          const body = useCADStore.getState().doc.bodies[item.bodyId]
          if (body) {
            const feat = body.features.find(f => f.id === item.featureId) as Feature | undefined
            if (feat) {
              updateFeature(item.bodyId, item.featureId, { suppressed: !feat.suppressed } as Partial<Feature>)
            }
          }
        }
        break
      case 'delete-feature':
        if (item.featureId && item.bodyId) {
          removeFeature(item.bodyId, item.featureId)
        }
        break
      case 'select-node':
        if (item.featureId) {
          useCADStore.getState().select({ type: 'node', nodeId: item.featureId })
        }
        break
      case 'rename-node':
        if (item.featureId) {
          const name = prompt('Rename:')
          if (name) renameNode(item.featureId, name)
        }
        break
      case 'toggle-visibility':
        if (item.featureId) {
          const doc = useCADStore.getState().doc
          const findVisible = (nodes: SceneNode[]): boolean | null => {
            for (const n of nodes) {
              if (n.id === item.featureId) return n.visible
              const found = findVisible(n.children)
              if (found !== null) return found
            }
            return null
          }
          const visible = findVisible(doc.scene)
          if (visible !== null) setNodeVisibility(item.featureId, !visible)
        }
        break
      case 'toggle-lock':
        if (item.featureId) {
          const doc = useCADStore.getState().doc
          const findLocked = (nodes: SceneNode[]): boolean | null => {
            for (const n of nodes) {
              if (n.id === item.featureId) return n.locked
              const found = findLocked(n.children)
              if (found !== null) return found
            }
            return null
          }
          const locked = findLocked(doc.scene)
          if (locked !== null) setNodeLock(item.featureId, !locked)
        }
        break
      case 'delete-node':
        if (item.featureId) {
          if (confirm('Delete this node?')) removeNode(item.featureId)
        }
        break
      default:
        break
    }
    hideContextMenu()
  }, [hideContextMenu, removeFeature, updateFeature, removeNode, setNodeVisibility, setNodeLock, renameNode])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        hideContextMenu()
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') hideContextMenu()
    }
    if (menu) {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleEsc)
    }
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [menu, hideContextMenu])

  if (!menu) return null

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.items.map((item, i) => (
        <button
          key={i}
          className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground"
          onClick={() => handleAction(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
