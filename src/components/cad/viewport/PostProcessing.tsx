import { EffectComposer, Bloom, SSAO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export function PostProcessing() {
  return (
    <EffectComposer multisampling={4}>
      <SSAO
        intensity={0.5}
        radius={0.1}
        bias={0.001}
        distanceThreshold={100}
      />
      <Bloom
        intensity={0.1}
        luminanceThreshold={2}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
