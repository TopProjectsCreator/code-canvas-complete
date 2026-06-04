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
import type { FilletFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function FilletTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [radius, setRadius] = useState('2')
  const [mode, setMode] = useState('constant')
  const [blendType, setBlendType] = useState('circular')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return
    const feat: FilletFeature = {
      id: generateId(),
      name: `Fillet`,
      type: 'fillet',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [],
      edges: [],
      radius: parseFloat(radius) || 2,
      mode: mode as any,
      blendType: blendType as any,
      tangentPropagation: true,
      overflow: 'default',
    }
    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Select edges in the viewport, then set radius below.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Radius</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={radius}
          onChange={e => setRadius(e.target.value)} min={0.1} step={0.1} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Mode</Label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="constant" className="text-xs">Constant</SelectItem>
            <SelectItem value="variable" className="text-xs">Variable</SelectItem>
            <SelectItem value="full-round" className="text-xs">Full Round</SelectItem>
            <SelectItem value="face-blend" className="text-xs">Face Blend</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Blend Type</Label>
        <Select value={blendType} onValueChange={setBlendType}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="circular" className="text-xs">Circular</SelectItem>
            <SelectItem value="conic" className="text-xs">Conic</SelectItem>
            <SelectItem value="curvature-continuous" className="text-xs">Curvature</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Fillet
      </Button>
    </div>
  )
}
