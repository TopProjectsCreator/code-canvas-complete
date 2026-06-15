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
import type { SweepFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function SweepTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [profileSketchId, setProfileSketchId] = useState('')
  const [pathSketchId, setPathSketchId] = useState('')
  const [twistAngle, setTwistAngle] = useState('0')
  const [solid] = useState('true')
  const [alignment, setAlignment] = useState('free')
  const [mergeType, setMergeType] = useState('new-body')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id
  const sketches = Object.entries(doc.sketches).map(([id, s]) => ({ id, name: s.id, entityCount: Object.keys(s.entities).length }))

  const handleCreate = () => {
    if (!firstBodyId || !profileSketchId) return

    const feat: SweepFeature = {
      id: generateId(),
      name: `Sweep`,
      type: 'sweep',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [profileSketchId, pathSketchId || profileSketchId].filter(Boolean),
      profileSketchId,
      pathSketchId: pathSketchId || profileSketchId,
      twistAngle: parseFloat(twistAngle) || 0,
      solid: solid === 'true',
      alignment: alignment as any,
      mergeType: mergeType as any,
    }

    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  if (sketches.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No sketches available. Create a sketch first.
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Select profile sketch and path sketch (defaults to same sketch).
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Profile Sketch</Label>
        <Select value={profileSketchId} onValueChange={setProfileSketchId}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {sketches.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name.slice(0, 16)} ({s.entityCount} ents)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Path Sketch (optional)</Label>
        <Select value={pathSketchId} onValueChange={setPathSketchId}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Same as profile" /></SelectTrigger>
          <SelectContent>
            {sketches.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name.slice(0, 16)} ({s.entityCount} ents)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Twist Angle</Label>
        <Input className="h-7 text-xs font-mono" type="number" value={twistAngle}
          onChange={e => setTwistAngle(e.target.value)} min={0} max={360} step={5} />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Alignment</Label>
        <Select value={alignment} onValueChange={setAlignment}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="free" className="text-xs">Free</SelectItem>
            <SelectItem value="fixed" className="text-xs">Fixed</SelectItem>
            <SelectItem value="parallel" className="text-xs">Parallel</SelectItem>
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

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}
        disabled={!profileSketchId}>
        Create Sweep
      </Button>
    </div>
  )
}
