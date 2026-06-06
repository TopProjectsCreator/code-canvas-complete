import { Environment as DreiEnvironment } from '@react-three/drei'
import { useCADStore } from '../store'

const PRESET_MAP: Record<string, 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby'> = {
  studio: 'studio',
  outdoor: 'park',
  indoor: 'lobby',
  cave: 'warehouse',
  night: 'night',
  custom: 'city',
}

export function Environment() {
  const preset = useCADStore(s => s.viewport.environmentPreset)
  const dreiPreset = PRESET_MAP[preset] ?? 'studio'

  return (
    <DreiEnvironment
      preset={dreiPreset}
      background={false}
    />
  )
}
