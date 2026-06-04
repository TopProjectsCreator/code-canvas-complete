import { useState } from 'react'
import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MirrorFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function MirrorTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [mirrorPlane, setMirrorPlane] = useState('xy')
  const [merge, setMerge] = useState('true')
  const [weld, setWeld] = useState('true')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id

  const handleCreate = () => {
    if (!firstBodyId) return

    const planeMap: Record<string, any> = {
      xy: { type: 'standard' as const, plane: 'xy' as const },
      xz: { type: 'standard' as const, plane: 'xz' as const },
      yz: { type: 'standard' as const, plane: 'yz' as const },
    }

    const feat: MirrorFeature = {
      id: generateId(),
      name: `Mirror`,
      type: 'mirror',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [],
      bodyIds: [firstBodyId],
      mirrorPlane: planeMap[mirrorPlane],
      merge: merge === 'true',
      weld: weld === 'true',
      weldTolerance: 0.1,
    }

    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Mirror selected body across a plane.
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Mirror Plane</Label>
        <Select value={mirrorPlane} onValueChange={setMirrorPlane}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="xy" className="text-xs">XY Plane</SelectItem>
            <SelectItem value="xz" className="text-xs">XZ Plane</SelectItem>
            <SelectItem value="yz" className="text-xs">YZ Plane</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Merge</Label>
        <Select value={merge} onValueChange={setMerge}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-xs">Yes</SelectItem>
            <SelectItem value="false" className="text-xs">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Weld</Label>
        <Select value={weld} onValueChange={setWeld}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-xs">Yes</SelectItem>
            <SelectItem value="false" className="text-xs">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate}>
        Create Mirror
      </Button>
    </div>
  )
}
