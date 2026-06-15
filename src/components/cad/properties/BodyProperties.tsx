import { useCADStore } from '../store'
import { Label } from '@/components/ui/label'
import { ColorPicker } from '../ui/ColorPicker'

export function BodyProperties() {
  const selection = useCADStore(s => s.selection)
  const doc = useCADStore(s => s.doc)

  const bodySel = selection.find(s => s.type === 'body')
  if (!bodySel) {
    const nodeSel = selection.find(s => s.type === 'node')
    if (!nodeSel) return null
    const node = findNode(doc.scene, nodeSel.nodeId)
    if (!node || !node.bodyId) return null
    const body = doc.bodies[node.bodyId]
    if (!body) return null
    return <BodyInfo body={body} />
  }

  const body = doc.bodies[bodySel.bodyId]
  if (!body) return null
  return <BodyInfo body={body} />
}

function findNode(nodes: import('../types').SceneNode[], id: string): import('../types').SceneNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

function BodyInfo({ body }: { body: import('../types').Body }) {
  const updateBodyAppearance = useCADStore(s => s.updateBodyAppearance)

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">{body.name}</div>

      <div className="space-y-1">
        <Label className="text-xs">Color</Label>
        <ColorPicker
          value={body.appearance.color}
          onChange={color => updateBodyAppearance(body.id, { color })}
        />
      </div>

      <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
        <span>Features: {body.features.length}</span>
        {body.massProperties && (
          <>
            <span>Volume: {body.massProperties.volume.toFixed(2)}</span>
            <span>Mass: {body.massProperties.mass.toFixed(2)}</span>
            <span>Area: {body.massProperties.surfaceArea.toFixed(2)}</span>
          </>
        )}
      </div>
    </div>
  )
}
