import * as THREE from 'three'
import type { SketchEntity } from '../types'

export function generateThreadGeometry(
  entities: SketchEntity[],
  diameter: number,
  pitch: number,
  turns: number
): THREE.BufferGeometry | null {
  const pts = profileToPoints(entities)
  if (pts.length < 2) return null

  const r = (diameter ?? 10) / 2
  const p = pitch ?? 2
  const t = turns ?? 5
  const segments = t * 24

  const profile: THREE.Vector2[] = pts.map(v => v.clone())

  const positions: number[] = []
  const indices: number[] = []
  const cols = profile.length
  const rows = segments + 1

  for (let j = 0; j < rows; j++) {
    const frac = j / segments
    const theta = frac * t * Math.PI * 2
    const z = frac * t * p

    for (let i = 0; i < cols; i++) {
      const px = profile[i].x
      const py = profile[i].y
      const cr = r + px
      positions.push(
        cr * Math.cos(theta),
        cr * Math.sin(theta),
        z + py
      )
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

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  return geom
}

function profileToPoints(entities: SketchEntity[]): THREE.Vector2[] {
  const points: THREE.Vector2[] = []
  for (const ent of Object.values(entities)) {
    const p = ent.params as Record<string, number>
    switch (ent.type) {
      case 'line':
        points.push(new THREE.Vector2(p.x1 ?? 0, p.y1 ?? 0))
        points.push(new THREE.Vector2(p.x2 ?? 0, p.y2 ?? 0))
        break
      case 'circle': {
        const cx = p.cx ?? 0, cy = p.cy ?? 0, r = p.radius ?? 3
        for (let i = 0; i < 12; i++) {
          const theta = (i / 12) * Math.PI * 2
          points.push(new THREE.Vector2(cx + r * Math.cos(theta), cy + r * Math.sin(theta)))
        }
        break
      }
    }
  }
  return points
}
