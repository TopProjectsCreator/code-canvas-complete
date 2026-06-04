import { useCADStore } from '../store'
import { GizmoHelper, GizmoViewport } from '@react-three/drei'
import { TransformControls } from '@react-three/drei'
import { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

export function TransformGizmo() {
  const gizmo = useCADStore(s => s.gizmo)
  const selection = useCADStore(s => s.selection)
  const updateTransform = useCADStore(s => s.updateTransform)
  const toolMode = useCADStore(s => s.toolMode)
  const docVersion = useCADStore(s => s.doc.metadata.version)
  const snap = useCADStore(s => s.snap)
  const controlRef = useRef<any>(null)
  const { scene } = useThree()

  const isTransforming = toolMode === 'move' || toolMode === 'rotate' || toolMode === 'scale'
  const selectedNodeId = selection.find(s => s.type === 'node')?.nodeId
  const [target, setTarget] = useState<THREE.Object3D | null>(null)

  const snapSize = gizmo.snapping && snap.grid ? snap.gridSize : undefined
  const rotationSnap = gizmo.snapping && snap.angle ? snap.angleStep : undefined

  useEffect(() => {
    if (!controlRef.current) return
    const mode = toolMode === 'move' ? 'translate' : toolMode === 'rotate' ? 'rotate' : toolMode === 'scale' ? 'scale' : 'translate'
    controlRef.current.setMode(mode)
    controlRef.current.setSpace(gizmo.space === 'world' ? 'world' : 'local')
  }, [toolMode, gizmo.space])

  useEffect(() => {
    if (!selectedNodeId) {
      setTarget(null)
      return
    }
    let found: THREE.Object3D | null = null
    scene.traverse(child => {
      if (child.userData.nodeId === selectedNodeId) {
        found = child
      }
    })
    setTarget(found)
  }, [selectedNodeId, scene, docVersion])

  return (
    <>
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
      </GizmoHelper>

      {isTransforming && target && (
        <TransformControls
          ref={controlRef}
          object={target}
          mode={gizmo.mode}
          space={gizmo.space === 'world' ? 'world' : 'local'}
          snap={snapSize}
          rotationSnap={rotationSnap}
          onObjectChange={() => {
            if (target && selectedNodeId) {
              updateTransform(selectedNodeId, {
                position: [target.position.x, target.position.y, target.position.z],
                rotation: [target.rotation.x, target.rotation.y, target.rotation.z],
                scale: [target.scale.x, target.scale.y, target.scale.z],
              })
            }
          }}
        />
      )}
    </>
  )
}
