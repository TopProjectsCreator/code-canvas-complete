import type { SketchEntity, Constraint as SkConstraint } from '../types'
import { buildConstraints, solveConstraints, computeDOF, type SolverParams, type SolverConstraint, type SolverResult } from './ConstraintSolver'

function getEntityPoints(entity: SketchEntity): { x: number; y: number }[] {
  const p = entity.params as Record<string, number>
  switch (entity.type) {
    case 'line':
      return [{ x: p.x1 ?? 0, y: p.y1 ?? 0 }, { x: p.x2 ?? 0, y: p.y2 ?? 0 }]
    case 'circle':
      return [{ x: p.cx ?? 0, y: p.cy ?? 0 }]
    case 'rectangle':
      return [
        { x: p.x ?? 0, y: p.y ?? 0 },
        { x: (p.x ?? 0) + (p.width ?? 10), y: p.y ?? 0 },
        { x: (p.x ?? 0) + (p.width ?? 10), y: (p.y ?? 0) + (p.height ?? 10) },
        { x: p.x ?? 0, y: (p.y ?? 0) + (p.height ?? 10) },
      ]
    default:
      return []
  }
}

export interface EntitySolverMapping {
  entityId: string
  pointIndices: number[]
  updateParams: (points: { x: number; y: number }[]) => Record<string, number>
}

export function buildSolverMapping(entities: SketchEntity[]): {
  mapping: EntitySolverMapping[]
  params: SolverParams
} {
  const mapping: EntitySolverMapping[] = []
  const points: { x: number; y: number }[] = []
  const radii: number[] = []
  let pointOffset = 0

  for (const ent of entities) {
    const entPoints = getEntityPoints(ent)
    const indices: number[] = []

    for (const pt of entPoints) {
      indices.push(pointOffset)
      points.push(pt)
      pointOffset++
    }

    if (ent.type === 'circle') {
      const p = ent.params as Record<string, number>
      radii.push(p.radius ?? 5)
    }

    mapping.push({
      entityId: ent.id,
      pointIndices: indices,
      updateParams: (solved) => {
        const newParams: Record<string, number> = {}
        if (ent.type === 'line') {
          newParams.x1 = solved[indices[0]]?.x ?? 0
          newParams.y1 = solved[indices[0]]?.y ?? 0
          newParams.x2 = solved[indices[1]]?.x ?? 0
          newParams.y2 = solved[indices[1]]?.y ?? 0
        } else if (ent.type === 'circle') {
          newParams.cx = solved[indices[0]]?.x ?? 0
          newParams.cy = solved[indices[0]]?.y ?? 0
        } else if (ent.type === 'rectangle') {
          const x0 = solved[indices[0]]?.x ?? 0
          const y0 = solved[indices[0]]?.y ?? 0
          const x2 = solved[indices[2]]?.x ?? 0
          const y2 = solved[indices[2]]?.y ?? 0
          newParams.x = Math.min(x0, x2)
          newParams.y = Math.min(y0, y2)
          newParams.width = Math.abs(x2 - x0)
          newParams.height = Math.abs(y2 - y0)
        }
        return newParams
      },
    })
  }

  return {
    mapping,
    params: { points, radii },
  }
}

export function buildAndSolve(
  entities: SketchEntity[],
  constraints: SkConstraint[]
): {
  result: SolverResult | null
  status: { dof: number; status: 'under' | 'full' | 'over' }
  updatedEntities: { id: string; params: Record<string, number> }[]
} {
  const { mapping, params } = buildSolverMapping(entities)
  const nEntities = mapping.length
  const anyFixed = constraints.some(c => c.type === 'fix')

  if (!anyFixed && nEntities > 0) {
    for (const m of mapping) {
      if (m.pointIndices.length > 0) {
        constraints.push({
          id: `fix_gen_${m.entityId}`,
          type: 'fix',
          entityIds: [m.entityId],
          driving: true,
        })
        break
      }
    }
  }

  const pointMap: Record<string, number[]> = {}
  for (const m of mapping) {
    pointMap[m.entityId] = m.pointIndices
  }

  const solverConstraints: SolverConstraint[] = buildConstraints({
    constraints: constraints.map(c => ({
      type: c.type,
      entityIds: c.entityIds,
      pointIndices: c.entityIds.map(eid => pointMap[eid] || []).flat(),
      value: c.params?.value as number | undefined,
    })),
    pointMap,
  })

  const result = solveConstraints(params, solverConstraints, { maxIterations: 200, tolerance: 1e-4 })

  const status = computeDOF(params.points.length, constraints.length)

  const updatedEntities = mapping.map(m => ({
    id: m.entityId,
    params: m.updateParams(result.params.points),
  }))

  return { result, status, updatedEntities }
}
