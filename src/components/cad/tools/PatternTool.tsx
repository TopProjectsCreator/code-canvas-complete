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
import type { PatternFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function PatternTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [patternType, setPatternType] = useState('linear')
  const [count1, setCount1] = useState('3')
  const [spacing1, setSpacing1] = useState('10')
  const [count2, setCount2] = useState('1')
  const [spacing2, setSpacing2] = useState('10')
  const [angle, setAngle] = useState('360')
  const [count, setCount] = useState('6')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return

    const feat: PatternFeature = {
      id: generateId(),
      name: `Pattern`,
      type: 'pattern',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [],
      patternType: patternType as any,
      bodyIds: [firstBodyId],
      direction1: [1, 0, 0],
      count1: parseInt(count1) || 3,
      spacing1: parseInt(spacing1) || 10,
      direction2: [0, 0, 1],
      count2: patternType === 'linear' ? (parseInt(count2) || 1) : undefined,
      spacing2: patternType === 'linear' ? (parseInt(spacing2) || 10) : undefined,
      axis: { type: 'standard', axis: 'z' },
      angle: patternType === 'circular' ? (parseFloat(angle) || 360) : undefined,
      count: patternType === 'circular' ? (parseInt(count) || 6) : undefined,
      equispaced: true,
      instanceRotation: true,
    }

    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Pattern the selected body.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Pattern Type</Label>
        <Select value={patternType} onValueChange={setPatternType}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="linear" className="text-xs">Linear</SelectItem>
            <SelectItem value="circular" className="text-xs">Circular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {patternType === 'linear' && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px]">Direction 1 Count</Label>
            <Input className="h-7 text-xs font-mono" type="number" value={count1}
              onChange={e => setCount1(e.target.value)} min={1} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Direction 1 Spacing</Label>
            <Input className="h-7 text-xs font-mono" type="number" value={spacing1}
              onChange={e => setSpacing1(e.target.value)} min={0.1} step={0.5} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Direction 2 Count</Label>
            <Input className="h-7 text-xs font-mono" type="number" value={count2}
              onChange={e => setCount2(e.target.value)} min={1} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Direction 2 Spacing</Label>
            <Input className="h-7 text-xs font-mono" type="number" value={spacing2}
              onChange={e => setSpacing2(e.target.value)} min={0.1} step={0.5} />
          </div>
        </>
      )}

      {patternType === 'circular' && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px]">Count</Label>
            <Input className="h-7 text-xs font-mono" type="number" value={count}
              onChange={e => setCount(e.target.value)} min={2} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Angle</Label>
            <Input className="h-7 text-xs font-mono" type="number" value={angle}
              onChange={e => setAngle(e.target.value)} min={1} max={360} step={5} />
          </div>
        </>
      )}

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Pattern
      </Button>
    </div>
  )
}
