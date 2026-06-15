import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useCADStore } from '../store'
import { WorkspaceLoader } from './WorkspaceLoader'
import {
  Undo2, Redo2, Grid3x3, Eye, EyeOff,
  MousePointer2, Move3d, Rotate3d, Maximize2,
  PanelLeft, PanelRight, PanelBottom,
} from 'lucide-react'
import type { ToolMode } from '../types'

const MODE_BUTTONS: { mode: ToolMode; icon: typeof MousePointer2; label: string }[] = [
  { mode: 'select', icon: MousePointer2, label: 'Select' },
  { mode: 'move', icon: Move3d, label: 'Move' },
  { mode: 'rotate', icon: Rotate3d, label: 'Rotate' },
  { mode: 'scale', icon: Maximize2, label: 'Scale' },
]

const PANEL_TOGGLES = [
  { id: 'palette', icon: PanelLeft, label: 'Tool Palette', shortcut: 'P' },
  { id: 'scene', icon: PanelBottom, label: 'Scene Panel', shortcut: 'S' },
  { id: 'history', icon: PanelRight, label: 'History', shortcut: 'H' },
  { id: 'properties', icon: PanelRight, label: 'Properties', shortcut: 'I' },
] as const

export function Toolbar() {
  const toolMode = useCADStore(s => s.toolMode)
  const setToolMode = useCADStore(s => s.setToolMode)
  const viewport = useCADStore(s => s.viewport)
  const toggleGrid = useCADStore(s => s.toggleGrid)
  const toggleWireframe = useCADStore(s => s.toggleWireframe)
  const toggleGhost = useCADStore(s => s.toggleGhost)
  const undo = useCADStore(s => s.undo)
  const redo = useCADStore(s => s.redo)
  const gizmo = useCADStore(s => s.gizmo)
  const setGizmoMode = useCADStore(s => s.setGizmoMode)
  const setGizmoSpace = useCADStore(s => s.setGizmoSpace)
  const panels = useCADStore(s => s.panels)
  const togglePanel = useCADStore(s => s.togglePanel)
  const snap = useCADStore(s => s.snap)
  const setSnapEnabled = useCADStore(s => s.setSnapEnabled)

  return (
    <div className="h-10 border-b flex items-center px-2 gap-1 bg-background">
      <WorkspaceLoader />

      <Separator orientation="vertical" className="h-6 mx-1" />

      <div className="flex items-center gap-0.5">
        {MODE_BUTTONS.map(btn => {
          const Icon = btn.icon
          return (
            <Button
              key={btn.mode}
              variant={toolMode === btn.mode ? 'default' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                setToolMode(btn.mode)
                if (btn.mode === 'move' || btn.mode === 'rotate' || btn.mode === 'scale') {
                  setGizmoMode(btn.mode === 'move' ? 'translate' : btn.mode)
                }
              }}
              title={btn.label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        })}
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => undo()} title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => redo()} title="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <div className="flex items-center gap-0.5">
        <Button
          variant={viewport.grid ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={toggleGrid}
          title="Toggle Grid"
        >
          <Grid3x3 className="h-4 w-4" />
        </Button>
        <Button
          variant={viewport.wireframe ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={toggleWireframe}
          title="Toggle Wireframe"
        >
          <EyeOff className="h-4 w-4" />
        </Button>
        <Button
          variant={viewport.ghostMode ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={toggleGhost}
          title="X-Ray Mode"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <div className="flex items-center gap-0.5">
        <Button
          variant={gizmo.space === 'world' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => setGizmoSpace(gizmo.space === 'world' ? 'local' : 'world')}
          title="Transform Space"
        >
          {gizmo.space === 'world' ? 'World' : 'Local'}
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <div className="flex items-center gap-0.5">
        <Button
          variant={snap.grid ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs px-1.5 gap-1"
          onClick={() => setSnapEnabled('grid', !snap.grid)}
          title={`Grid Snap ${snap.grid ? 'ON' : 'OFF'} (${snap.gridSize})`}
        >
          <span className="text-[10px] font-mono">{snap.gridSize}</span>
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs px-2"
        onClick={() => {
          import('../demo/createDemoDocument').then(m => {
            useCADStore.getState().loadDoc(m.createDemoDocument())
          })
        }}
        title="Load demo scene"
      >
        Demo
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <div className="flex items-center gap-0.5">
        {PANEL_TOGGLES.map(t => {
          const Icon = t.icon
          return (
            <Button
              key={t.id}
              variant={panels[t.id]?.visible ? 'default' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => togglePanel(t.id)}
              title={`${t.label} (${t.shortcut})`}
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        })}
      </div>
    </div>
  )
}
