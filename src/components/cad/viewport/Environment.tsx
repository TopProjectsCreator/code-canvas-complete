import { Environment as DreiEnvironment } from '@react-three/drei'
import { useCADStore } from '../store'

export function Environment() {
  const preset = useCADStore(s => s.viewport.environmentPreset)

  return (
    <DreiEnvironment
      preset={preset}
      background={false}
    />
  )
}
