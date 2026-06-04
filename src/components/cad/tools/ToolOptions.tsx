import { useCADStore } from '../store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SketchTool } from '../sketch/SketchTool'
import { SketchCanvas2D } from '../sketch/SketchCanvas2D'
import { SketchConstraints } from '../sketch/SketchConstraints'
import { SketchDimensions } from '../sketch/SketchDimensions'
import { SketchAnalysis } from '../sketch/SketchAnalysis'
import { SketchImport } from '../sketch/SketchImport'
import { FeatureTool } from './FeatureTool'
import { SweepTool } from './SweepTool'
import { LoftTool } from './LoftTool'
import { MirrorTool } from './MirrorTool'
import { PatternTool } from './PatternTool'
import { CoilTool } from './CoilTool'
import { RibTool } from './RibTool'
import { ThreadTool } from './ThreadTool'
import { FilletTool } from './FilletTool'
import { ChamferTool } from './ChamferTool'
import { ShellTool } from './ShellTool'
import { DraftTool } from './DraftTool'
import { HoleTool } from './HoleTool'
import { BooleanTool } from './BooleanTool'

export function ToolOptions() {
  const toolMode = useCADStore(s => s.toolMode)
  const toolOptions = useCADStore(s => s.toolOptions)
  const setToolOption = useCADStore(s => s.setToolOption)
  const setToolMode = useCADStore(s => s.setToolMode)

  switch (toolMode) {
    case 'select':
    case 'move':
    case 'rotate':
    case 'scale':
      return (
        <div className="p-3 text-xs text-muted-foreground">
          No options for {toolMode} tool
        </div>
      )

    case 'sketch':
      return (
        <div className="flex flex-col h-full">
          <SketchTool />
          <div className="flex-1 overflow-auto border-t p-2 space-y-2">
            <SketchCanvas2D />
            <details className="group">
              <summary className="text-[10px] font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground">
                Analysis
              </summary>
              <SketchAnalysis />
            </details>
            <details className="group">
              <summary className="text-[10px] font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground">
                Import SVG/DXF
              </summary>
              <SketchImport />
            </details>
            <SketchConstraints />
            <SketchDimensions />
          </div>
        </div>
      )

    case 'extrude':
    case 'revolve':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Feature from Sketch</div>
          <FeatureTool />
        </div>
      )

    case 'sweep':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Sweep</div>
          <SweepTool />
        </div>
      )

    case 'loft':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Loft</div>
          <LoftTool />
        </div>
      )

    case 'mirror':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Mirror</div>
          <MirrorTool />
        </div>
      )

    case 'pattern':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Pattern</div>
          <PatternTool />
        </div>
      )

    case 'hole':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Hole</div>
          <HoleTool />
        </div>
      )

    case 'coil':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Coil</div>
          <CoilTool />
        </div>
      )

    case 'rib':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Rib</div>
          <RibTool />
        </div>
      )

    case 'thread':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Thread</div>
          <ThreadTool />
        </div>
      )

    case 'fillet':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Fillet</div>
          <FilletTool />
        </div>
      )

    case 'chamfer':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Chamfer</div>
          <ChamferTool />
        </div>
      )

    case 'shell':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Shell</div>
          <ShellTool />
        </div>
      )

    case 'draft':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Draft</div>
          <DraftTool />
        </div>
      )

    case 'boolean':
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium mb-2">Boolean</div>
          <BooleanTool />
        </div>
      )

    default:
      return (
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium capitalize mb-2">{toolMode} Options</div>
          {Object.entries(toolOptions).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <Label className="text-xs w-20 capitalize">{key}</Label>
              <Input
                className="h-7 text-xs"
                value={String(value ?? '')}
                onChange={e => setToolOption(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )
  }
}
