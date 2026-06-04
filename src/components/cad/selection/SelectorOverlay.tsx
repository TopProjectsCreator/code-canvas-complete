import { useThree } from '@react-three/fiber'
import { useCADStore } from '../store'
import { CAD_COLORS } from '../cadTheme'
import * as THREE from 'three'

export function SelectorOverlay() {
  const selection = useCADStore(s => s.selection)
  const { scene } = useThree()

  if (selection.length === 0) return null

  const meshes: THREE.Mesh[] = []
  scene.traverse(child => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })

  const selectedMeshes = meshes.filter(m => {
    const bodyId = m.userData.bodyId as string | undefined
    return bodyId && selection.some(s => s.type === 'body' && s.bodyId === bodyId)
  })

  return (
    <>
      {selectedMeshes.map(mesh => {
        const box = new THREE.Box3().setFromObject(mesh)
        const size = new THREE.Vector3()
        box.getSize(size)

        const geom = new THREE.EdgesGeometry(
          new THREE.BoxGeometry(size.x + 0.1, size.y + 0.1, size.z + 0.1)
        )
        const mat = new THREE.LineBasicMaterial({ color: CAD_COLORS.selection })
        const lineSegments = new THREE.LineSegments(geom, mat)

        return <primitive key={mesh.uuid} object={lineSegments} />
      })}
    </>
  )
}
