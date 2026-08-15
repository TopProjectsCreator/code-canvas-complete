const SNAP_GRID = 15;

export function snapToGrid(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(x / SNAP_GRID) * SNAP_GRID,
    y: Math.round(y / SNAP_GRID) * SNAP_GRID,
  };
}
