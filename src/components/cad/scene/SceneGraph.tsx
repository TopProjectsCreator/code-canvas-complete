import { useCADStore } from '../store'
import { Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown } from 'lucide-react'
import { useState, useCallback } from 'react'
import { SceneSearch } from './SceneSearch'
import { SceneFilter } from './SceneFilter'
import { ScrollArea } from '@/components/ui/scroll-area'

function SceneNodeItem({ nodeId, depth = 0 }: { nodeId: string; depth?: number }) {
  const doc = useCADStore(s => s.doc)
  const setNodeVisibility = useCADStore(s => s.setNodeVisibility)
  const setNodeLock = useCADStore(s => s.setNodeLock)
  const select = useCADStore(s => s.select)
  const addToSelection = useCADStore(s => s.addToSelection)
  const selection = useCADStore(s => s.selection)
  const [expanded, setExpanded] = useState(true)

  function findNode(nodes: typeof doc.scene): (typeof doc.scene)[0] | null {
    for (const n of nodes) {
      if (n.id === nodeId) return n
      const found = findNode(n.children)
      if (found) return found
    }
    return null
  }

  const node = findNode(doc.scene)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const n = findNode(useCADStore.getState().doc.scene)
    if (!n) return
    useCADStore.getState().showContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Select', action: 'select-node', featureId: nodeId },
        { label: 'Rename', action: 'rename-node', featureId: nodeId },
        { label: n.visible ? 'Hide' : 'Show', action: 'toggle-visibility', featureId: nodeId },
        { label: n.locked ? 'Unlock' : 'Lock', action: 'toggle-lock', featureId: nodeId },
        { label: 'Delete', action: 'delete-node', featureId: nodeId },
      ],
    })
  }, [nodeId])

  if (!node) return null

  const isSelected = selection.some(s => s.type === 'node' && s.nodeId === node.id)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs hover:bg-accent/50 ${
          isSelected ? 'bg-accent text-accent-foreground' : ''
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={e => {
          if (e.ctrlKey || e.metaKey) {
            addToSelection({ type: 'node', nodeId: node.id })
          } else {
            select({ type: 'node', nodeId: node.id })
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {hasChildren ? (
          <button className="p-0.5 hover:bg-muted rounded" onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}>
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <span className={`flex-1 truncate ${!node.visible ? 'text-muted-foreground/50 italic' : ''}`}>
          {node.name}
        </span>

        <button
          className="p-0.5 hover:bg-muted rounded text-muted-foreground"
          onClick={e => { e.stopPropagation(); setNodeVisibility(node.id, !node.visible) }}
        >
          {node.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>

        <button
          className="p-0.5 hover:bg-muted rounded text-muted-foreground"
          onClick={e => { e.stopPropagation(); setNodeLock(node.id, !node.locked) }}
        >
          {node.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <SceneNodeItem key={child.id} nodeId={child.id} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function SceneGraph() {
  const doc = useCADStore(s => s.doc)
  const searchQuery = useCADStore(s => s.sceneSearchQuery)
  const filter = useCADStore(s => s.sceneFilter)

  function nodePasses(node: { name: string; bodyId: string | null; instanceOf?: string; children: { name: string }[] }): boolean {
    const query = searchQuery.toLowerCase()
    if (query) {
      if (!node.name.toLowerCase().includes(query) &&
          !node.children.some(c => c.name.toLowerCase().includes(query))) return false
    }
    if (node.bodyId && !filter.bodies) return false
    if (node.instanceOf === 'sketch' && !filter.sketches) return false
    if ((node.instanceOf === 'plane' || node.instanceOf === 'construction-plane') && !filter.planes) return false
    return true
  }

  const visibleNodes = doc.scene.filter(n => nodePasses(n))

  return (
    <div>
      <div className="px-2 py-1 border-b flex gap-1">
        <SceneSearch />
        <SceneFilter />
      </div>
      <ScrollArea className="h-[calc(100%-32px)]">
        <div className="py-1">
          {visibleNodes.map(node => (
            <SceneNodeItem key={node.id} nodeId={node.id} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
