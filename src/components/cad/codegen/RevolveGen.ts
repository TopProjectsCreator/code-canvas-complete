import * as THREE from 'three'
import type { SketchEntity } from '../types'

function entityToLathePoints(entities: SketchEntity[]): THREE.Vector2[] {
  const points: THREE.Vector2[] = []
  const ents = Object.values(entities)

  for (const ent of ents) {
    const p = ent.params as Record<string, number>

    switch (ent.type) {
      case 'line': {
        points.push(new THREE.Vector2(p.x1 ?? 0, p.y1 ?? 0))
        points.push(new THREE.Vector2(p.x2 ?? 0, p.y2 ?? 0))
        break
      }
      case 'rectangle': {
        const x = p.x ?? 0, y = p.y ?? 0, w = p.width ?? 10, h = p.height ?? 10
        points.push(new THREE.Vector2(x, y))
        points.push(new THREE.Vector2(x + w, y))
        points.push(new THREE.Vector2(x + w, y + h))
        points.push(new THREE.Vector2(x, y + h))
        break
      }
      case 'circle': {
        const cx = p.cx ?? 0, cy = p.cy ?? 0, r = p.radius ?? 5
        const segments = 24
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2
          points.push(new THREE.Vector2(cx + r * Math.cos(theta), cy + r * Math.sin(theta)))
        }
        break
      }
    }
  }

  if (points.length === 0) return points

  const sorted = [points[0]]
  const remaining = points.slice(1)
  while (remaining.length > 0) {
    const last = sorted[sorted.length - 1]
    let closestIx = 0
    let closestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = last.distanceTo(remaining[i])
      if (d < closestDist) { closestDist = d; closestIx = i }
    }
    sorted.push(remaining[closestIx])
    remaining.splice(closestIx, 1)
  }

  sorted.sort((a, b) => a.x - b.x)

  return sorted
}

export function generateRevolveGeometry(
  entities: SketchEntity[],
  angle: number,
  segments?: number
): THREE.BufferGeometry | null {
  const points = entityToLathePoints(entities)
  if (points.length < 2) return null

  const arcAngle = (angle / 360) * Math.PI * 2
  const geom = new THREE.LatheGeometry(points, segments ?? 48, 0, arcAngle)
  geom.computeVertexNormals()
  return geom
}
