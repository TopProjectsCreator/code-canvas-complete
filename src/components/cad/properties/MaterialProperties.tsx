import { useCADStore } from '../store'
import type { SceneNode } from '../types'

function findBodyId(nodes: SceneNode[], nodeId: string): string | null {
  for (const n of nodes) {
    if (n.id === nodeId) return n.bodyId
    const found = findBodyId(n.children, nodeId)
    if (found) return found
  }
  return null
}

const BUILTIN_MATERIALS = [
  { id: 'steel', name: 'Steel', color: '#94a3b8', roughness: 0.4, metalness: 0.9 },
  { id: 'aluminum', name: 'Aluminum', color: '#cbd5e1', roughness: 0.3, metalness: 0.95 },
  { id: 'copper', name: 'Copper', color: '#b87333', roughness: 0.3, metalness: 0.95 },
  { id: 'brass', name: 'Brass', color: '#c5a059', roughness: 0.2, metalness: 0.9 },
  { id: 'plastic', name: 'Plastic (ABS)', color: '#64748b', roughness: 0.7, metalness: 0 },
  { id: 'rubber', name: 'Rubber', color: '#1e293b', roughness: 0.9, metalness: 0 },
  { id: 'glass', name: 'Glass', color: '#e2e8f0', roughness: 0.05, metalness: 0, opacity: 0.7, ior: 1.5 },
  { id: 'wood', name: 'Wood', color: '#8b6914', roughness: 0.85, metalness: 0 },
]

export function MaterialProperties() {
  const selection = useCADStore(s => s.selection)
  const updateBodyAppearance = useCADStore(s => s.updateBodyAppearance)
  const doc = useCADStore(s => s.doc)

  const activeBodyId = (() => {
    const sel = selection.find(s => s.type === 'body')
    if (sel) return sel.bodyId
    const nodeSel = selection.find(s => s.type === 'node')
    if (!nodeSel) return null
    return findBodyId(doc.scene, nodeSel.nodeId)
  })()

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">Material Library</div>

      <div className="grid grid-cols-2 gap-2">
        {BUILTIN_MATERIALS.map(mat => (
          <button
            key={mat.id}
            className="flex items-center gap-2 p-2 rounded border text-xs hover:bg-accent text-left"
            onClick={() => {
              if (activeBodyId) {
                updateBodyAppearance(activeBodyId, {
                  color: mat.color,
                  roughness: mat.roughness,
                  metalness: mat.metalness,
                })
              }
            }}
          >
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: mat.color, opacity: mat.opacity ?? 1 }}
            />
            <div>
              <div className="font-medium">{mat.name}</div>
              <div className="text-[10px] text-muted-foreground">
                R:{mat.roughness} M:{mat.metalness}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
