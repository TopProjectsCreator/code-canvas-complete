import type { SketchEntity } from '../types'

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function pointToSegmentDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

function lineIntersection(
  a1: { x: number; y: number }, a2: { x: number; y: number },
  b1: { x: number; y: number }, b2: { x: number; y: number }
): { x: number; y: number; t: number } | null {
  const dax = a2.x - a1.x, day = a2.y - a1.y
  const dbx = b2.x - b1.x, dby = b2.y - b1.y
  const denom = dax * dby - day * dbx
  if (Math.abs(denom) < 1e-10) return null
  const t = (dbx * (a1.y - b1.y) - dby * (a1.x - b1.x)) / denom
  if (t < 0 || t > 1) return null
  return { x: a1.x + t * dax, y: a1.y + t * day, t }
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

interface HitEntity {
  entity: SketchEntity
  segmentIx: number
  t: number
  point: { x: number; y: number }
  dist: number
  endpointDist?: number
}

export function findBestHit(
  mousePos: { x: number; y: number },
  entities: SketchEntity[]
): HitEntity | null {
  const hits: HitEntity[] = []
  const threshold = 15

  for (const ent of Object.values(entities)) {
    const segs = getEntitySegments(ent)
    for (let si = 0; si < segs.length; si++) {
      const [a, b] = segs[si]
      const segDist = pointToSegmentDist(mousePos, a, b)
      if (segDist < threshold) {
        const dx = b.x - a.x, dy = b.y - a.y
        const lenSq = dx * dx + dy * dy
        let t = lenSq > 0 ? ((mousePos.x - a.x) * dx + (mousePos.y - a.y) * dy) / lenSq : 0
        t = Math.max(0, Math.min(1, t))
        hits.push({
          entity: ent,
          segmentIx: si,
          t,
          point: { x: a.x + t * dx, y: a.y + t * dy },
          dist: segDist,
        })
      }
    }
  }

  if (hits.length === 0) return null
  hits.sort((a, b) => a.dist - b.dist)
  return hits[0]
}

export function trimEntity(
  mousePos: { x: number; y: number },
  entities: SketchEntity[]
): { trimmedEntity: SketchEntity; updatedEntities: SketchEntity[] } | null {
  const hit = findBestHit(mousePos, entities)
  if (!hit) return null

  if (hit.entity.type !== 'line') return null

  const p = hit.entity.params as Record<string, number>
  const a = { x: p.x1 ?? 0, y: p.y1 ?? 0 }
  const b = { x: p.x2 ?? 0, y: p.y2 ?? 0 }

  const intersections: { point: { x: number; y: number }; t: number }[] = []

  for (const other of Object.values(entities)) {
    if (other.id === hit.entity.id) continue
    const segs = getEntitySegments(other)
    for (const [c, d] of segs) {
      const ix = lineIntersection(a, b, c, d)
      if (ix) intersections.push({ point: ix, t: ix.t })
    }
  }

  if (intersections.length === 0) return null

  intersections.sort((a, b) => a.t - b.t)

  const hitT = hit.t
  let splitBefore: { x: number; y: number } | null = null
  let splitAfter: { x: number; y: number } | null = null

  for (let i = 0; i < intersections.length; i++) {
    if (intersections[i].t < hitT) splitBefore = intersections[i].point
    if (intersections[i].t > hitT) {
      splitAfter = intersections[i].point
      break
    }
  }

  if (splitBefore && splitAfter) {
    const updated: SketchEntity = {
      ...hit.entity,
      params: {
        x1: splitBefore.x, y1: splitBefore.y,
        x2: splitAfter.x, y2: splitAfter.y,
      },
    }
    return { trimmedEntity: updated, updatedEntities: [hit.entity] }
  }

  if (splitBefore) {
    const updated: SketchEntity = {
      ...hit.entity,
      params: { x1: splitBefore.x, y1: splitBefore.y, x2: p.x2, y2: p.y2 },
    }
    return { trimmedEntity: updated, updatedEntities: [hit.entity] }
  }

  return null
}

export function extendEntity(
  mousePos: { x: number; y: number },
  entities: SketchEntity[]
): { extendedEntity: SketchEntity; updatedEntities: SketchEntity[] } | null {
  const hit = findBestHit(mousePos, entities)
  if (!hit) return null

  if (hit.entity.type !== 'line') return null

  const p = hit.entity.params as Record<string, number>
  const a = { x: p.x1 ?? 0, y: p.y1 ?? 0 }
  const b = { x: p.x2 ?? 0, y: p.y2 ?? 0 }

  const endpointDistA = dist(mousePos, a)
  const endpointDistB = dist(mousePos, b)
  const isNearA = endpointDistA < endpointDistB && endpointDistA < 20

  let targetEnd = isNearA ? a : b

  let bestIntersection: { x: number; y: number } | null = null
  let bestDist = Infinity

  for (const other of Object.values(entities)) {
    if (other.id === hit.entity.id) continue
    const segs = getEntitySegments(other)
    for (const [c, d] of segs) {
      const dx = b.x - a.x, dy = b.y - a.y
      const ex = d.x - c.x, ey = d.y - c.y
      const denom = dx * ey - dy * ex
      if (Math.abs(denom) < 1e-10) continue

      const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / denom
      if (t < 0) continue

      const ix = { x: a.x + t * dx, y: a.y + t * dy }
      const d2 = dist(ix, targetEnd)
      if (d2 < bestDist) {
        bestDist = d2
        bestIntersection = ix
      }
    }
  }

  if (!bestIntersection) return null

  const updated: SketchEntity = {
    ...hit.entity,
    params: isNearA
      ? { x1: bestIntersection.x, y1: bestIntersection.y, x2: p.x2, y2: p.y2 }
      : { x1: p.x1, y1: p.y1, x2: bestIntersection.x, y2: bestIntersection.y },
  }

  return { extendedEntity: updated, updatedEntities: [hit.entity] }
}
