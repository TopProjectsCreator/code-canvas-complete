import { EffectComposer, Bloom, SSAO } from '@react-three/postprocessing'

export function PostProcessing() {
  return (
    <EffectComposer multisampling={4}>
      <SSAO
        intensity={0.5}
        radius={0.1}
        bias={0.001}
        distanceThreshold={100}
        worldDistanceThreshold={100}
        worldDistanceFalloff={0.01}
        worldProximityThreshold={0.1}
        worldProximityFalloff={0.01}
      />
      <Bloom
        intensity={0.1}
        luminanceThreshold={2}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
    </EffectComposer>
  )
}
