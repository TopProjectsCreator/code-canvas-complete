import { useCADStore } from '../store'
import { UNIT_LABELS } from '../constants'
import { GizmoModeToggle } from '../gizmo/GizmoModeToggle'

export function StatusBar() {
  const units = useCADStore(s => s.units)
  const toolMode = useCADStore(s => s.toolMode)
  const selection = useCADStore(s => s.selection)
  const snap = useCADStore(s => s.snap)
  const tasks = useCADStore(s => s.tasks)
  const dirty = useCADStore(s => s.dirty)

  const runningTasks = tasks.filter(t => t.status === 'running')

  return (
    <div className="h-7 border-t flex items-center px-3 gap-3 text-xs text-muted-foreground bg-background">
      <span className="font-mono">Tool: {toolMode}</span>

      <span className="font-mono">
        Sel: {selection.length} {selection.length === 1 ? `(${selection[0].type})` : ''}
      </span>

      <span>Units: {UNIT_LABELS[units] || units}</span>

      <span>Snap: {snap.grid ? 'Grid' : ''} {snap.vertex ? 'Vtx' : ''} {snap.angle ? `${snap.angleStep}°` : ''}</span>

      <div className="flex-1" />

      <GizmoModeToggle />

      {runningTasks.length > 0 && (
        <span className="text-blue-500">{runningTasks.length} task{runningTasks.length > 1 ? 's' : ''} running</span>
      )}

      {dirty && <span className="text-amber-500">Unsaved</span>}
    </div>
  )
}
