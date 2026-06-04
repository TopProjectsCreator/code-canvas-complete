import { useMemo } from 'react'
import { useCADStore } from '../store'
import * as THREE from 'three'

interface SketchEntityParams {
  x1?: number; y1?: number; x2?: number; y2?: number
  cx?: number; cy?: number; radius?: number
  x?: number; y?: number; width?: number; height?: number
}

function entityToLineSegments(params: SketchEntityParams, type: string): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  if (type === 'line' && params.x1 !== undefined) {
    pts.push(new THREE.Vector3(params.x1, params.y1!, 0))
    pts.push(new THREE.Vector3(params.x2!, params.y2!, 0))
  } else if (type === 'rectangle') {
    const x = params.x ?? 0, y = params.y ?? 0
    const w = params.width ?? 10, h = params.height ?? 10
    pts.push(new THREE.Vector3(x, y, 0), new THREE.Vector3(x + w, y, 0))
    pts.push(new THREE.Vector3(x + w, y, 0), new THREE.Vector3(x + w, y + h, 0))
    pts.push(new THREE.Vector3(x + w, y + h, 0), new THREE.Vector3(x, y + h, 0))
    pts.push(new THREE.Vector3(x, y + h, 0), new THREE.Vector3(x, y, 0))
  } else if (type === 'circle') {
    const cx = params.cx ?? 0, cy = params.cy ?? 0, r = params.radius ?? 5
    const segments = 32
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(cx + r * Math.cos(theta), cy + r * Math.sin(theta), 0))
      if (i < segments) {
        const next = ((i + 1) / segments) * Math.PI * 2
        pts.push(new THREE.Vector3(cx + r * Math.cos(next), cy + r * Math.sin(next), 0))
      }
    }
  }
  return pts
}

export function SketchRenderer() {
  const activeSketch = useCADStore(s => s.activeSketch)
  const doc = useCADStore(s => s.doc)

  const sketch = activeSketch ? doc.sketches[activeSketch] : null

  const lines = useMemo(() => {
    if (!sketch) return []
    const allPts: THREE.Vector3[] = []
    for (const ent of Object.values(sketch.entities)) {
      const pts = entityToLineSegments(ent.params as SketchEntityParams, ent.type)
      allPts.push(...pts)
    }
    return allPts
  }, [sketch])

  if (!sketch || lines.length === 0) return null

  const geom = new THREE.BufferGeometry().setFromPoints(lines)
  const pos = geom.getAttribute('position')
  const count = pos.count
  const idx: number[] = []
  for (let i = 0; i < count; i++) idx.push(i)
  geom.setIndex(idx)

  return (
    <primitive object={new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: '#38bdf8', linewidth: 2 }))} />
  )
}
