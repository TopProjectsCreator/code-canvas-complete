import { Canvas } from '@react-three/fiber'
import { OrbitControls, SoftShadows } from '@react-three/drei'
import { Suspense, useEffect, useRef } from 'react'
import { useCADStore } from '../store'
import { GridHelper } from './GridHelper'
import { Environment } from './Environment'
import { PostProcessing } from './PostProcessing'
import { SelectionManager } from '../selection/SelectionManager'
import { SelectionFrustum } from '../selection/SelectionFrustum'
import { SelectorOverlay } from '../selection/SelectorOverlay'
import { TransformGizmo } from '../gizmo/TransformGizmo'
import { CadModel } from './CadModel'
import { CAD_COLORS } from '../cadTheme'

function OrbitControlsWithScroll() {
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        if (controlsRef.current) controlsRef.current.enableZoom = true
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        if (controlsRef.current) controlsRef.current.enableZoom = false
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={0.5}
      maxDistance={10000}
      enableZoom={false}
    />
  )
}

function SceneContent() {
  const background = useCADStore(s => s.viewport.background)
  const bgColor = useCADStore(s => s.viewport.customBackgroundColor)

  const finalColor = background === 'dark'
    ? CAD_COLORS.backgroundDark
    : background === 'light'
      ? CAD_COLORS.backgroundLight
      : bgColor

  return (
    <>
      <color attach="background" args={[finalColor]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />

      <SoftShadows />

      <Suspense fallback={null}>
        <Environment />
      </Suspense>

      <GridHelper />

      <CadModel />
      <SelectionManager />
      <SelectionFrustum />
      <SelectorOverlay />
      <TransformGizmo />
      <PostProcessing />

      <OrbitControlsWithScroll />
    </>
  )
}

export function Viewport() {
  return (
    <Canvas
      className="w-full h-full"
      camera={{ position: [50, 50, 50], fov: 45, near: 0.1, far: 20000 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <SceneContent />
    </Canvas>
  )
}
