import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ToolMode } from './types'
import {
  MousePointer2, Square, Circle, Minus, Type, Pen, Pencil,
  Undo2, Redo2, ZoomIn, ZoomOut, Grid3X3, Magnet,
  Download, Code2, Copy, Image,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  ArrowLeftRight, ArrowUpDown,
  Merge, Split, Ungroup, Group,
  Layers,
} from 'lucide-react'

interface ToolbarProps {
  toolMode: ToolMode
  onToolChange: (mode: ToolMode) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  showGrid: boolean
  onToggleGrid: () => void
  snapToGrid: boolean
  onToggleSnap: () => void
  onExportSvg: () => void
  onExportPng: () => void
  onCopySvg: () => void
  onToggleSource: () => void
  showSource: boolean
  onGroup: () => void
  onUngroup: () => void
  onBooleanOp: (op: 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide') => void
  onAlign: (mode: 'left' | 'center-x' | 'right' | 'top' | 'middle-y' | 'bottom') => void
  onDistribute: (mode: 'horizontal' | 'vertical') => void
  selectionCount: number
}

const TOOLS: Array<{ mode: ToolMode; icon: React.ReactNode; label: string }> = [
  { mode: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select' },
  { mode: 'rect', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
  { mode: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
  { mode: 'ellipse', icon: <Circle className="w-4 h-4" />, label: 'Ellipse' },
  { mode: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
  { mode: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
  { mode: 'path', icon: <Pen className="w-4 h-4" />, label: 'Path' },
  { mode: 'freehand', icon: <Pencil className="w-4 h-4" />, label: 'Freehand' },
]

export function Toolbar({
  toolMode, onToolChange,
  onUndo, onRedo, canUndo, canRedo,
  zoom, onZoomIn, onZoomOut, onZoomFit,
  showGrid, onToggleGrid, snapToGrid, onToggleSnap,
  onExportSvg, onExportPng, onCopySvg,
  onToggleSource, showSource,
  onGroup, onUngroup,
  onBooleanOp, onAlign, onDistribute,
  selectionCount,
}: ToolbarProps) {
  const hasSelection = selectionCount > 0
  const hasMultiSelection = selectionCount > 1

  const tooltip = (content: string) => (
    <TooltipContent side="bottom" className="text-xs">{content}</TooltipContent>
  )

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-background border-b border-border overflow-x-auto shrink-0">
      {/* Drawing tools */}
      <div className="flex items-center gap-0.5 mr-1">
        {TOOLS.map((t) => (
          <Tooltip key={t.mode}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 w-7 p-0', toolMode === t.mode && 'bg-accent text-accent-foreground')}
                onClick={() => onToolChange(t.mode)}
              >
                {t.icon}
              </Button>
            </TooltipTrigger>
            {tooltip(t.label)}
          </Tooltip>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Undo/Redo */}
      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!canUndo} onClick={onUndo}>
          <Undo2 className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Undo (Ctrl+Z)')}</Tooltip>

      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!canRedo} onClick={onRedo}>
          <Redo2 className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Redo (Ctrl+Shift+Z)')}</Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Group/Ungroup */}
      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasMultiSelection} onClick={onGroup}>
          <Group className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Group')}</Tooltip>

      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasSelection} onClick={onUngroup}>
          <Ungroup className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Ungroup')}</Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Boolean operations */}
      {(['union', 'intersect', 'subtract', 'exclude', 'divide'] as const).map((op) => (
        <Tooltip key={op}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-[9px] font-bold"
              disabled={!hasMultiSelection}
              onClick={() => onBooleanOp(op)}
            >
              {op === 'union' && <Merge className="w-3.5 h-3.5" />}
              {op === 'intersect' && <Split className="w-3.5 h-3.5" />}
              {op === 'subtract' && <Minus className="w-3.5 h-3.5" />}
              {op === 'exclude' && <Ungroup className="w-3.5 h-3.5" />}
              {op === 'divide' && <Layers className="w-3.5 h-3.5" />}
            </Button>
          </TooltipTrigger>
          {tooltip(op.charAt(0).toUpperCase() + op.slice(1))}
        </Tooltip>
      ))}

      <div className="w-px h-5 bg-border mx-1" />

      {/* Align */}
      {(['left', 'center-x', 'right'] as const).map((mode) => (
        <Tooltip key={mode}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasSelection} onClick={() => onAlign(mode)}>
              {mode === 'left' && <AlignStartVertical className="w-3.5 h-3.5" />}
              {mode === 'center-x' && <AlignCenterVertical className="w-3.5 h-3.5" />}
              {mode === 'right' && <AlignEndVertical className="w-3.5 h-3.5" />}
            </Button>
          </TooltipTrigger>
          {tooltip(`Align ${mode}`)}
        </Tooltip>
      ))}

      {(['top', 'middle-y', 'bottom'] as const).map((mode) => (
        <Tooltip key={mode}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasSelection} onClick={() => onAlign(mode)}>
              {mode === 'top' && <AlignStartHorizontal className="w-3.5 h-3.5" />}
              {mode === 'middle-y' && <AlignCenterHorizontal className="w-3.5 h-3.5" />}
              {mode === 'bottom' && <AlignEndHorizontal className="w-3.5 h-3.5" />}
            </Button>
          </TooltipTrigger>
          {tooltip(`Align ${mode}`)}
        </Tooltip>
      ))}

      <div className="w-px h-5 bg-border mx-1" />

      {/* Distribute */}
      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasMultiSelection} onClick={() => onDistribute('horizontal')}>
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </Button>
      </TooltipTrigger>{tooltip('Distribute horizontally')}</Tooltip>

      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasMultiSelection} onClick={() => onDistribute('vertical')}>
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      </TooltipTrigger>{tooltip('Distribute vertically')}</Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* View */}
      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Zoom out')}</Tooltip>

      <span className="text-xs text-muted-foreground min-w-[48px] text-center select-none">
        {Math.round(zoom * 100)}%
      </span>

      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Zoom in')}</Tooltip>

      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={onZoomFit}>
          Fit
        </Button>
      </TooltipTrigger>{tooltip('Fit to canvas')}</Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Toggles */}
      <Tooltip><TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0', showGrid && 'bg-accent text-accent-foreground')}
          onClick={onToggleGrid}
        >
          <Grid3X3 className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Toggle grid')}</Tooltip>

      <Tooltip><TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0', snapToGrid && 'bg-accent text-accent-foreground')}
          onClick={onToggleSnap}
        >
          <Magnet className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Snap to grid')}</Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Source code */}
      <Tooltip><TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0', showSource && 'bg-accent text-accent-foreground')}
          onClick={onToggleSource}
        >
          <Code2 className="w-4 h-4" />
        </Button>
      </TooltipTrigger>{tooltip('Toggle source code')}</Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Export */}
      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" onClick={onExportSvg}>
          <Download className="w-3 h-3" /> SVG
        </Button>
      </TooltipTrigger>{tooltip('Download SVG')}</Tooltip>

      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" onClick={onExportPng}>
          <Image className="w-3 h-3" /> PNG
        </Button>
      </TooltipTrigger>{tooltip('Export as PNG')}</Tooltip>

      <Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCopySvg}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </TooltipTrigger>{tooltip('Copy SVG source')}</Tooltip>
    </div>
  )
}
