export interface SolverPoint {
  x: number
  y: number
}

export interface SolverParams {
  points: SolverPoint[]
  radii: number[]
}

export interface SolverConstraint {
  name: string
  error: (params: SolverParams) => number
  gradient: (params: SolverParams) => { pointIx: number; dx: number; dy: number }[]
}

export interface SolverResult {
  params: SolverParams
  iterations: number
  residual: number
  converged: boolean
}

function vecSub(a: SolverPoint, b: SolverPoint): SolverPoint {
  return { x: a.x - b.x, y: a.y - b.y }
}

function vecDot(a: SolverPoint, b: SolverPoint): number {
  return a.x * b.x + a.y * b.y
}

function horizConstraint(p1Ix: number, p2Ix: number): SolverConstraint {
  return {
    name: 'horizontal',
    error: (p) => p.points[p1Ix].y - p.points[p2Ix].y,
    gradient: () => {
      const g: { pointIx: number; dx: number; dy: number }[] = []
      if (p1Ix >= 0) g.push({ pointIx: p1Ix, dx: 0, dy: 1 })
      if (p2Ix >= 0) g.push({ pointIx: p2Ix, dx: 0, dy: -1 })
      return g
    },
  }
}

function vertConstraint(p1Ix: number, p2Ix: number): SolverConstraint {
  return {
    name: 'vertical',
    error: (p) => p.points[p1Ix].x - p.points[p2Ix].x,
    gradient: () => [{ pointIx: p1Ix, dx: 1, dy: 0 }, { pointIx: p2Ix, dx: -1, dy: 0 }],
  }
}

function coincidentConstraint(p1Ix: number, p2Ix: number): SolverConstraint[] {
  return [
    {
      name: 'coincident-x',
      error: (p) => p.points[p1Ix].x - p.points[p2Ix].x,
      gradient: () => [{ pointIx: p1Ix, dx: 1, dy: 0 }, { pointIx: p2Ix, dx: -1, dy: 0 }],
    },
    {
      name: 'coincident-y',
      error: (p) => p.points[p1Ix].y - p.points[p2Ix].y,
      gradient: () => [{ pointIx: p1Ix, dx: 0, dy: 1 }, { pointIx: p2Ix, dx: 0, dy: -1 }],
    },
  ]
}

function distanceConstraint(p1Ix: number, p2Ix: number, target: number): SolverConstraint {
  return {
    name: 'distance',
    error: (p) => {
      const dx = p.points[p1Ix].x - p.points[p2Ix].x
      const dy = p.points[p1Ix].y - p.points[p2Ix].y
      return Math.sqrt(dx * dx + dy * dy) - target
    },
    gradient: (p) => {
      const dx = p.points[p1Ix].x - p.points[p2Ix].x
      const dy = p.points[p1Ix].y - p.points[p2Ix].y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      return [
        { pointIx: p1Ix, dx: dx / len, dy: dy / len },
        { pointIx: p2Ix, dx: -dx / len, dy: -dy / len },
      ]
    },
  }
}

function fixConstraint(ptIx: number, target: SolverPoint): SolverConstraint[] {
  return [
    {
      name: 'fix-x',
      error: (p) => p.points[ptIx].x - target.x,
      gradient: () => [{ pointIx: ptIx, dx: 1, dy: 0 }],
    },
    {
      name: 'fix-y',
      error: (p) => p.points[ptIx].y - target.y,
      gradient: () => [{ pointIx: ptIx, dx: 0, dy: 1 }],
    },
  ]
}

function parallelConstraint(l1p1Ix: number, l1p2Ix: number, l2p1Ix: number, l2p2Ix: number): SolverConstraint {
  return {
    name: 'parallel',
    error: (p) => {
      const v1 = vecSub(p.points[l1p2Ix], p.points[l1p1Ix])
      const v2 = vecSub(p.points[l2p2Ix], p.points[l2p1Ix])
      return v1.x * v2.y - v1.y * v2.x
    },
    gradient: (p) => {
      const v1 = vecSub(p.points[l1p2Ix], p.points[l1p1Ix])
      const v2 = vecSub(p.points[l2p2Ix], p.points[l2p1Ix])
      return [
        { pointIx: l1p1Ix, dx: v1.y, dy: -v1.x },
        { pointIx: l1p2Ix, dx: -v2.y, dy: v2.x },
        { pointIx: l2p1Ix, dx: -v1.y, dy: v1.x },
        { pointIx: l2p2Ix, dx: v2.y, dy: -v2.x },
      ]
    },
  }
}

function perpendicularConstraint(l1p1Ix: number, l1p2Ix: number, l2p1Ix: number, l2p2Ix: number): SolverConstraint {
  return {
    name: 'perpendicular',
    error: (p) => {
      const v1 = vecSub(p.points[l1p2Ix], p.points[l1p1Ix])
      const v2 = vecSub(p.points[l2p2Ix], p.points[l2p1Ix])
      return vecDot(v1, v2)
    },
    gradient: (p) => {
      const v1 = vecSub(p.points[l1p2Ix], p.points[l1p1Ix])
      const v2 = vecSub(p.points[l2p2Ix], p.points[l2p1Ix])
      return [
        { pointIx: l1p1Ix, dx: -v2.x, dy: -v2.y },
        { pointIx: l1p2Ix, dx: v2.x, dy: v2.y },
        { pointIx: l2p1Ix, dx: -v1.x, dy: -v1.y },
        { pointIx: l2p2Ix, dx: v1.x, dy: v1.y },
      ]
    },
  }
}

function radiusConstraint(cxIx: number, target: number): SolverConstraint {
  return {
    name: 'radius',
    error: (p) => p.radii[cxIx] - target,
    gradient: () => [],
  }
}

export function buildConstraints(params: {
  constraints: {
    type: string
    entityIds: string[]
    pointIndices: number[]
    value?: number
  }[]
  pointMap: Record<string, number[]>
}): SolverConstraint[] {
  const result: SolverConstraint[] = []
  for (const c of params.constraints) {
    const pis = c.entityIds.map(eid => params.pointMap[eid] || []).flat()
    switch (c.type) {
      case 'horizontal':
        if (pis.length >= 2) result.push(horizConstraint(pis[0], pis[1]))
        break
      case 'vertical':
        if (pis.length >= 2) result.push(vertConstraint(pis[0], pis[1]))
        break
      case 'coincident':
        if (pis.length >= 2) result.push(...coincidentConstraint(pis[0], pis[1]))
        break
      case 'distance-aligned':
      case 'distance':
        if (pis.length >= 2) result.push(distanceConstraint(pis[0], pis[1], c.value ?? 10))
        break
      case 'fix':
        if (pis.length >= 1) result.push(...fixConstraint(pis[0], { x: 0, y: 0 }))
        break
      case 'parallel':
        if (pis.length >= 4) result.push(parallelConstraint(pis[0], pis[1], pis[2], pis[3]))
        break
      case 'perpendicular':
        if (pis.length >= 4) result.push(perpendicularConstraint(pis[0], pis[1], pis[2], pis[3]))
        break
      case 'radius':
        if (pis.length >= 1) result.push(radiusConstraint(pis[0], c.value ?? 5))
        break
    }
  }
  return result
}

export function solveConstraints(
  params: SolverParams,
  constraints: SolverConstraint[],
  options?: { maxIterations?: number; tolerance?: number; damping?: number }
): SolverResult {
  const maxIter = options?.maxIterations ?? 100
  const tol = options?.tolerance ?? 1e-6
  const damping = options?.damping ?? 0.8

  let iter = 0
  let residual = Infinity

  while (iter < maxIter) {
    const nConstraints = constraints.length
    const nParams = params.points.length * 2 + params.radii.length

    const C = new Float64Array(nConstraints)
    for (let i = 0; i < nConstraints; i++) {
      C[i] = constraints[i].error(params)
    }

    residual = 0
    for (let i = 0; i < nConstraints; i++) residual += C[i] * C[i]
    residual = Math.sqrt(residual / nConstraints)

    if (residual < tol) break

    const J = new Float64Array(nConstraints * nParams)
    for (let i = 0; i < nConstraints; i++) {
      const grad = constraints[i].gradient(params)
      for (const g of grad) {
        const px = g.pointIx * 2
        J[i * nParams + px] = g.dx
        J[i * nParams + px + 1] = g.dy
      }
    }

    for (let i = 0; i < nConstraints; i++) {
      let jjt = 0
      for (let j = 0; j < nParams; j++) jjt += J[i * nParams + j] * J[i * nParams + j]
      const lambda = jjt > 1e-10 ? C[i] / (jjt + 1e-10) : 0
      for (let j = 0; j < nParams; j++) {
        C[j] -= damping * lambda * J[i * nParams + j]
      }
    }

    for (let i = 0; i < nParams; i++) {
      const pi = Math.floor(i / 2)
      const comp = i % 2
      if (pi < params.points.length) {
        if (comp === 0) params.points[pi].x -= C[i] * damping
        else params.points[pi].y -= C[i] * damping
      }
    }

    iter++
  }

  return {
    params,
    iterations: iter,
    residual,
    converged: residual < tol,
  }
}

export function computeDOF(
  nPoints: number,
  constraintCount: number
): { dof: number; status: 'under' | 'full' | 'over' } {
  const dof = nPoints * 2 - constraintCount
  if (dof <= 0) return { dof: 0, status: dof < 0 ? 'over' : 'full' }
  return { dof, status: 'under' }
}
