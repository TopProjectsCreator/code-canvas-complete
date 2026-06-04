import type { SketchEntity } from '../types'

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function pointToSegmentDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

function findNearestEntity(
  mousePos: { x: number; y: number },
  entities: SketchEntity[]
): SketchEntity | null {
  let best: SketchEntity | null = null
  let bestDist = 20

  for (const ent of Object.values(entities)) {
    const p = ent.params as Record<string, number>
    let d = Infinity

    switch (ent.type) {
      case 'line':
        d = pointToSegmentDist(mousePos, { x: p.x1 ?? 0, y: p.y1 ?? 0 }, { x: p.x2 ?? 0, y: p.y2 ?? 0 })
        break
      case 'circle':
        d = Math.abs(dist(mousePos, { x: p.cx ?? 0, y: p.cy ?? 0 }) - (p.radius ?? 5))
        break
    }

    if (d < bestDist) {
      bestDist = d
      best = ent
    }
  }

  return best
}

function offsetPoint(
  point: { x: number; y: number },
  segStart: { x: number; y: number },
  segEnd: { x: number; y: number },
  offset: number
): { x: number; y: number } {
  const dx = segEnd.x - segStart.x
  const dy = segEnd.y - segStart.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return point

  const nx = -dy / len
  const ny = dx / len

  return {
    x: point.x + nx * offset,
    y: point.y + ny * offset,
  }
}

export function offsetEntity(
  mousePos: { x: number; y: number },
  entities: SketchEntity[],
  offsetDist: number
): { originalId: string; offsetEntity: SketchEntity } | null {
  const target = findNearestEntity(mousePos, entities)
  if (!target) return null

  const p = target.params as Record<string, number>

  switch (target.type) {
    case 'line': {
      const a = { x: p.x1 ?? 0, y: p.y1 ?? 0 }
      const b = { x: p.x2 ?? 0, y: p.y2 ?? 0 }
      const offA = offsetPoint(a, a, b, offsetDist)
      const offB = offsetPoint(b, a, b, offsetDist)

      const offsetEntity: SketchEntity = {
        id: `offset_${Date.now()}`,
        type: 'line',
        params: { x1: offA.x, y1: offA.y, x2: offB.x, y2: offB.y },
        construction: false,
        locked: false,
        layer: 'default',
      }

      return { originalId: target.id, offsetEntity }
    }

    case 'circle': {
      const cx = p.cx ?? 0
      const cy = p.cy ?? 0
      const r = p.radius ?? 5
      const newR = Math.max(0.1, r + offsetDist)

      const offsetEntity: SketchEntity = {
        id: `offset_${Date.now()}`,
        type: 'circle',
        params: { cx, cy, radius: newR },
        construction: false,
        locked: false,
        layer: 'default',
      }

      return { originalId: target.id, offsetEntity }
    }

    default:
      return null
  }
}

export function getOffsetDist(
  mousePos: { x: number; y: number },
  entities: SketchEntity[]
): number | null {
  const target = findNearestEntity(mousePos, entities)
  if (!target) return null

  const p = target.params as Record<string, number>

  switch (target.type) {
    case 'line': {
      const a = { x: p.x1 ?? 0, y: p.y1 ?? 0 }
      const b = { x: p.x2 ?? 0, y: p.y2 ?? 0 }
      const dx = b.x - a.x, dy = b.y - a.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len === 0) return 5
      const nx = -dy / len, ny = dx / len
      const proj = (mousePos.x - a.x) * nx + (mousePos.y - a.y) * ny
      return Math.round(proj * 10) / 10
    }
    case 'circle': {
      const d = dist(mousePos, { x: p.cx ?? 0, y: p.cy ?? 0 })
      return Math.round((d - (p.radius ?? 5)) * 10) / 10
    }
    default:
      return 5
  }
}
