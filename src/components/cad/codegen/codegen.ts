import type { CadDocument, Feature, PrimitiveFeature, ExtrudeFeature, RevolveFeature, SweepFeature, LoftFeature, CoilFeature, RibFeature, FilletFeature, ChamferFeature, ShellFeature, DraftFeature, HoleFeature, BooleanFeature, SketchEntity, Sketch } from '../types'
import * as THREE from 'three'
import { generatePrimitive } from './PrimitiveGen'
import { generateExtrudeGeometry } from './ExtrudeGen'
import { generateRevolveGeometry } from './RevolveGen'
import { generateSweepGeometry } from './SweepGen'
import { generateLoftGeometry } from './LoftGen'
import { generateHoleGeometry } from './HoleGen'
import { generateThreadGeometry } from './ThreadGen'
import { generateCoilGeometry } from './CoilGen'
import { generateRibGeometry } from './RibGen'

export interface GeometryBuffer {
  position: Float32Array
  normal: Float32Array
  uv: Float32Array
  index: Uint32Array
}

export function getFeatureSketchEntities(
  feature: Feature,
  doc: CadDocument
): SketchEntity[] {
  const sketchId = (feature as any).sketchId
  if (!sketchId) return []
  const sketch = doc.sketches[sketchId]
  return sketch ? Object.values(sketch.entities) : []
}

export function generateFeatureGeometry(feature: Feature, doc?: CadDocument): THREE.BufferGeometry | null {
  switch (feature.type) {
    case 'primitive': {
      const prim = feature as PrimitiveFeature
      return generatePrimitive(prim.primitiveType, prim.params)
    }
    case 'extrude': {
      const p = feature as ExtrudeFeature
      const depth = p.depth ?? 10
      if (doc) {
        const entities = getFeatureSketchEntities(feature, doc)
        const sketchGeom = generateExtrudeGeometry(entities, depth)
        if (sketchGeom) return sketchGeom
      }
      const shape = new THREE.Shape()
      const s = 5
      shape.moveTo(-s, -s)
      shape.lineTo(s, -s)
      shape.lineTo(s, s)
      shape.lineTo(-s, s)
      shape.closePath()
      const extrudeSettings = { depth, bevelEnabled: false }
      const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings)
      geom.computeVertexNormals()
      return geom
    }
    case 'revolve': {
      const p = feature as RevolveFeature
      const angle = p.angle ?? 360
      if (doc) {
        const entities = getFeatureSketchEntities(feature, doc)
        const sketchGeom = generateRevolveGeometry(entities, angle)
        if (sketchGeom) return sketchGeom
      }
      const segments = 48
      const arcAngle = (angle / 360) * Math.PI * 2
      const points = [
        new THREE.Vector2(0, -5),
        new THREE.Vector2(5, -5),
        new THREE.Vector2(5, 5),
        new THREE.Vector2(0, 5),
      ]
      return new THREE.LatheGeometry(points, segments, 0, arcAngle)
    }
    case 'fillet': {
      const box = new THREE.BoxGeometry(4, 4, 4)
      const edges = new THREE.EdgesGeometry(box)
      return edges
    }
    case 'chamfer': {
      const box = new THREE.BoxGeometry(4, 4, 4)
      const attr = box.getAttribute('position')
      const pos = attr.array as Float32Array
      for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i], y = pos[i+1], z = pos[i+2]
        const mx = Math.abs(x), my = Math.abs(y), mz = Math.abs(z)
        if (mx > 2.5 && my > 2.5 && mz > 2.5) {
          pos[i] *= 0.6
          pos[i+1] *= 0.6
          pos[i+2] *= 0.6
        }
      }
      box.computeVertexNormals()
      return box
    }
    case 'shell': {
      const outer = new THREE.BoxGeometry(5, 5, 5)
      const inner = new THREE.BoxGeometry(3, 3, 3)
      const outerPos = outer.getAttribute('position')
      const innerPos = inner.getAttribute('position')
      const merged = new Float32Array(outerPos.array.length + innerPos.array.length)
      merged.set(outerPos.array as Float32Array)
      merged.set(innerPos.array as Float32Array, outerPos.array.length)
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(merged, 3))

      const outerIdx = outer.getIndex()!
      const innerIdx = inner.getIndex()!
      const mergedIdx = new Uint32Array(outerIdx.array.length + innerIdx.array.length)
      mergedIdx.set(outerIdx.array as Uint32Array)
      mergedIdx.set(new Uint32Array((innerIdx.array as Uint32Array).map(i => i + outerPos.count)), outerIdx.array.length)
      geom.setIndex(new THREE.BufferAttribute(mergedIdx, 1))
      geom.computeVertexNormals()
      return geom
    }
    case 'draft': {
      const taper = new THREE.BoxGeometry(4, 4, 4)
      const pos = taper.getAttribute('position')
      const arr = pos.array as Float32Array
      for (let i = 0; i < arr.length; i += 3) {
        const y = arr[i+1]
        const t = (y + 2) / 4
        arr[i] *= 0.5 + 0.5 * (1 - t)
        arr[i+2] *= 0.5 + 0.5 * (1 - t)
      }
      taper.computeVertexNormals()
      return taper
    }
    case 'sweep': {
      if (!doc) return null
      const p = feature as SweepFeature
      const profileEntities = doc.sketches[p.profileSketchId]?.entities ?? {}
      const pathEntities = doc.sketches[p.pathSketchId]?.entities ?? {}
      return generateSweepGeometry(
        Object.values(profileEntities),
        Object.values(pathEntities),
        p.solid,
        p.twistAngle
      )
    }
    case 'loft': {
      if (!doc) return null
      const p = feature as LoftFeature
      const sections = p.sectionIds.map((id, i) => {
        const sketch = doc.sketches[id]
        return {
          entities: sketch ? Object.values(sketch.entities) : [],
          zOffset: i * 10,
        }
      }).filter(s => s.entities.length > 0)
      return generateLoftGeometry(sections, p.closed)
    }
    case 'hole': {
      const p = feature as HoleFeature
      return generateHoleGeometry(
        p.diameter, p.depth, p.holeType,
        p.cboreDiameter, p.cboreDepth,
        p.csinkDiameter, p.csinkAngle
      )
    }
    case 'thread': {
      if (!doc) return getFallbackBox()
      return generateThreadGeometry(
        getFeatureSketchEntities(feature, doc),
        10, 2, 5
      )
    }
    case 'coil': {
      const p = feature as CoilFeature
      return generateCoilGeometry(
        5, p.pitch, p.revolutions, 1,
        p.height, p.taperAngle
      )
    }
    case 'rib': {
      if (!doc) return getFallbackBox()
      const p = feature as RibFeature
      return generateRibGeometry(
        getFeatureSketchEntities(feature, doc),
        p.thickness, p.depth
      )
    }
    case 'mirror': {
      const half = new THREE.BoxGeometry(3, 3, 3)
      const pos = half.getAttribute('position')
      const arr = pos.array as Float32Array
      for (let i = 0; i < arr.length; i += 3) {
        if (arr[i] > 0) arr[i] = -arr[i]
      }
      half.computeVertexNormals()
      return half
    }
    case 'pattern': {
      const group = new THREE.BufferGeometry()
      const totalPos: number[] = []
      const totalIdx: number[] = []
      let offset = 0
      for (let gx = -4; gx <= 4; gx += 4) {
        for (let gz = -4; gz <= 4; gz += 4) {
          const cube = new THREE.BoxGeometry(1.5, 1.5, 1.5)
          const p = cube.getAttribute('position').array as Float32Array
          const idx = cube.getIndex()!.array as Uint32Array
          for (let i = 0; i < p.length; i += 3) {
            totalPos.push(p[i] + gx, p[i+1], p[i+2] + gz)
          }
          for (let i = 0; i < idx.length; i++) {
            totalIdx.push(idx[i] + offset)
          }
          offset += p.length / 3
        }
      }
      group.setAttribute('position', new THREE.Float32BufferAttribute(totalPos, 3))
      group.setIndex(totalIdx)
      group.computeVertexNormals()
      return group
    }
    default:
      return null
  }
}

export function extractBuffers(geometry: THREE.BufferGeometry): GeometryBuffer {
  const pos = geometry.getAttribute('position')
  const norm = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const idx = geometry.getIndex()

  return {
    position: new Float32Array(pos.array as Float32Array),
    normal: new Float32Array(norm?.array as Float32Array ?? []),
    uv: new Float32Array(uv?.array as Float32Array ?? []),
    index: idx ? new Uint32Array(idx.array as Uint32Array) : new Uint32Array(0),
  }
}

export function computeDirtyFeatures(
  doc: CadDocument,
  changedFeatureIds: string[]
): Feature[] {
  const dirty: Feature[] = []
  const visited = new Set<string>()

  function visit(featureId: string) {
    if (visited.has(featureId)) return
    visited.add(featureId)

    for (const body of Object.values(doc.bodies)) {
      const feature = body.features.find(f => f.id === featureId)
      if (!feature) continue
      dirty.push(feature)
      for (const dep of feature.dependencies) {
        visit(dep)
      }
    }
  }

  for (const id of changedFeatureIds) visit(id)
  return dirty
}

function getFallbackBox(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(2, 2, 2)
}
