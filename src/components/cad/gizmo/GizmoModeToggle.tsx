import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'

export function GizmoModeToggle() {
  const gizmo = useCADStore(s => s.gizmo)
  const setGizmoMode = useCADStore(s => s.setGizmoMode)
  const setSnapping = useCADStore(s => s.setSnapping)

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={gizmo.mode === 'translate' ? 'default' : 'ghost'}
        size="sm"
        className="h-6 text-[10px] px-1.5"
        onClick={() => setGizmoMode('translate')}
      >
        T
      </Button>
      <Button
        variant={gizmo.mode === 'rotate' ? 'default' : 'ghost'}
        size="sm"
        className="h-6 text-[10px] px-1.5"
        onClick={() => setGizmoMode('rotate')}
      >
        R
      </Button>
      <Button
        variant={gizmo.mode === 'scale' ? 'default' : 'ghost'}
        size="sm"
        className="h-6 text-[10px] px-1.5"
        onClick={() => setGizmoMode('scale')}
      >
        S
      </Button>

      <Button
        variant={gizmo.snapping ? 'default' : 'ghost'}
        size="sm"
        className="h-6 text-[10px] px-1.5 ml-1"
        onClick={() => setSnapping(!gizmo.snapping)}
      >
        Snap {gizmo.snapping ? 'ON' : 'OFF'}
      </Button>
    </div>
  )
}
