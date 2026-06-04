import type { SketchEntity } from '../types'

export interface SnapPoint {
  x: number
  y: number
  type: 'endpoint' | 'midpoint' | 'intersection' | 'grid' | 'center'
  entityId?: string
}

const SNAP_THRESHOLD = 12

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function getEntityPoints(entity: SketchEntity): { x: number; y: number }[] {
  const p = entity.params as Record<string, number>
  switch (entity.type) {
    case 'line':
      return [{ x: p.x1 ?? 0, y: p.y1 ?? 0 }, { x: p.x2 ?? 0, y: p.y2 ?? 0 }]
    case 'rectangle': {
      const x = p.x ?? 0, y = p.y ?? 0, w = p.width ?? 10, h = p.height ?? 10
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ]
    }
    case 'circle':
      return [{ x: p.cx ?? 0, y: p.cy ?? 0 }]
    default:
      return []
  }
}

function lineIntersection(
  a1: { x: number; y: number }, a2: { x: number; y: number },
  b1: { x: number; y: number }, b2: { x: number; y: number }
): { x: number; y: number } | null {
  const dax = a2.x - a1.x, day = a2.y - a1.y
  const dbx = b2.x - b1.x, dby = b2.y - b1.y
  const denom = dax * dby - day * dbx
  if (Math.abs(denom) < 1e-10) return null

  const t = (dbx * (a1.y - b1.y) - dby * (a1.x - b1.x)) / denom
  if (t < 0 || t > 1) return null
  return { x: a1.x + t * dax, y: a1.y + t * day }
}

function getEntitySegments(entity: SketchEntity): [{ x: number; y: number }, { x: number; y: number }][] {
  const p = entity.params as Record<string, number>
  switch (entity.type) {
    case 'line':
      return [[{ x: p.x1 ?? 0, y: p.y1 ?? 0 }, { x: p.x2 ?? 0, y: p.y2 ?? 0 }]]
    case 'rectangle': {
      const x = p.x ?? 0, y = p.y ?? 0, w = p.width ?? 10, h = p.height ?? 10
      return [
        [{ x, y }, { x: x + w, y }],
        [{ x: x + w, y }, { x: x + w, y: y + h }],
        [{ x: x + w, y: y + h }, { x, y: y + h }],
        [{ x, y: y + h }, { x, y }],
      ]
    }
    default:
      return []
  }
}

export function findSnapPoint(
  mousePos: { x: number; y: number },
  entities: SketchEntity[],
  gridSize: number,
  snapToGrid: boolean,
  snapToVertex: boolean,
  snapToMidpoint: boolean,
  snapToIntersection: boolean,
  snapToCenter: boolean
): SnapPoint | null {
  const candidates: { point: SnapPoint; dist: number }[] = []
  const threshold = SNAP_THRESHOLD

  if (snapToGrid && gridSize > 0) {
    const gx = Math.round(mousePos.x / gridSize) * gridSize
    const gy = Math.round(mousePos.y / gridSize) * gridSize
    const d = dist(mousePos, { x: gx, y: gy })
    if (d < threshold) {
      candidates.push({ point: { x: gx, y: gy, type: 'grid' }, dist: d })
    }
  }

  const ents = Object.values(entities)

  for (const ent of ents) {
    const pts = getEntityPoints(ent)

    if (snapToVertex) {
      for (const pt of pts) {
        const d = dist(mousePos, pt)
        if (d < threshold) {
          candidates.push({ point: { ...pt, type: 'endpoint', entityId: ent.id }, dist: d })
        }
      }
    }

    if (snapToMidpoint && ent.type === 'line') {
      const p = ent.params as Record<string, number>
      const mx = ((p.x1 ?? 0) + (p.x2 ?? 0)) / 2
      const my = ((p.y1 ?? 0) + (p.y2 ?? 0)) / 2
      const d = dist(mousePos, { x: mx, y: my })
      if (d < threshold) {
        candidates.push({ point: { x: mx, y: my, type: 'midpoint', entityId: ent.id }, dist: d })
      }
    }

    if (snapToCenter && ent.type === 'circle') {
      const p = ent.params as Record<string, number>
      const d = dist(mousePos, { x: p.cx ?? 0, y: p.cy ?? 0 })
      if (d < threshold) {
        candidates.push({ point: { x: p.cx ?? 0, y: p.cy ?? 0, type: 'center', entityId: ent.id }, dist: d })
      }
    }
  }

  if (snapToIntersections && ents.length >= 2) {
    for (let i = 0; i < ents.length; i++) {
      const segsA = getEntitySegments(ents[i])
      for (let j = i + 1; j < ents.length; j++) {
        const segsB = getEntitySegments(ents[j])
        for (const sA of segsA) {
          for (const sB of segsB) {
            const pt = lineIntersection(sA[0], sA[1], sB[0], sB[1])
            if (pt) {
              const d = dist(mousePos, pt)
              if (d < threshold) {
                candidates.push({ point: { ...pt, type: 'intersection' }, dist: d })
              }
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.dist - b.dist)
  return candidates[0].point
}

export function drawSnapIndicator(
  ctx: CanvasRenderingContext2D,
  snap: SnapPoint,
  canvasW: number,
  canvasH: number
) {
  const x = snap.x + canvasW / 2
  const y = -(snap.y - canvasH / 2)

  ctx.save()

  ctx.fillStyle = '#22d3ee'
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.arc(x, y, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, 8, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}
