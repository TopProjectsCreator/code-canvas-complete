import * as THREE from 'three'
import type { SketchEntity } from '../types'

function entityToShape(entities: SketchEntity[]): THREE.Shape | null {
  const ents = Object.values(entities)
  if (ents.length === 0) return null

  const shape = new THREE.Shape()
  let started = false

  for (const ent of ents) {
    const p = ent.params as Record<string, number>

    switch (ent.type) {
      case 'line': {
        const x1 = p.x1 ?? 0, y1 = p.y1 ?? 0, x2 = p.x2 ?? 0, y2 = p.y2 ?? 0
        if (!started) { shape.moveTo(x1, y1); started = true }
        shape.lineTo(x2, y2)
        break
      }
      case 'rectangle': {
        const x = p.x ?? 0, y = p.y ?? 0, w = p.width ?? 10, h = p.height ?? 10
        if (!started) { shape.moveTo(x, y); started = true }
        shape.lineTo(x + w, y)
        shape.lineTo(x + w, y + h)
        shape.lineTo(x, y + h)
        shape.closePath()
        break
      }
      case 'circle': {
        const cx = p.cx ?? 0, cy = p.cy ?? 0, r = p.radius ?? 5
        const segments = 32
        if (!started) {
          shape.moveTo(cx + r, cy)
          started = true
        }
        for (let i = 1; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2
          shape.lineTo(cx + r * Math.cos(theta), cy + r * Math.sin(theta))
        }
        shape.closePath()
        break
      }
    }
  }

  return shape
}

export function generateExtrudeGeometry(
  entities: SketchEntity[],
  depth: number
): THREE.BufferGeometry | null {
  const shape = entityToShape(entities)
  if (!shape) return null

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: depth ?? 10,
    bevelEnabled: false,
  })
  geom.computeVertexNormals()
  return geom
}
