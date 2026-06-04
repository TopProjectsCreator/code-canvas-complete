import { useMemo } from 'react'
import { useCADStore } from '../store'
import type { SketchEntity } from '../types'

function countOpenEndpoints(entities: SketchEntity[]): number {
  const endpoints: { x: number; y: number; count: number }[] = []

  for (const ent of entities) {
    const p = ent.params as Record<string, number>
    if (ent.type === 'line') {
      endpoints.push({ x: p.x1 ?? 0, y: p.y1 ?? 0, count: 1 })
      endpoints.push({ x: p.x2 ?? 0, y: p.y2 ?? 0, count: 1 })
    } else if (ent.type === 'rectangle') {
      const x = p.x ?? 0, y = p.y ?? 0, w = p.width ?? 10, h = p.height ?? 10
      endpoints.push({ x, y, count: 1 })
      endpoints.push({ x: x + w, y, count: 1 })
      endpoints.push({ x: x + w, y: y + h, count: 1 })
      endpoints.push({ x, y: y + h, count: 1 })
    }
  }

  const threshold = 0.01
  let openCount = 0

  for (const ep of endpoints) {
    let matched = false
    for (const other of endpoints) {
      if (ep === other) continue
      const dx = ep.x - other.x
      const dy = ep.y - other.y
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        matched = true
        break
      }
    }
    if (!matched) openCount++
  }

  return openCount
}

function countOverlapping(entities: SketchEntity[]): number {
  let overlaps = 0
  const ents = Object.values(entities)

  for (let i = 0; i < ents.length; i++) {
    for (let j = i + 1; j < ents.length; j++) {
      const a = ents[i], b = ents[j]
      const pa = a.params as Record<string, number>
      const pb = b.params as Record<string, number>

      if (a.type === 'circle' && b.type === 'circle') {
        const dx = (pa.cx ?? 0) - (pb.cx ?? 0)
        const dy = (pa.cy ?? 0) - (pb.cy ?? 0)
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < (pa.radius ?? 5) + (pb.radius ?? 5) - 0.01) overlaps++
      }
    }
  }

  return overlaps
}

export function SketchAnalysis() {
  const doc = useCADStore(s => s.doc)
  const activeSketch = useCADStore(s => s.activeSketch)

  const sketch = activeSketch ? doc.sketches[activeSketch] : null
  const entities = sketch ? Object.values(sketch.entities) : []

  const stats = useMemo(() => {
    const byType: Record<string, number> = {}
    for (const ent of entities) {
      byType[ent.type] = (byType[ent.type] || 0) + 1
    }

    return {
      total: entities.length,
      byType,
      openEndpoints: countOpenEndpoints(entities),
      overlaps: countOverlapping(entities),
      constraints: sketch?.constraints.length ?? 0,
      dof: sketch?.solverState.dof ?? 0,
      solverStatus: sketch?.solverState.status ?? 'unknown',
    }
  }, [entities, sketch])

  if (!sketch) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No active sketch to analyze.
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2 text-xs">
      <div className="text-xs font-medium mb-1">Sketch Analysis</div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <span className="text-muted-foreground">Total entities:</span><span>{stats.total}</span>
        <span className="text-muted-foreground">Constraints:</span><span>{stats.constraints}</span>
        <span className="text-muted-foreground">DOF:</span>
        <span className={stats.dof === 0 ? 'text-green-400' : stats.dof > 0 ? 'text-yellow-400' : 'text-red-400'}>
          {stats.dof}
        </span>
        <span className="text-muted-foreground">Status:</span>
        <span className={
          stats.solverStatus === 'full' ? 'text-green-400' :
          stats.solverStatus === 'under' ? 'text-yellow-400' :
          stats.solverStatus === 'over' ? 'text-red-400' : ''
        }>{stats.solverStatus}</span>
      </div>

      {Object.keys(stats.byType).length > 0 && (
        <div className="pt-1">
          <div className="text-[10px] text-muted-foreground mb-1">By Type</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            {Object.entries(stats.byType).map(([type, count]) => (
              <span key={type}>
                <span className="text-muted-foreground capitalize">{type}:</span> {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.openEndpoints > 0 && (
        <div className="text-[10px] text-yellow-400">
          ⚠ {stats.openEndpoints} open endpoint(s) — sketch may not form a closed profile
        </div>
      )}

      {stats.overlaps > 0 && (
        <div className="text-[10px] text-yellow-400">
          ⚠ {stats.overlaps} overlapping entit(ies)
        </div>
      )}
    </div>
  )
}
