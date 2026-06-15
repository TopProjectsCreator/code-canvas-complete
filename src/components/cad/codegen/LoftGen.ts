import * as THREE from 'three'
import type { SketchEntity } from '../types'

export function generateLoftGeometry(
  sections: { entities: SketchEntity[]; zOffset: number }[],
  closed: boolean
): THREE.BufferGeometry | null {
  if (sections.length < 2) return null

  const pointSections = sections
    .map(s => ({
      points: entitiesToPoints(s.entities),
      z: s.zOffset,
    }))
    .filter(s => s.points.length >= 3)

  if (pointSections.length < 2) return null

  const maxLen = Math.max(...pointSections.map(s => s.points.length))
  const aligned = pointSections.map(s => ({
    points: alignPointCount(s.points, maxLen),
    z: s.z,
  }))

  const positions: number[] = []
  const indices: number[] = []
  const cols = maxLen
  const rows = aligned.length

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p = aligned[j].points[i]
      positions.push(p.x, aligned[j].z, p.y)
    }
  }

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * cols + i
      const b = j * cols + (i + 1) % cols
      const c = (j + 1) * cols + i
      const d = (j + 1) * cols + (i + 1) % cols

      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }

  if (closed && rows > 2) {
    const lastRow = (rows - 1) * cols
    for (let i = 0; i < cols; i++) {
      const a = lastRow + i
      const b = lastRow + (i + 1) % cols
      const c = i
      const d = (i + 1) % cols
      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  return geom
}

function entitiesToPoints(entities: SketchEntity[]): THREE.Vector2[] {
  const points: THREE.Vector2[] = []
  for (const ent of entities) {
    const p = ent.params as Record<string, number>
    switch (ent.type) {
      case 'line':
        points.push(new THREE.Vector2(p.x1 ?? 0, p.y1 ?? 0))
        points.push(new THREE.Vector2(p.x2 ?? 0, p.y2 ?? 0))
        break
      case 'circle': {
        const cx = p.cx ?? 0, cy = p.cy ?? 0, r = p.radius ?? 5
        for (let i = 0; i < 24; i++) {
          const theta = (i / 24) * Math.PI * 2
          points.push(new THREE.Vector2(cx + r * Math.cos(theta), cy + r * Math.sin(theta)))
        }
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
    }
  }
  return points
}

function alignPointCount(points: THREE.Vector2[], count: number): THREE.Vector2[] {
  if (points.length === count) return points
  if (points.length === 0) return Array(count).fill(new THREE.Vector2(0, 0))

  const result: THREE.Vector2[] = []
  for (let i = 0; i < count; i++) {
    const t = (i / count) * points.length
    const ix = Math.floor(t)
    const frac = t - ix
    const a = points[ix % points.length]
    const b = points[(ix + 1) % points.length]
    result.push(new THREE.Vector2(
      a.x + (b.x - a.x) * frac,
      a.y + (b.y - a.y) * frac
    ))
  }
  return result
}
