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
import type { LoftFeature } from '../types'

function generateId(): string {
  return `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function LoftTool() {
  const doc = useCADStore(s => s.doc)
  const addFeature = useCADStore(s => s.addFeature)
  const setToolMode = useCADStore(s => s.setToolMode)

  const [sectionIds, setSectionIds] = useState<string[]>([])
  const [blend, setBlend] = useState('smooth')
  const [closed, setClosed] = useState('false')
  const [mergeType, setMergeType] = useState('new-body')

  const bodies = Object.values(doc.bodies)
  const firstBodyId = bodies[0]?.id
  const sketches = Object.entries(doc.sketches).map(([id, s]) => ({ id, entityCount: Object.keys(s.entities).length }))

  const toggleSection = (id: string) => {
    setSectionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleCreate = () => {
    if (!firstBodyId || sectionIds.length < 2) return

    const feat: LoftFeature = {
      id: generateId(),
      name: `Loft`,
      type: 'loft',
      visible: true,
      suppressed: false,
      bodyId: firstBodyId,
      featureIndex: 0,
      dependencies: [...sectionIds],
      sectionIds,
      blend: blend as any,
      closed: closed === 'true',
      mergeType: mergeType as any,
    }

    addFeature(firstBodyId, feat as any)
    setToolMode('select')
  }

  if (sketches.length < 2) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Need at least 2 sketches for a loft. Create more sketches first.
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] text-muted-foreground">
        Select 2+ sketch sections (Ctrl+click to multi-select).
      </div>

      <div className="text-[10px] font-medium">
        Sections ({sectionIds.length} selected):
      </div>

      <div className="max-h-32 overflow-y-auto space-y-0.5">
        {sketches.map(s => (
          <label
            key={s.id}
            className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] cursor-pointer hover:bg-accent ${
              sectionIds.includes(s.id) ? 'bg-accent font-medium' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={sectionIds.includes(s.id)}
              onChange={() => toggleSection(s.id)}
              className="w-3 h-3"
            />
            <span>{s.id.slice(0, 14)}... ({s.entityCount} ents)</span>
          </label>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Blend</Label>
        <Select value={blend} onValueChange={setBlend}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="straight" className="text-xs">Straight</SelectItem>
            <SelectItem value="smooth" className="text-xs">Smooth</SelectItem>
            <SelectItem value="continuous" className="text-xs">Continuous</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Closed</Label>
        <Select value={closed} onValueChange={setClosed}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="false" className="text-xs">No</SelectItem>
            <SelectItem value="true" className="text-xs">Yes</SelectItem>
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
        disabled={sectionIds.length < 2}>
        Create Loft
      </Button>
    </div>
  )
}
