import { Grid } from '@react-three/drei'
import { GRID_DEFAULTS } from '../constants'
import { useCADStore } from '../store'

export function GridHelper() {
  const gridVisible = useCADStore(s => s.viewport.grid)
  if (!gridVisible) return null

  return (
    <Grid
      args={[GRID_DEFAULTS.extent, GRID_DEFAULTS.extent / GRID_DEFAULTS.sectionSize]}
      cellSize={GRID_DEFAULTS.cellSize}
      sectionSize={GRID_DEFAULTS.sectionSize}
      cellColor={GRID_DEFAULTS.color}
      sectionColor={GRID_DEFAULTS.sectionColor}
      fadeDistance={GRID_DEFAULTS.extent * 2}
      infiniteGrid
    />
  )
}
