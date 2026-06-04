import type { CadDocument } from '../types'
import { generateFeatureGeometry, extractBuffers } from '../codegen/codegen'
import type { GeometryBuffer } from '../codegen/codegen'

export type { GeometryBuffer }

export interface WorkerResult {
  featureGeometries: Record<string, GeometryBuffer>
}

self.onmessage = (e: MessageEvent<{ doc: CadDocument }>) => {
  const { doc } = e.data
  const featureGeometries: Record<string, GeometryBuffer> = {}

  for (const body of Object.values(doc.bodies)) {
    for (const feature of body.features) {
      if (feature.suppressed) continue
      const geom = generateFeatureGeometry(feature, doc)
      if (geom) {
        featureGeometries[feature.id] = extractBuffers(geom)
        geom.dispose()
      }
    }
  }

  const transferables: ArrayBuffer[] = []
  for (const g of Object.values(featureGeometries)) {
    transferables.push(g.position.buffer)
    if (g.normal.length) transferables.push(g.normal.buffer)
    if (g.uv.length) transferables.push(g.uv.buffer)
    if (g.index.length) transferables.push(g.index.buffer)
  }

  const result: WorkerResult = { featureGeometries }
  self.postMessage(result, transferables)
}
