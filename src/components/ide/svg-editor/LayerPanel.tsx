import { useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { SvgElement } from './types'
import { Eye, EyeOff, Lock, Unlock, GripVertical } from 'lucide-react'

interface LayerPanelProps {
  elements: SvgElement[]
  selectedIds: Set<string>
  onSelect: (ids: Set<string>, toggle?: boolean) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

const elementIcon = (type: string): string => {
  switch (type) {
    case 'rect': return '■'
    case 'circle': return '●'
    case 'ellipse': return '⬮'
    case 'line': return '╱'
    case 'path': return '∼'
    case 'text': return 'T'
    case 'group': return '▦'
    case 'image': return '🖼'
    default: return '□'
  }
}

export function LayerPanel({
  elements, selectedIds, onSelect,
  onReorder, onToggleVisibility, onToggleLock,
  onDuplicate, onDelete,
}: LayerPanelProps) {
  const flatElements = elements.filter((e) => e.type !== 'group')
    .concat(elements.filter((e) => e.type === 'group'))

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex)
    }
  }, [onReorder])

  return (
    <div className="flex flex-col overflow-hidden border-r border-border bg-background" style={{ minWidth: 180, maxWidth: 220 }}>
      <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase border-b border-border">
        Layers ({flatElements.length})
      </div>
      <ScrollArea className="flex-1">
        {flatElements.length === 0 ? (
          <div className="p-3 text-[10px] text-muted-foreground text-center">No elements yet</div>
        ) : (
          <div className="divide-y divide-border/50">
            {flatElements.map((el, i) => {
              const isSelected = selectedIds.has(el.id)
              return (
                <div
                  key={el.id}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1.5 cursor-pointer text-xs transition-colors',
                    isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40',
                    !el.visible && 'opacity-40',
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, i)}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      const next = new Set(selectedIds)
                      if (next.has(el.id)) next.delete(el.id)
                      else next.add(el.id)
                      onSelect(next)
                    } else {
                      onSelect(new Set([el.id]))
                    }
                  }}
                >
                  {/* Drag handle */}
                  <span className="text-muted-foreground cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3 h-3" />
                  </span>

                  {/* Type icon */}
                  <span className="text-muted-foreground w-4 text-center text-[10px]">
                    {elementIcon(el.type)}
                  </span>

                  {/* Name */}
                  <span className="flex-1 truncate text-[11px]">{el.name || el.type}</span>

                  {/* Visibility */}
                  <button
                    className="p-0.5 hover:text-foreground text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(el.id) }}
                    title={el.visible ? 'Hide' : 'Show'}
                  >
                    {el.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>

                  {/* Lock */}
                  <button
                    className="p-0.5 hover:text-foreground text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); onToggleLock(el.id) }}
                    title={el.locked ? 'Unlock' : 'Lock'}
                  >
                    {el.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
