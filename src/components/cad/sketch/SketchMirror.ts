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

function reflectPoint(
  p: { x: number; y: number },
  lineA: { x: number; y: number },
  lineB: { x: number; y: number }
): { x: number; y: number } {
  const dx = lineB.x - lineA.x
  const dy = lineB.y - lineA.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return p

  const t = ((p.x - lineA.x) * dx + (p.y - lineA.y) * dy) / lenSq
  const projX = lineA.x + t * dx
  const projY = lineA.y + t * dy

  return {
    x: 2 * projX - p.x,
    y: 2 * projY - p.y,
  }
}

export function mirrorEntity(
  entity: SketchEntity,
  mirrorLine: { x1: number; y1: number; x2: number; y2: number }
): SketchEntity | null {
  const lineA = { x: mirrorLine.x1, y: mirrorLine.y1 }
  const lineB = { x: mirrorLine.x2, y: mirrorLine.y2 }
  const p = entity.params as Record<string, number>

  switch (entity.type) {
    case 'line': {
      const a = reflectPoint({ x: p.x1 ?? 0, y: p.y1 ?? 0 }, lineA, lineB)
      const b = reflectPoint({ x: p.x2 ?? 0, y: p.y2 ?? 0 }, lineA, lineB)
      return {
        id: `mirror_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'line',
        params: { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
        construction: false, locked: false, layer: 'default',
      }
    }
    case 'circle': {
      const center = reflectPoint({ x: p.cx ?? 0, y: p.cy ?? 0 }, lineA, lineB)
      return {
        id: `mirror_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'circle',
        params: { cx: center.x, cy: center.y, radius: p.radius ?? 5 },
        construction: false, locked: false, layer: 'default',
      }
    }
    case 'rectangle': {
      const corners = [
        { x: p.x ?? 0, y: p.y ?? 0 },
        { x: (p.x ?? 0) + (p.width ?? 10), y: p.y ?? 0 },
        { x: (p.x ?? 0) + (p.width ?? 10), y: (p.y ?? 0) + (p.height ?? 10) },
        { x: p.x ?? 0, y: (p.y ?? 0) + (p.height ?? 10) },
      ]
      const reflected = corners.map(c => reflectPoint(c, lineA, lineB))
      const minX = Math.min(...reflected.map(c => c.x))
      const minY = Math.min(...reflected.map(c => c.y))
      const maxX = Math.max(...reflected.map(c => c.x))
      const maxY = Math.max(...reflected.map(c => c.y))
      return {
        id: `mirror_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'rectangle',
        params: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        construction: false, locked: false, layer: 'default',
      }
    }
    default:
      return null
  }
}

export function findMirrorLine(
  mousePos: { x: number; y: number },
  entities: SketchEntity[]
): { x1: number; y1: number; x2: number; y2: number } | null {
  let best: { x1: number; y1: number; x2: number; y2: number } | null = null
  let bestDist = 20

  for (const ent of Object.values(entities)) {
    if (ent.type !== 'line') continue
    const p = ent.params as Record<string, number>
    const a = { x: p.x1 ?? 0, y: p.y1 ?? 0 }
    const b = { x: p.x2 ?? 0, y: p.y2 ?? 0 }
    const d = pointToSegmentDist(mousePos, a, b)
    if (d < bestDist) {
      bestDist = d
      best = { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    }
  }

  return best
}

export function mirrorSelected(
  selectedEntityIds: string[],
  entities: SketchEntity[],
  mirrorLine: { x1: number; y1: number; x2: number; y2: number }
): SketchEntity[] {
  const results: SketchEntity[] = []
  for (const id of selectedEntityIds) {
    const ent = entities.find(e => e.id === id)
    if (ent) {
      const mirrored = mirrorEntity(ent, mirrorLine)
      if (mirrored) results.push(mirrored)
    }
  }
  return results
}
