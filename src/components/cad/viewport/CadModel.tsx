import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useCADStore } from '../store'
import { createCodegenWorker, type ReconstructedGeometry } from '../workers'
import { SketchRenderer } from '../sketch/SketchRenderer'
import * as THREE from 'three'

export function CadModel() {
  const doc = useCADStore(s => s.doc)
  const { scene } = useThree()
  const groupRef = useRef<THREE.Group | null>(null)
  const workerRef = useRef<ReturnType<typeof createCodegenWorker> | null>(null)

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = createCodegenWorker()
    }
    const worker = workerRef.current

    worker.rebuild(doc).then(results => {
      if (groupRef.current) {
        scene.remove(groupRef.current)
        disposeGroup(groupRef.current)
      }

      const group = buildSceneFromWorker(doc, results)
      groupRef.current = group
      scene.add(group)
    })

    return () => {
      if (groupRef.current) {
        scene.remove(groupRef.current)
        disposeGroup(groupRef.current)
        groupRef.current = null
      }
    }
  }, [doc, scene])

  return <SketchRenderer />
}

function buildSceneFromWorker(
  doc: import('../types').CadDocument,
  geometries: ReconstructedGeometry[],
): THREE.Group {
  const root = new THREE.Group()
  root.name = 'CAD Scene'

  const geomMap = new Map<string, THREE.BufferGeometry>()
  for (const g of geometries) {
    geomMap.set(g.featureId, g.geometry)
  }

  function buildNode(node: import('../types').SceneNode): THREE.Object3D | null {
    if (!node.visible) return null

    const group = new THREE.Group()
    group.name = node.name
    group.position.set(...node.transform.position)
    group.rotation.set(
      THREE.MathUtils.degToRad(node.transform.rotation[0]),
      THREE.MathUtils.degToRad(node.transform.rotation[1]),
      THREE.MathUtils.degToRad(node.transform.rotation[2]),
    )
    group.scale.set(...node.transform.scale)
    group.userData.nodeId = node.id

    if (node.bodyId && doc.bodies[node.bodyId]) {
      const body = doc.bodies[node.bodyId]
      const appearance = body.appearance

      for (const feat of body.features) {
        const geom = geomMap.get(feat.id)
        if (geom) {
          const mat = new THREE.MeshStandardMaterial({
            color: appearance.color,
            roughness: appearance.roughness,
            metalness: appearance.metalness,
            transparent: appearance.transparency > 0,
            opacity: 1 - appearance.transparency,
          })
          const mesh = new THREE.Mesh(geom, mat)
          mesh.name = feat.name || body.name
          mesh.userData.bodyId = body.id
          mesh.userData.nodeId = node.id
          mesh.userData.featureId = feat.id
          group.add(mesh)
        }
      }
    }

    for (const child of node.children) {
      const childObj = buildNode(child)
      if (childObj) group.add(childObj)
    }

    return group
  }

  for (const node of doc.scene) {
    const obj = buildNode(node)
    if (obj) root.add(obj)
  }

  return root
}

function disposeGroup(group: THREE.Group) {
  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose())
      } else {
        child.material.dispose()
      }
    }
  })
}
