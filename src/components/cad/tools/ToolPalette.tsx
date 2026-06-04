import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TOOL_ICONS } from '../cadIcons'
import type { ToolMode } from '../types'
import { Separator } from '@/components/ui/separator'

const TOOL_GROUPS: { label: string; tools: ToolMode[] }[] = [
  {
    label: 'Select',
    tools: ['select'],
  },
  {
    label: 'Transform',
    tools: ['move', 'rotate', 'scale'],
  },
  {
    label: 'Sketch',
    tools: ['sketch'],
  },
  {
    label: 'Features',
    tools: ['extrude', 'revolve', 'sweep', 'loft', 'coil', 'rib'],
  },
  {
    label: 'Modifiers',
    tools: ['fillet', 'chamfer', 'shell', 'draft', 'hole', 'thread'],
  },
  {
    label: 'Boolean',
    tools: ['boolean'],
  },
  {
    label: 'Pattern',
    tools: ['mirror', 'pattern'],
  },
  {
    label: 'Surface',
    tools: ['emboss', 'wrap', 'thicken', 'split-body', 'move-face'],
  },
  {
    label: 'Measure',
    tools: ['measure'],
  },
]

export function ToolPalette() {
  const toolMode = useCADStore(s => s.toolMode)
  const setToolMode = useCADStore(s => s.setToolMode)

  return (
    <div className="flex flex-col items-center py-2 gap-1">
      {TOOL_GROUPS.map((group, gi) => (
        <div key={group.label} className="flex flex-col items-center gap-0.5">
          {gi > 0 && <Separator className="my-1 w-6" />}
          {group.tools.map(mode => {
            const Icon = TOOL_ICONS[mode]
            if (!Icon) return null
            return (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <Button
                    variant={toolMode === mode ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setToolMode(mode)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {group.label === 'Select' ? 'Select' : mode.charAt(0).toUpperCase() + mode.slice(1).replace('-', ' ')}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      ))}
    </div>
  )
}
