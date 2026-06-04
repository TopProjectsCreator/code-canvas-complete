import { GripVertical } from 'lucide-react'

interface DragHandleProps {
  onDrag?: (delta: number) => void
}

export function DragHandle({ onDrag }: DragHandleProps) {
  return (
    <div
      className="flex items-center justify-center h-full w-4 cursor-col-resize text-muted-foreground hover:text-foreground"
      onMouseDown={e => {
        if (!onDrag) return
        const startX = e.clientX
        function onMove(ev: MouseEvent) {
          onDrag(ev.clientX - startX)
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      }}
    >
      <GripVertical className="h-4 w-4" />
    </div>
  )
}
