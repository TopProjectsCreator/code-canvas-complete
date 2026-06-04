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
import type { CoilFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function CoilTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)
  const activeSketch = useCADStore(s => s.activeSketch)

  const [pitch, setPitch] = useState('3')
  const [revolutions, setRevolutions] = useState('5')
  const [height, setHeight] = useState('15')
  const [taperAngle, setTaperAngle] = useState('0')
  const [profile, setProfile] = useState('round')
  const [direction, setDirection] = useState('right')
  const [mergeType, setMergeType] = useState('new-body')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return

    const feat: CoilFeature = {
      id: generateId(),
      name: `Coil`,
      type: 'coil',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: activeSketch ? [activeSketch] : [],
      sketchId: activeSketch ?? `sketch_${generateId()}`,
      axis: { type: 'standard', axis: 'z' },
      pitch: parseFloat(pitch) || 3,
      revolutions: parseFloat(revolutions) || 5,
      height: parseFloat(height) || 15,
      direction: direction as any,
      taperAngle: parseFloat(taperAngle) || 0,
      profile: profile as any,
      profileParams: {},
      mergeType: mergeType as any,
    }

    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Create a helical coil/spring.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Pitch</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={pitch}
          onChange={e => setPitch(e.target.value)} min={0.5} step={0.5} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Revolutions</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={revolutions}
          onChange={e => setRevolutions(e.target.value)} min={1} max={100} step={1} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Height</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={height}
          onChange={e => setHeight(e.target.value)} min={1} step={1} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Taper Angle</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={taperAngle}
          onChange={e => setTaperAngle(e.target.value)} min={0} max={45} step={1} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Profile</Label>
        <Select value={profile} onValueChange={setProfile}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="round" className="text-xs">Round</SelectItem>
            <SelectItem value="rectangular" className="text-xs">Rectangular</SelectItem>
            <SelectItem value="trapezoidal" className="text-xs">Trapezoidal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Direction</Label>
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="right" className="text-xs">Right</SelectItem>
            <SelectItem value="left" className="text-xs">Left</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Merge</Label>
        <Select value={mergeType} onValueChange={setMergeType}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new-body" className="text-xs">New Body</SelectItem>
            <SelectItem value="add" className="text-xs">Add</SelectItem>
            <SelectItem value="subtract" className="text-xs">Subtract</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Coil
      </Button>
    </div>
  )
}
