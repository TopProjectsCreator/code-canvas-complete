import { useState } from 'react'
import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { ShellFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function ShellTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [thickness, setThickness] = useState('2')
  const [showBodies, setShowBodies] = useState(false)

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return
    const feat: ShellFeature = {
      id: generateId(),
      name: `Shell`,
      type: 'shell',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [],
      thickness: parseFloat(thickness) || 2,
      direction: 'inside',
      openFaces: [],
    }
    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Select faces to remove, then set wall thickness.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Wall Thickness</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={thickness}
          onChange={e => setThickness(e.target.value)} min={0.1} step={0.1} />
      </div>

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Shell
      </Button>
    </div>
  )
}
