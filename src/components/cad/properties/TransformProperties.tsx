import { useCADStore } from '../store'
import { NumericInput } from '../ui/NumericInput'
import { Label } from '@/components/ui/label'

export function TransformProperties() {
  const selection = useCADStore(s => s.selection)
  const updateTransform = useCADStore(s => s.updateTransform)
  const doc = useCADStore(s => s.doc)

  const nodeSel = selection.find(s => s.type === 'node')
  if (!nodeSel) return null

  function findNode() {
    function search(nodes: typeof doc.scene): (typeof doc.scene)[0] | null {
      for (const n of nodes) {
        if (n.id === nodeSel.nodeId) return n
        const found = search(n.children)
        if (found) return found
      }
      return null
    }
    return search(doc.scene)
  }

  const node = findNode()
  if (!node) return null

  function handleChange(axis: number, value: number, field: 'position' | 'rotation' | 'scale') {
    const update: Record<string, number[]> = {}
    update[field] = [...node.transform[field]]
    update[field][axis] = value
    updateTransform(node.id, update as any)
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">Transform</div>

      {(['position', 'rotation', 'scale'] as const).map(field => (
        <div key={field} className="space-y-1">
          <Label className="text-[10px] capitalize text-muted-foreground">{field}</Label>
          <div className="grid grid-cols-3 gap-1">
            {['X', 'Y', 'Z'].map((axis, i) => (
              <div key={axis} className="flex items-center gap-1">
                <span className="text-[10px] font-mono w-3 text-muted-foreground">{axis}</span>
                <NumericInput
                  value={node.transform[field][i]}
                  onChange={v => handleChange(i, v, field)}
                  className="h-6"
                  step={field === 'rotation' ? 1 : 0.1}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
