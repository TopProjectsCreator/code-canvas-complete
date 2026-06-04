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
import type { HoleFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function HoleTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)
  const activeSketch = useCADStore(s => s.activeSketch)

  const [diameter, setDiameter] = useState('5')
  const [depth, setDepth] = useState('10')
  const [holeType, setHoleType] = useState('simple')
  const [cboreDiameter, setCboreDiameter] = useState('8')
  const [cboreDepth, setCboreDepth] = useState('3')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return
    const feat: HoleFeature = {
      id: generateId(),
      name: `Hole`,
      type: 'hole',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [],
      sketchId: activeSketch ?? '',
      holeType: holeType as any,
      diameter: parseFloat(diameter) || 5,
      depth: parseFloat(depth) || 10,
      endCondition: 'through-all',
      cboreDiameter: holeType === 'counterbore' ? (parseFloat(cboreDiameter) || 8) : undefined,
      cboreDepth: holeType === 'counterbore' ? (parseFloat(cboreDepth) || 3) : undefined,
      thread: { majorDiameter: parseFloat(diameter) || 5, minorDiameter: (parseFloat(diameter) || 5) * 0.8, pitch: 1, depth: (parseFloat(depth) || 10), class: '6H' },
    }
    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      {!activeSketch && (
        <div className="text-[10px] text-muted-foreground mb-2">
          No active sketch. Click Sketch tool to define hole position.
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[10px]">Hole Type</Label>
        <Select value={holeType} onValueChange={setHoleType}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="simple" className="text-xs">Simple</SelectItem>
            <SelectItem value="counterbore" className="text-xs">Counterbore</SelectItem>
            <SelectItem value="countersink" className="text-xs">Countersink</SelectItem>
            <SelectItem value="tapped" className="text-xs">Tapped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Diameter</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={diameter}
          onChange={e => setDiameter(e.target.value)} min={0.5} step={0.5} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Depth</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={depth}
          onChange={e => setDepth(e.target.value)} min={1} step={1} />
      </div>

      {holeType === 'counterbore' && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px]">CBore Diameter</Label>
            <Input className="h-7 text-xs font-mono" type="number" value={cboreDiameter}
              onChange={e => setCboreDiameter(e.target.value)} min={1} step={0.5} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">CBore Depth</Label>
            <Input className="h-7 text-xs font-mono" type="number" value={cboreDepth}
              onChange={e => setCboreDepth(e.target.value)} min={0.5} step={0.5} />
          </div>
        </>
      )}

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Hole
      </Button>
    </div>
  )
}
