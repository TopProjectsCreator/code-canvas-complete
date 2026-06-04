import * as THREE from 'three'

export function generateHoleGeometry(
  diameter: number,
  depth: number,
  holeType: string,
  cboreDiameter?: number,
  cboreDepth?: number,
  csinkDiameter?: number,
  csinkAngle?: number
): THREE.BufferGeometry | null {
  const r = (diameter ?? 5) / 2
  const d = depth ?? 10
  const segments = 32

  const positions: number[] = []
  const indices: number[] = []

  function addCylinder(zBase: number, radius: number, height: number) {
    const base = positions.length / 3
    const nSeg = Math.max(segments, 16)

    for (let j = 0; j <= 1; j++) {
      const z = zBase + j * height
      for (let i = 0; i <= nSeg; i++) {
        const theta = (i / nSeg) * Math.PI * 2
        positions.push(
          radius * Math.cos(theta),
          radius * Math.sin(theta),
          z
        )
      }
    }

    const cols = nSeg + 1
    for (let j = 0; j < 1; j++) {
      for (let i = 0; i < nSeg; i++) {
        const a = base + j * cols + i
        const b = base + j * cols + i + 1
        const c = base + (j + 1) * cols + i
        const d = base + (j + 1) * cols + i + 1
        indices.push(a, c, b)
        indices.push(b, c, d)
      }
    }
  }

  function addCap(z: number, radius: number, reverse: boolean) {
    const base = positions.length / 3
    const center = base
    positions.push(0, 0, z)

    const nSeg = Math.max(segments, 16)
    for (let i = 0; i <= nSeg; i++) {
      const theta = (i / nSeg) * Math.PI * 2
      positions.push(
        radius * Math.cos(theta),
        radius * Math.sin(theta),
        z
      )
    }

    if (reverse) {
      for (let i = 0; i < nSeg; i++) {
        indices.push(center, base + i + 1, base + i + 2)
      }
    } else {
      for (let i = 0; i < nSeg; i++) {
        indices.push(center, base + i + 2, base + i + 1)
      }
    }
  }

  let z = 0

  if (holeType === 'counterbore' && cboreDiameter && cboreDepth) {
    addCylinder(z, cboreDiameter / 2, cboreDepth)
    z += cboreDepth
  }

  if (holeType === 'countersink' && csinkDiameter && csinkAngle) {
    const halfAngle = ((csinkAngle ?? 90) / 2) * (Math.PI / 180)
    const csinkHeight = ((csinkDiameter! - diameter) / 2) / Math.tan(halfAngle)
    const base = positions.length / 3
    const nSeg = Math.max(segments, 16)
    for (let j = 0; j <= 1; j++) {
      const jz = z + j * csinkHeight
      const jr = r + (csinkDiameter! / 2 - r) * j
      for (let i = 0; i <= nSeg; i++) {
        const theta = (i / nSeg) * Math.PI * 2
        positions.push(jr * Math.cos(theta), jr * Math.sin(theta), jz)
      }
    }
    const cols = nSeg + 1
    for (let i = 0; i < nSeg; i++) {
      indices.push(base + i, base + cols + i, base + i + 1)
      indices.push(base + i + 1, base + cols + i, base + cols + i + 1)
    }
    z += csinkHeight
  }

  const remainingDepth = d - z
  if (remainingDepth > 0) {
    addCylinder(z, r, remainingDepth)
    z += remainingDepth
  }

  addCap(0, Math.max(r, cboreDiameter ? cboreDiameter / 2 : r), false)
  addCap(z, r, true)

  if (positions.length < 12) return null

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  return geom
}
