import * as THREE from 'three'

export function generateCoilGeometry(
  radius: number,
  pitch: number,
  revolutions: number,
  profileRadius: number,
  height?: number,
  taperAngle?: number
): THREE.BufferGeometry | null {
  const R = radius ?? 5
  const P = pitch ?? 3
  const revs = revolutions ?? 5
  const pr = profileRadius ?? 1
  const h = height ?? revs * P
  const taper = ((taperAngle ?? 0) * Math.PI) / 180

  const segments = Math.max(Math.round(revs * 32), 32)
  const profileSegs = 12

  const positions: number[] = []
  const indices: number[] = []
  const cols = profileSegs + 1
  const rows = segments + 1

  for (let j = 0; j < rows; j++) {
    const frac = j / segments
    const theta = frac * revs * Math.PI * 2
    const z = frac * h
    const taperFactor = 1 - frac * Math.tan(taper)
    const cr = R * taperFactor

    for (let i = 0; i <= profileSegs; i++) {
      const phi = (i / profileSegs) * Math.PI * 2
      const px = pr * Math.cos(phi)
      const py = pr * Math.sin(phi)
      positions.push(
        (cr + px) * Math.cos(theta) - py * Math.sin(theta),
        (cr + px) * Math.sin(theta) + py * Math.cos(theta),
        z
      )
    }
  }

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < profileSegs; i++) {
      const a = j * cols + i
      const b = j * cols + i + 1
      const c = (j + 1) * cols + i
      const d = (j + 1) * cols + i + 1
      indices.push(a, c, b)
      indices.push(b, c, d)
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  return geom
}
