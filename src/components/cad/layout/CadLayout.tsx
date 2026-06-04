import { useCADStore } from '../store'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { Viewport } from '../viewport/Viewport'
import { SceneGraph } from '../scene/SceneGraph'
import { ToolPalette } from '../tools/ToolPalette'
import { ToolOptions } from '../tools/ToolOptions'
import { PropertiesPanel } from '../properties/PropertiesPanel'
import { ConstructionHistory } from '../workflow/ConstructionHistory'
import { FeatureDialog } from '../workflow/FeatureDialog'
import { CommandPalette } from '../ui/CommandPalette'
import { ContextMenu } from '../ui/ContextMenu'
import { AlertBanner } from '../ui/AlertBanner'
import { ProgressIndicator } from '../ui/ProgressIndicator'
import { DragHandle } from '../ui/DragHandle'
import { TooltipProvider } from '../ui/Tooltip'

export function CadLayout() {
  const panels = useCADStore(s => s.panels)
  const tasks = useCADStore(s => s.tasks)
  const firstError = tasks.find(t => t.status === 'error')
  const firstWarning = tasks.find(t => t.status === 'warning')

  useKeyboardShortcuts()

  return (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col bg-background text-foreground overflow-hidden">
        <Toolbar />

        {firstError && (
          <AlertBanner type="error" message={firstError.label || 'An error occurred'} onDismiss={() => useCADStore.getState().cancelTask(firstError.id)} />
        )}
        {!firstError && firstWarning && (
          <AlertBanner type="warning" message={firstWarning.label || 'Warning'} onDismiss={() => useCADStore.getState().cancelTask(firstWarning.id)} />
        )}

        <div className="flex-1 flex overflow-hidden">
          {panels.palette.visible && (
            <div style={{ width: panels.palette.size }} className="flex-shrink-0 border-r flex flex-col">
              <ToolPalette />
              <div className="border-t flex-1 overflow-auto">
                <ToolOptions />
              </div>
            </div>
          )}

          {panels.scene.visible && (
            <>
              <div style={{ width: panels.scene.size }} className="flex-shrink-0 border-r overflow-hidden flex flex-col">
                <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b">
                  Scene
                </div>
                <div className="flex-1 overflow-auto">
                  <SceneGraph />
                </div>
              </div>
              <DragHandle onDrag={delta => useCADStore.getState().setPanelSize('scene', Math.max(100, panels.scene.size + delta))} />
            </>
          )}

          <div className="flex-1 relative">
            <Viewport />
          </div>

          {panels.history.visible && (
            <>
              <DragHandle onDrag={delta => useCADStore.getState().setPanelSize('history', Math.max(100, panels.history.size + delta))} />
              <div style={{ width: panels.history.size }} className="flex-shrink-0 border-l overflow-hidden flex flex-col">
                <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b">
                  History
                </div>
                <div className="flex-1 overflow-auto">
                  <ConstructionHistory />
                </div>
              </div>
            </>
          )}

          {panels.properties.visible && (
            <>
              <DragHandle onDrag={delta => useCADStore.getState().setPanelSize('properties', Math.max(100, panels.properties.size + delta))} />
              <div style={{ width: panels.properties.size }} className="flex-shrink-0 border-l overflow-hidden flex flex-col">
                <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b">
                  Properties
                </div>
                <div className="flex-1 overflow-auto">
                  <PropertiesPanel />
                </div>
              </div>
            </>
          )}
        </div>

        {panels.status.visible && <StatusBar />}

        <CommandPalette />
        <ContextMenu />
        <ProgressIndicator />
        <FeatureDialog
          open={useCADStore(s => s.editDialog.open)}
          onOpenChange={open => { if (!open) useCADStore.getState().closeEditDialog() }}
          featureId={useCADStore(s => s.editDialog.featureId)}
          bodyId={useCADStore(s => s.editDialog.bodyId)}
        />
      </div>
    </TooltipProvider>
  )
}
