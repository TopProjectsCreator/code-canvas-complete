import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  MousePointer2, Minus, Circle, RectangleHorizontal,
  ScissorsLineDashed, ArrowLeftRight, ArrowUpDown,
  FlipHorizontal, Grid3x3, type LucideIcon,
} from 'lucide-react'

import { forwardRef } from 'react'

const ArcFull = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 12a10 10 0 0 0-18.48-5.02" />
    <path d="M22 12a10 10 0 0 1-18.48 5.02" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
))
ArcFull.displayName = 'ArcFull'

const SKETCH_TOOLS = [
  { id: 'select' as const, icon: MousePointer2, label: 'Select' },
  { id: 'line' as const, icon: Minus, label: 'Line' },
  { id: 'circle' as const, icon: Circle, label: 'Circle' },
  { id: 'rectangle' as const, icon: RectangleHorizontal, label: 'Rectangle' },
  { id: 'arc' as const, icon: ArcFull, label: 'Arc' },
  { id: 'trim' as const, icon: ScissorsLineDashed, label: 'Trim' },
  { id: 'extend' as const, icon: ArrowLeftRight, label: 'Extend' },
  { id: 'offset' as const, icon: ArrowUpDown, label: 'Offset' },
  { id: 'mirror' as const, icon: FlipHorizontal, label: 'Mirror' },
  { id: 'pattern' as const, icon: Grid3x3, label: 'Pattern' },
]

export function SketchTool() {
  const sketchTool = useCADStore(s => s.sketchTool)
  const setSketchTool = useCADStore(s => s.setSketchTool)
  const endSketch = useCADStore(s => s.endSketch)

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 px-1">
        {SKETCH_TOOLS.map(t => {
          const Icon = t.icon
          return (
            <Button
              key={t.id}
              variant={sketchTool === t.id ? 'default' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setSketchTool(t.id)}
              title={t.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          )
        })}
      </div>

      <Separator className="my-1" />

      <div className="px-2 py-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={endSketch}
        >
          Finish Sketch
        </Button>
      </div>
    </div>
  )
}
