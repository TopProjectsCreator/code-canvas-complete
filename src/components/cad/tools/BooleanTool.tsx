import { useState } from 'react'
import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BooleanFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function BooleanTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [operation, setOperation] = useState('union')
  const [keepTools, setKeepTools] = useState('false')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return
    const feat: BooleanFeature = {
      id: generateId(),
      name: `Boolean`,
      type: 'boolean',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [],
      operation: operation as any,
      targetBodyId: firstBodyId,
      toolBodyIds: bodies.slice(1).map(b => b.id),
      keepTools: keepTools === 'true',
      tolerance: 0.1,
    }
    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Apply boolean operation between bodies.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Operation</Label>
        <Select value={operation} onValueChange={setOperation}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="union" className="text-xs">Union</SelectItem>
            <SelectItem value="subtract" className="text-xs">Subtract</SelectItem>
            <SelectItem value="intersect" className="text-xs">Intersect</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Keep Tools</Label>
        <Select value={keepTools} onValueChange={setKeepTools}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="false" className="text-xs">No</SelectItem>
            <SelectItem value="true" className="text-xs">Yes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Apply Boolean
      </Button>
    </div>
  )
}
