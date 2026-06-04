import { useThree } from '@react-three/fiber'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useCADStore } from '../store'
import * as THREE from 'three'

export function SelectionFrustum() {
  const { gl, camera, scene } = useThree()
  const marqueeSelect = useCADStore(s => s.marqueeSelect)
  const toolMode = useCADStore(s => s.toolMode)
  const [isDragging, setIsDragging] = useState(false)
  const startPoint = useRef<THREE.Vector2 | null>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const rectRef = useRef<DOMRect | null>(null)

  const getNDC = useCallback((clientX: number, clientY: number): THREE.Vector2 => {
    const rect = rectRef.current ?? gl.domElement.getBoundingClientRect()
    rectRef.current = rect
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
  }, [gl])

  useEffect(() => {
    if (toolMode !== 'select') return

    const dom = gl.domElement

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      startPoint.current = getNDC(e.clientX, e.clientY)
      const rect = dom.getBoundingClientRect()
      setBox({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 })
      setIsDragging(true)
    }

    const onMove = (e: MouseEvent) => {
      if (!isDragging || !startPoint.current) return
      const rect = dom.getBoundingClientRect()
      const current = getNDC(e.clientX, e.clientY)
      setBox({
        x: Math.min(startPoint.current.x, current.x),
        y: Math.min(startPoint.current.y, current.y),
        w: Math.abs(current.x - startPoint.current.x),
        h: Math.abs(current.y - startPoint.current.y),
      })
    }

    const onUp = (e: MouseEvent) => {
      if (!isDragging || !startPoint.current) return
      const end = getNDC(e.clientX, e.clientY)

      const frustum = new THREE.Frustum()
      const projScreen = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
      frustum.setFromProjectionMatrix(projScreen)

      const meshes: THREE.Mesh[] = []
      scene.traverse(child => {
        if (child instanceof THREE.Mesh && child.geometry.boundingSphere) meshes.push(child)
      })

      const selected: { type: 'body'; bodyId: string }[] = []
      for (const mesh of meshes) {
        const sphere = mesh.geometry.boundingSphere!
        const worldSphere = sphere.clone().applyMatrix4(mesh.matrixWorld)
        if (frustum.intersectsSphere(worldSphere)) {
          const bodyId = mesh.userData.bodyId as string | undefined
          if (bodyId) selected.push({ type: 'body' as const, bodyId })
        }
      }

      if (selected.length > 0) marqueeSelect(selected)
      setIsDragging(false)
      startPoint.current = null
      setBox(null)
    }

    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerup', onUp)
    }
  }, [gl, camera, scene, toolMode, isDragging, marqueeSelect, getNDC])

  if (!box || box.w < 0.01) return null

  const rect = rectRef.current ?? gl.domElement.getBoundingClientRect()
  const scaleX = rect.width / 2
  const scaleY = rect.height / 2

  return (
    <div
      className="absolute pointer-events-none z-10 border-2 border-blue-500 bg-blue-500/10"
      style={{
        left: `${(box.x + 1) * scaleX}px`,
        top: `${(-box.y + 1) * scaleY}px`,
        width: `${box.w * scaleX}px`,
        height: `${box.h * scaleY}px`,
      }}
    />
  )
}
