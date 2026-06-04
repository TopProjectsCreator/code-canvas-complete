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
import type { ExtrudeFeature, RevolveFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function FeatureTool() {
  const toolMode = useCADStore(s => s.toolMode)
  const activeSketch = useCADStore(s => s.activeSketch)
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)
  const endSketch = useCADStore(s => s.endSketch)

  const [depth, setDepth] = useState('10')
  const [angle, setAngle] = useState('360')
  const [mergeType, setMergeType] = useState<string>('new-body')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const sketch = activeSketch ? doc.sketches[activeSketch] : null
  const hasEntities = sketch && Object.keys(sketch.entities).length > 0

  const handleExtrude = () => {
    if (!firstBodyId || !activeSketch) return

    const feat: ExtrudeFeature = {
      id: generateId(),
      name: `Extrude`,
      type: 'extrude',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [activeSketch],
      sketchId: activeSketch,
      direction: 'forward',
      endCondition: 'blind',
      depth: parseFloat(depth) || 10,
      mergeType: mergeType as any,
    }

    addFeature(firstBodyId, feat as any)
    endSketch()
    setToolMode('select')
  }

  const handleRevolve = () => {
    if (!firstBodyId || !activeSketch) return

    const feat: RevolveFeature = {
      id: generateId(),
      name: `Revolve`,
      type: 'revolve',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [activeSketch],
      sketchId: activeSketch,
      axis: { type: 'standard', axis: 'z' },
      angle: parseFloat(angle) || 360,
      startAngle: 0,
      endCondition: 'blind',
      mergeType: mergeType as any,
    }

    addFeature(firstBodyId, feat as any)
    endSketch()
    setToolMode('select')
  }

  if (!activeSketch) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No active sketch. Click Sketch tool to start one.
      </div>
    )
  }

  if (!hasEntities) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Sketch is empty. Draw some entities first.
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-medium">
        Create from Sketch: {sketch?.id.slice(0, 12)}...
      </div>

      <div className="text-[10px] text-muted-foreground">
        {Object.keys(sketch?.entities ?? {}).length} entity(ies), {sketch?.constraints.length ?? 0} constraint(s)
      </div>

      {toolMode === 'extrude' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Depth</Label>
            <Input
              className="h-7 text-xs font-mono"
              type="number"
              value={depth}
              onChange={e => setDepth(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Merge</Label>
            <Select value={mergeType} onValueChange={setMergeType}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new-body" className="text-xs">New Body</SelectItem>
                <SelectItem value="add" className="text-xs">Add</SelectItem>
                <SelectItem value="subtract" className="text-xs">Subtract</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" className="w-full h-7 text-xs" onClick={handleExtrude}>
            Create Extrude
          </Button>
        </div>
      )}

      {toolMode === 'revolve' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Angle</Label>
            <Input
              className="h-7 text-xs font-mono"
              type="number"
              value={angle}
              onChange={e => setAngle(e.target.value)}
              min={1}
              max={360}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Merge</Label>
            <Select value={mergeType} onValueChange={setMergeType}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new-body" className="text-xs">New Body</SelectItem>
                <SelectItem value="add" className="text-xs">Add</SelectItem>
                <SelectItem value="subtract" className="text-xs">Subtract</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" className="w-full h-7 text-xs" onClick={handleRevolve}>
            Create Revolve
          </Button>
        </div>
      )}
    </div>
  )
}
