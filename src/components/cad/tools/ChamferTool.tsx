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
import type { ChamferFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function ChamferTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [distance1, setDistance1] = useState('2')
  const [distance2, setDistance2] = useState('1')
  const [mode, setMode] = useState('equal')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return
    const feat: ChamferFeature = {
      id: generateId(),
      name: `Chamfer`,
      type: 'chamfer',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [],
      edges: [],
      mode: mode as any,
      distance1: parseFloat(distance1) || 2,
      distance2: mode === 'two-distance' ? (parseFloat(distance2) || 1) : undefined,
      tangentPropagation: true,
    }
    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Select edges in the viewport, then set distances below.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Mode</Label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="equal" className="text-xs">Equal Distance</SelectItem>
            <SelectItem value="two-distance" className="text-xs">Two Distances</SelectItem>
            <SelectItem value="distance-angle" className="text-xs">Distance & Angle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Distance 1</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={distance1}
          onChange={e => setDistance1(e.target.value)} min={0.1} step={0.1} />
      </div>

      {mode === 'two-distance' && (
        <div className="space-y-1">
          <Label className="text-[10px]">Distance 2</Label>
          <Input className="h-7 text-xs font-mono" type="number" value={distance2}
            onChange={e => setDistance2(e.target.value)} min={0.1} step={0.1} />
        </div>
      )}

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Chamfer
      </Button>
    </div>
  )
}
