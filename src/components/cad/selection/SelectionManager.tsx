import { useThree } from '@react-three/fiber'
import { useEffect, useCallback } from 'react'
import { useCADStore } from '../store'
import * as THREE from 'three'

export function SelectionManager() {
  const { gl, camera, scene } = useThree()
  const select = useCADStore(s => s.select)
  const setHovered = useCADStore(s => s.setHovered)
  const toolMode = useCADStore(s => s.toolMode)

  const handleClick = useCallback((event: MouseEvent) => {
    if (toolMode !== 'select') return

    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)

    const meshes: THREE.Mesh[] = []
    scene.traverse(child => {
      if (child instanceof THREE.Mesh) meshes.push(child)
    })

    const intersects = raycaster.intersectObjects(meshes)
    if (intersects.length > 0) {
      const hit = intersects[0].object
      const bodyId = hit.userData.bodyId as string | undefined
      if (bodyId) {
        select({ type: 'body', bodyId })
      } else {
        select({ type: 'node', nodeId: hit.name })
      }
    }
  }, [gl, camera, scene, toolMode, select])

  const handleMove = useCallback((event: MouseEvent) => {
    if (toolMode !== 'select') return

    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)

    const meshes: THREE.Mesh[] = []
    scene.traverse(child => {
      if (child instanceof THREE.Mesh) meshes.push(child)
    })

    const intersects = raycaster.intersectObjects(meshes)
    if (intersects.length > 0) {
      const hit = intersects[0].object
      const bodyId = hit.userData.bodyId as string | undefined
      if (bodyId) {
        setHovered({ type: 'body', bodyId })
      }
    } else {
      setHovered(null)
    }
  }, [gl, camera, scene, toolMode, setHovered])

  useEffect(() => {
    const dom = gl.domElement
    dom.addEventListener('click', handleClick)
    dom.addEventListener('pointermove', handleMove)
    return () => {
      dom.removeEventListener('click', handleClick)
      dom.removeEventListener('pointermove', handleMove)
    }
  }, [gl, handleClick, handleMove])

  return null
}
