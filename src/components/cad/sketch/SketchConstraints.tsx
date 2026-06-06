import { useMemo } from 'react'
import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

function generateId(): string {
  return `con_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const CONSTRAINT_OPTIONS = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'coincident', label: 'Coincident' },
  { value: 'parallel', label: 'Parallel' },
  { value: 'perpendicular', label: 'Perpendicular' },
  { value: 'distance-aligned', label: 'Distance' },
  { value: 'fix', label: 'Fix' },
  { value: 'equal', label: 'Equal Length' },
] as const

export function SketchConstraints() {
  const doc = useCADStore(s => s.doc)
  const activeSketch = useCADStore(s => s.activeSketch)
  const addConstraint = useCADStore(s => s.addConstraint)
  const removeConstraint = useCADStore(s => s.removeConstraint)
  const selection = useCADStore(s => s.selection)

  const sketch = activeSketch ? doc.sketches[activeSketch] : null

  const entityIds = useMemo(() => {
    if (!sketch) return []
    return selection
      .filter((s): s is Extract<import('../types').SelectionTarget, { type: 'sketch-entity' }> =>
        s.type === 'sketch-entity' && s.sketchId === activeSketch)
      .map(s => s.entityId)
  }, [selection, sketch, activeSketch])

  if (!sketch) return null

  const handleAdd = (type: string) => {
    if (entityIds.length === 0) return

    const constraint = {
      id: generateId(),
      type: type as any,
      entityIds,
      driving: true,
    }
    addConstraint(sketch.id, constraint as any)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-medium text-muted-foreground">Constraints</Label>
        <span className="text-[10px] text-muted-foreground">
          DOF: {sketch.solverState.dof} ({sketch.solverState.status})
        </span>
      </div>

      {entityIds.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-muted-foreground">Add constraint ({entityIds.length} selected):</div>
          <div className="flex flex-wrap gap-1">
            {CONSTRAINT_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-1.5"
                onClick={() => handleAdd(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {sketch.constraints.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1 max-h-[120px] overflow-auto">
            {sketch.constraints.map(c => (
              <div key={c.id} className="flex items-center justify-between px-1 py-0.5 rounded hover:bg-accent/50">
                <span className="text-[10px] font-mono truncate">{c.type}</span>
                <button
                  className="text-[10px] text-red-500 hover:text-red-700"
                  onClick={() => removeConstraint(sketch.id, c.id)}
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
