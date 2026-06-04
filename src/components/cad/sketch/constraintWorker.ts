import { buildAndSolve } from './ConstraintBuilder'
import type { SketchEntity, Constraint } from '../types'

export interface ConstraintWorkerRequest {
  entities: SketchEntity[]
  constraints: Constraint[]
}

export interface ConstraintWorkerResult {
  status: { dof: number; status: 'under' | 'full' | 'over' }
  updatedEntities: { id: string; params: Record<string, number> }[]
  iterations: number
  residual: number
  converged: boolean
}

export function solveSketch(request: ConstraintWorkerRequest): ConstraintWorkerResult {
  const { result, status, updatedEntities } = buildAndSolve(request.entities, request.constraints)
  return {
    status,
    updatedEntities,
    iterations: result?.iterations ?? 0,
    residual: result?.residual ?? 0,
    converged: result?.converged ?? false,
  }
}
