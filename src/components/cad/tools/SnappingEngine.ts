import { useCADStore } from '../store'

export interface SnapResult {
  point: [number, number, number]
  type: 'grid' | 'vertex' | 'edge' | 'midpoint' | 'center'
  distance: number
}

export function snapToGrid(
  point: [number, number, number],
  gridSize: number
): [number, number, number] {
  return [
    Math.round(point[0] / gridSize) * gridSize,
    Math.round(point[1] / gridSize) * gridSize,
    Math.round(point[2] / gridSize) * gridSize,
  ]
}

export function getSnapPoint(
  point: [number, number, number],
  snapTargets: SnapResult[]
): SnapResult | null {
  const snap = useCADStore.getState().snap
  if (!snap.grid && !snap.vertex && !snap.midpoint) return null

  let best: SnapResult | null = null

  if (snap.grid) {
    const snapped = snapToGrid(point, snap.gridSize)
    const dist = Math.sqrt(
      (point[0] - snapped[0]) ** 2 +
      (point[1] - snapped[1]) ** 2 +
      (point[2] - snapped[2]) ** 2
    )
    if (dist < snap.threshold) {
      best = { point: snapped, type: 'grid', distance: dist }
    }
  }

  for (const target of snapTargets) {
    if (target.distance < snap.threshold) {
      if (!best || target.distance < best.distance) {
        best = target
      }
    }
  }

  return best
}
