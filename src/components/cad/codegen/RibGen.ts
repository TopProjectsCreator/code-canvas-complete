import * as THREE from 'three'
import type { SketchEntity } from '../types'

export function generateRibGeometry(
  entities: SketchEntity[],
  thickness: number,
  depth?: number
): THREE.BufferGeometry | null {
  const pts = profileToPoints(entities)
  if (pts.length < 2) return null

  const d = depth ?? 10
  const t = (thickness ?? 2) / 2
  const segments = Math.max(pts.length * 2, 16)

  const positions: number[] = []
  const indices: number[] = []

  const curve = new THREE.CatmullRomCurve3(
    pts.map(p => new THREE.Vector3(p.x, p.y, 0))
  )
  const samples = curve.getPoints(segments)

  const cols = 4
  const rows = samples.length

  for (let j = 0; j < rows; j++) {
    const p = samples[j]
    const next = samples[Math.min(j + 1, rows - 1)]
    const dx = next.x - p.x
    const dy = next.y - p.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = -dy / len
    const ny = dx / len

    positions.push(
      p.x + nx * t, p.y + ny * t, 0,
      p.x - nx * t, p.y - ny * t, 0,
      p.x + nx * t, p.y + ny * t, d,
      p.x - nx * t, p.y - ny * t, d
    )
  }

  for (let j = 0; j < rows - 1; j++) {
    const a = j * cols
    const b = j * cols + 1
    const c = j * cols + 2
    const d2 = j * cols + 3
    const a2 = (j + 1) * cols
    const b2 = (j + 1) * cols + 1
    const c2 = (j + 1) * cols + 2
    const d22 = (j + 1) * cols + 3

    indices.push(a, c, a2, c, c2, a2)
    indices.push(b, a, b2, a, a2, b2)
    indices.push(c, d2, c2, d2, d22, c2)
    indices.push(d2, b, d22, b, b2, d22)
  }

  positions.push(
    pts[0].x, pts[0].y, 0,
    pts[0].x, pts[0].y, d
  )
  const lastIx = (positions.length / 3) - 2
  const firstRow = 0
  const firstRow2 = 2
  const lastRow = (rows - 1) * cols
  const lastRow2 = (rows - 1) * cols + 2
  indices.push(firstRow, firstRow2, lastIx)
  indices.push(firstRow2, lastIx + 1, lastIx)
  indices.push(lastRow, lastIx, lastRow2)
  indices.push(lastRow2, lastIx, lastIx + 1)

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
        const cx = p.cx ?? 0, cy = p.cy ?? 0, r = p.radius ?? 5
        for (let i = 0; i < 16; i++) {
          const theta = (i / 16) * Math.PI * 2
          points.push(new THREE.Vector2(cx + r * Math.cos(theta), cy + r * Math.sin(theta)))
        }
        break
      }
    }
  }
  return points
}
