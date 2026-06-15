import { useState } from 'react'
import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DraftFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function DraftTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [angle, setAngle] = useState('5')
  const [direction, setDirection] = useState('pull-direction')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return
    const feat: DraftFeature = {
      id: generateId(),
      name: `Draft`,
      type: 'draft',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [],
      faces: [],
      mode: 'face',
      angle: parseFloat(angle) || 5,
      neutralPlane: { type: 'standard', plane: 'xy' },
      pullDirection: [0, 0, 1],
    }
    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Select faces to draft, then set angle.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Angle</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={angle}
          onChange={e => setAngle(e.target.value)} min={0.1} max={45} step={0.5} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Direction</Label>
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pull-direction" className="text-xs">Pull Direction</SelectItem>
            <SelectItem value="neutral-plane" className="text-xs">Neutral Plane</SelectItem>
            <SelectItem value="split-line" className="text-xs">Split Line</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Draft
      </Button>
    </div>
  )
}
