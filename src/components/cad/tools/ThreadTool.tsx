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

export function ThreadTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)
  const activeSketch = useCADStore(s => s.activeSketch)

  const [diameter, setDiameter] = useState('10')
  const [depth, setDepth] = useState('15')
  const [pitch, setPitch] = useState('1.5')
  const [threadClass, setThreadClass] = useState('6H')
  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return

    const feat: HoleFeature = {
      id: generateId(),
      name: `Threaded Hole`,
      type: 'hole',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: activeSketch ? [activeSketch] : [],
      sketchId: activeSketch ?? `sketch_${generateId()}`,
      holeType: 'tapped',
      diameter: parseFloat(diameter) || 10,
      depth: parseFloat(depth) || 15,
      endCondition: 'blind',
      thread: {
        standard: 'iso',
        size: `M${parseFloat(diameter) || 10}`,
        pitch: parseFloat(pitch) || 1.5,
        class: threadClass,
        direction: 'right',
        modeled: true,
        majorDiameter: parseFloat(diameter) || 10,
        minorDiameter: (parseFloat(diameter) || 10) * 0.85,
        depth: parseFloat(depth) || 15,
      },
    }

    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Create a threaded hole.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Major Diameter</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={diameter}
          onChange={e => setDiameter(e.target.value)} min={2} max={100} step={0.5} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Depth</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={depth}
          onChange={e => setDepth(e.target.value)} min={1} step={1} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Pitch</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={pitch}
          onChange={e => setPitch(e.target.value)} min={0.25} max={10} step={0.25} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Thread Class</Label>
        <Select value={threadClass} onValueChange={setThreadClass}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="4H" className="text-xs">4H</SelectItem>
            <SelectItem value="5H" className="text-xs">5H</SelectItem>
            <SelectItem value="6H" className="text-xs">6H</SelectItem>
            <SelectItem value="7H" className="text-xs">7H</SelectItem>
            <SelectItem value="6g" className="text-xs">6g</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Threaded Hole
      </Button>
    </div>
  )
}
