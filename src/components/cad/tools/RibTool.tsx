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
import type { RibFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function RibTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)
  const activeSketch = useCADStore(s => s.activeSketch)

  const [thickness, setThickness] = useState('2')
  const [depth, setDepth] = useState('10')
  const [direction, setDirection] = useState('symmetric')
  const [draftAngle, setDraftAngle] = useState('0')
  const [extension, setExtension] = useState('limited')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return

    const feat: RibFeature = {
      id: generateId(),
      name: `Rib`,
      type: 'rib',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: activeSketch ? [activeSketch] : [],
      sketchId: activeSketch ?? `sketch_${generateId()}`,
      thickness: parseFloat(thickness) || 2,
      direction: direction as any,
      draftAngle: parseFloat(draftAngle) || 0,
      extension: extension as any,
      depth: parseFloat(depth) || 10,
    }

    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Create a rib from a sketch profile.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Thickness</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={thickness}
          onChange={e => setThickness(e.target.value)} min={0.1} step={0.1} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Depth</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={depth}
          onChange={e => setDepth(e.target.value)} min={1} step={1} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Direction</Label>
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="side1" className="text-xs">Side 1</SelectItem>
            <SelectItem value="side2" className="text-xs">Side 2</SelectItem>
            <SelectItem value="symmetric" className="text-xs">Symmetric</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Draft Angle</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={draftAngle}
          onChange={e => setDraftAngle(e.target.value)} min={0} max={45} step={0.5} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Extension</Label>
        <Select value={extension} onValueChange={setExtension}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="limited" className="text-xs">Limited</SelectItem>
            <SelectItem value="to-next" className="text-xs">To Next</SelectItem>
            <SelectItem value="to-surface" className="text-xs">To Surface</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Rib
      </Button>
    </div>
  )
}
