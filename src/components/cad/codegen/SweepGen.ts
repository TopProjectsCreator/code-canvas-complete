import * as THREE from 'three'
import type { SketchEntity } from '../types'

export function generateSweepGeometry(
  profileEntities: SketchEntity[],
  pathEntities: SketchEntity[],
  _solid: boolean,
  twistAngle?: number
): THREE.BufferGeometry | null {
  const profilePoints = profileToPoints(profileEntities)
  if (profilePoints.length < 2) return null

  const pathPoints = profileToPoints(pathEntities)
  if (pathPoints.length < 2) return null

  const pathVec = pathPoints.map(p => new THREE.Vector3(p.x, 0, p.y))
  const profileVec = profilePoints.map(p => new THREE.Vector3(p.x, p.y, 0))

  if (pathVec.length < 2) return null

  const curve = new THREE.CatmullRomCurve3(pathVec)
  const sampleCount = Math.max(pathVec.length * 8, 32)
  const samples = curve.getPoints(sampleCount)

  const twistRad = ((twistAngle ?? 0) * Math.PI) / 180
  const frames = curve.computeFrenetFrames(sampleCount, false)

  const positions: number[] = []
  const indices: number[] = []
  const cols = profileVec.length
  const rows = samples.length

  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1)
    const pos = samples[j]
    const normal = frames.normals[j]
    const binormal = frames.binormals[j]

    const theta = t * twistRad

    for (let i = 0; i < cols; i++) {
      const p = profileVec[i]
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)
      const px = p.x * cosT - p.y * sinT
      const py = p.x * sinT + p.y * cosT

      const world = new THREE.Vector3()
        .copy(pos)
        .addScaledVector(normal, px)
        .addScaledVector(binormal, py)

      positions.push(world.x, world.y, world.z)
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
  const ents = Object.values(entities)

  for (const ent of ents) {
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
