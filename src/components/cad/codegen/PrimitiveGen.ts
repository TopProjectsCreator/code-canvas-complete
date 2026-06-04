import * as THREE from 'three'

export type PrimitiveType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane'

export interface PrimitiveParams {
  width?: number
  height?: number
  depth?: number
  radius?: number
  radiusTop?: number
  radiusBottom?: number
  segments?: number
  tube?: number
  radialSegments?: number
  tubularSegments?: number
}

export function generatePrimitive(
  type: PrimitiveType,
  params: PrimitiveParams = {}
): THREE.BufferGeometry {
  switch (type) {
    case 'box':
      return new THREE.BoxGeometry(
        params.width ?? 10,
        params.height ?? 10,
        params.depth ?? 10
      )
    case 'sphere':
      return new THREE.SphereGeometry(
        params.radius ?? 5,
        params.segments ?? 32,
        params.segments ?? 32
      )
    case 'cylinder':
      return new THREE.CylinderGeometry(
        params.radiusTop ?? 5,
        params.radiusBottom ?? 5,
        params.height ?? 10,
        params.segments ?? 32
      )
    case 'cone':
      return new THREE.CylinderGeometry(
        params.radiusTop ?? 0,
        params.radiusBottom ?? 5,
        params.height ?? 10,
        params.segments ?? 32
      )
    case 'torus':
      return new THREE.TorusGeometry(
        params.radius ?? 5,
        params.tube ?? 1.5,
        params.radialSegments ?? 16,
        params.tubularSegments ?? 32
      )
    case 'plane':
      return new THREE.PlaneGeometry(
        params.width ?? 10,
        params.height ?? 10
      )
  }
}
