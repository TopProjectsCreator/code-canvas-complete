import { useState } from 'react'
import { useCADStore } from '../store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { Dimension } from '../types'

function generateId(): string {
  return `dim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function SketchDimensions() {
  const doc = useCADStore(s => s.doc)
  const activeSketch = useCADStore(s => s.activeSketch)
  const selection = useCADStore(s => s.selection)
  const [value, setValue] = useState('10')

  const sketch = activeSketch ? doc.sketches[activeSketch] : null

  const selectedEntityId = selection.find(s => s.type === 'sketch-entity' && s.sketchId === activeSketch)?.entityId

  if (!sketch) return null

  const dimensions = Object.values(sketch.dimensions)

  const handleAdd = () => {
    if (!selectedEntityId || !activeSketch) return
    const dim: Dimension = {
      id: generateId(),
      entityId: selectedEntityId,
      value: parseFloat(value) || 0,
      precision: 2,
    }
    useCADStore.getState().addDimension(activeSketch, dim)
  }

  const handleRemove = (dimId: string) => {
    if (!activeSketch) return
    useCADStore.getState().removeDimension(activeSketch, dimId)
  }

  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-medium text-muted-foreground">Dimensions</Label>

      {selectedEntityId && (
        <div className="flex items-center gap-1">
          <Input
            className="h-6 text-[11px] font-mono w-16"
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={handleAdd}>
            Add
          </Button>
        </div>
      )}

      {dimensions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1 max-h-[100px] overflow-auto">
            {dimensions.map(d => (
              <div key={d.id} className="flex items-center justify-between px-1 py-0.5 rounded hover:bg-accent/50">
                <span className="text-[10px] font-mono">{d.value}</span>
                <button
                  className="text-[10px] text-red-500 hover:text-red-700"
                  onClick={() => handleRemove(d.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
