import * as THREE from 'three'
import type { CadDocument } from '../types'
import type { WorkerResult } from './codegenWorker'

export interface ReconstructedGeometry {
  geometry: THREE.BufferGeometry
  featureId: string
}

let workerInstance: Worker | null = null
let pendingResolve: ((result: ReconstructedGeometry[]) => void) | null = null
let pendingId = 0

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('./codegenWorker.ts', import.meta.url),
      { type: 'module' },
    )

    workerInstance.onmessage = (e: MessageEvent<WorkerResult>) => {
      if (!pendingResolve) return
      const { featureGeometries } = e.data
      const results: ReconstructedGeometry[] = []

      for (const [featureId, buf] of Object.entries(featureGeometries)) {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(buf.position, 3))
        if (buf.normal.length) {
          geometry.setAttribute('normal', new THREE.BufferAttribute(buf.normal, 3))
        }
        if (buf.uv.length) {
          geometry.setAttribute('uv', new THREE.BufferAttribute(buf.uv, 2))
        }
        if (buf.index.length) {
          geometry.setIndex(new THREE.BufferAttribute(buf.index, 1))
        }

        results.push({ geometry, featureId })
        buf.position = null!
        buf.normal = null!
        buf.uv = null!
        buf.index = null!
      }

      pendingResolve(results)
      pendingResolve = null
    }
  }
  return workerInstance
}

export function createCodegenWorker() {
  function rebuild(doc: CadDocument): Promise<ReconstructedGeometry[]> {
    const worker = getWorker()
    return new Promise(resolve => {
      pendingResolve = resolve
      worker.postMessage({ doc })
    })
  }

  function terminate() {
    if (workerInstance) {
      workerInstance.terminate()
      workerInstance = null
    }
  }

  return { rebuild, terminate }
}
