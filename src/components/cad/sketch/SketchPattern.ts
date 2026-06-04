import type { SketchEntity } from '../types'

function createId(): string {
  return `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export function linearPattern(
  entity: SketchEntity,
  dx: number,
  dy: number,
  count: number
): SketchEntity[] {
  const results: SketchEntity[] = []
  const p = entity.params as Record<string, number>

  for (let i = 1; i < count; i++) {
    const offsetX = dx * i
    const offsetY = dy * i

    switch (entity.type) {
      case 'line':
        results.push({
          id: createId(), type: 'line',
          params: {
            x1: (p.x1 ?? 0) + offsetX, y1: (p.y1 ?? 0) + offsetY,
            x2: (p.x2 ?? 0) + offsetX, y2: (p.y2 ?? 0) + offsetY,
          },
          construction: false, locked: false, layer: 'default',
        })
        break
      case 'circle':
        results.push({
          id: createId(), type: 'circle',
          params: {
            cx: (p.cx ?? 0) + offsetX, cy: (p.cy ?? 0) + offsetY,
            radius: p.radius ?? 5,
          },
          construction: false, locked: false, layer: 'default',
        })
        break
      case 'rectangle':
        results.push({
          id: createId(), type: 'rectangle',
          params: {
            x: (p.x ?? 0) + offsetX, y: (p.y ?? 0) + offsetY,
            width: p.width ?? 10, height: p.height ?? 10,
          },
          construction: false, locked: false, layer: 'default',
        })
        break
    }
  }

  return results
}

export function circularPattern(
  entity: SketchEntity,
  centerX: number,
  centerY: number,
  count: number,
  totalAngle: number
): SketchEntity[] {
  const results: SketchEntity[] = []
  const p = entity.params as Record<string, number>
  const angleStep = (totalAngle / count) * (Math.PI / 180)

  function rotatePoint(x: number, y: number, angle: number): { x: number; y: number } {
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const rx = x - centerX
    const ry = y - centerY
    return {
      x: rx * cosA - ry * sinA + centerX,
      y: rx * sinA + ry * cosA + centerY,
    }
  }

  for (let i = 1; i < count; i++) {
    const angle = angleStep * i

    switch (entity.type) {
      case 'line': {
        const a = rotatePoint(p.x1 ?? 0, p.y1 ?? 0, angle)
        const b = rotatePoint(p.x2 ?? 0, p.y2 ?? 0, angle)
        results.push({
          id: createId(), type: 'line',
          params: { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
          construction: false, locked: false, layer: 'default',
        })
        break
      }
      case 'circle': {
        const center = rotatePoint(p.cx ?? 0, p.cy ?? 0, angle)
        results.push({
          id: createId(), type: 'circle',
          params: { cx: center.x, cy: center.y, radius: p.radius ?? 5 },
          construction: false, locked: false, layer: 'default',
        })
        break
      }
      case 'rectangle': {
        const corners = [
          rotatePoint(p.x ?? 0, p.y ?? 0, angle),
          rotatePoint((p.x ?? 0) + (p.width ?? 10), p.y ?? 0, angle),
          rotatePoint((p.x ?? 0) + (p.width ?? 10), (p.y ?? 0) + (p.height ?? 10), angle),
          rotatePoint(p.x ?? 0, (p.y ?? 0) + (p.height ?? 10), angle),
        ]
        const minX = Math.min(...corners.map(c => c.x))
        const minY = Math.min(...corners.map(c => c.y))
        const maxX = Math.max(...corners.map(c => c.x))
        const maxY = Math.max(...corners.map(c => c.y))
        results.push({
          id: createId(), type: 'rectangle',
          params: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          construction: false, locked: false, layer: 'default',
        })
        break
      }
    }
  }

  return results
}
