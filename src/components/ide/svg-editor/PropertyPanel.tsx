import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { SvgElement, SvgDocument, SvgGradient, SvgFilter, SvgPattern, GradientType } from './types'
import { generateId, COLOR_PRESETS, STROKE_WIDTHS, COLOR_MATRIX_PRESETS } from './types'
import { getElementBBox } from './svgUtils'
import { Plus, Trash2, GripVertical } from 'lucide-react'

interface PropertyPanelProps {
  doc: SvgDocument
  selectedIds: Set<string>
  onUpdateElement: (id: string, attrs: Record<string, string | number>, style?: Partial<SvgElement['style']>) => void
  onUpdateTransform: (id: string, transform: SvgElement['transform']) => void
  onAddGradient: (gradient: SvgGradient) => void
  onUpdateGradient: (id: string, gradient: Partial<SvgGradient>) => void
  onDeleteGradient: (id: string) => void
  onAddFilter: (filter: SvgFilter) => void
  onUpdateFilter: (id: string, filter: Partial<SvgFilter>) => void
  onDeleteFilter: (id: string) => void
  onAddPattern: (pattern: SvgPattern) => void
  onUpdatePattern: (id: string, pattern: Partial<SvgPattern>) => void
  onDeletePattern: (id: string) => void
}

export function PropertyPanel({
  doc, selectedIds,
  onUpdateElement, onUpdateTransform,
  onAddGradient, onUpdateGradient, onDeleteGradient,
  onAddFilter, onUpdateFilter, onDeleteFilter,
  onAddPattern, onUpdatePattern, onDeletePattern,
}: PropertyPanelProps) {
  const [activeTab, setActiveTab] = useState<'properties' | 'gradients' | 'filters' | 'patterns'>('properties')

  const selectedElement = selectedIds.size === 1
    ? doc.elements.find((e) => e.id === Array.from(selectedIds)[0])
    : null

  return (
    <div className="w-64 border-l border-border bg-background flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['properties', 'gradients', 'filters', 'patterns'] as const).map((tab) => (
          <button
            key={tab}
            className={cn(
              'flex-1 text-[10px] py-2 font-medium transition-colors',
              activeTab === tab ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {activeTab === 'properties' && (
            <PropertiesContent
              el={selectedElement}
              onUpdateElement={onUpdateElement}
              onUpdateTransform={onUpdateTransform}
              gradients={doc.gradients}
              filters={doc.filters}
            />
          )}
          {activeTab === 'gradients' && (
            <GradientsContent
              gradients={doc.gradients}
              onAddGradient={onAddGradient}
              onUpdateGradient={onUpdateGradient}
              onDeleteGradient={onDeleteGradient}
            />
          )}
          {activeTab === 'filters' && (
            <FiltersContent
              filters={doc.filters}
              onAddFilter={onAddFilter}
              onUpdateFilter={onUpdateFilter}
              onDeleteFilter={onDeleteFilter}
            />
          )}
          {activeTab === 'patterns' && (
            <PatternsContent
              patterns={doc.patterns}
              onAddPattern={onAddPattern}
              onUpdatePattern={onUpdatePattern}
              onDeletePattern={onDeletePattern}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function PropertiesContent({
  el, onUpdateElement, onUpdateTransform, gradients, filters,
}: {
  el: SvgElement | undefined
  onUpdateElement: PropertyPanelProps['onUpdateElement']
  onUpdateTransform: PropertyPanelProps['onUpdateTransform']
  gradients: SvgGradient[]
  filters: SvgFilter[]
}) {
  if (!el) {
    return <p className="text-xs text-muted-foreground text-center py-8">Select an element to edit properties</p>
  }

  const updateStyle = (key: keyof SvgElement['style'], value: string | number) => {
    onUpdateElement(el.id, {}, { [key]: value })
  }

  const updateAttr = (key: string, value: string | number) => {
    onUpdateElement(el.id, { [key]: value })
  }

  return (
    <div className="space-y-3">
      {/* Element name */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Element</Label>
        <p className="text-xs font-medium">{el.name || el.type}</p>
      </div>

      {/* Geometry */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Geometry</p>
        {el.type === 'rect' && (
          <div className="grid grid-cols-2 gap-1.5">
            <div><Label className="text-[10px]">X</Label><Input className="h-6 text-xs" type="number" value={el.attrs.x as number || 0} onChange={(e) => updateAttr('x', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">Y</Label><Input className="h-6 text-xs" type="number" value={el.attrs.y as number || 0} onChange={(e) => updateAttr('y', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">W</Label><Input className="h-6 text-xs" type="number" value={el.attrs.width as number || 0} onChange={(e) => updateAttr('width', Math.max(1, parseFloat(e.target.value) || 1))} /></div>
            <div><Label className="text-[10px]">H</Label><Input className="h-6 text-xs" type="number" value={el.attrs.height as number || 0} onChange={(e) => updateAttr('height', Math.max(1, parseFloat(e.target.value) || 1))} /></div>
            <div><Label className="text-[10px]">Rx</Label><Input className="h-6 text-xs" type="number" value={(el.attrs.rx as number) || 0} onChange={(e) => updateAttr('rx', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">Ry</Label><Input className="h-6 text-xs" type="number" value={(el.attrs.ry as number) || 0} onChange={(e) => updateAttr('ry', parseFloat(e.target.value) || 0)} /></div>
          </div>
        )}
        {el.type === 'circle' && (
          <div className="grid grid-cols-2 gap-1.5">
            <div><Label className="text-[10px]">Cx</Label><Input className="h-6 text-xs" type="number" value={el.attrs.cx as number || 0} onChange={(e) => updateAttr('cx', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">Cy</Label><Input className="h-6 text-xs" type="number" value={el.attrs.cy as number || 0} onChange={(e) => updateAttr('cy', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">R</Label><Input className="h-6 text-xs" type="number" value={el.attrs.r as number || 0} onChange={(e) => updateAttr('r', Math.max(1, parseFloat(e.target.value) || 1))} /></div>
          </div>
        )}
        {el.type === 'ellipse' && (
          <div className="grid grid-cols-2 gap-1.5">
            <div><Label className="text-[10px]">Cx</Label><Input className="h-6 text-xs" type="number" value={el.attrs.cx as number || 0} onChange={(e) => updateAttr('cx', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">Cy</Label><Input className="h-6 text-xs" type="number" value={el.attrs.cy as number || 0} onChange={(e) => updateAttr('cy', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">Rx</Label><Input className="h-6 text-xs" type="number" value={el.attrs.rx as number || 0} onChange={(e) => updateAttr('rx', Math.max(1, parseFloat(e.target.value) || 1))} /></div>
            <div><Label className="text-[10px]">Ry</Label><Input className="h-6 text-xs" type="number" value={el.attrs.ry as number || 0} onChange={(e) => updateAttr('ry', Math.max(1, parseFloat(e.target.value) || 1))} /></div>
          </div>
        )}
        {(el.type === 'line') && (
          <div className="grid grid-cols-2 gap-1.5">
            <div><Label className="text-[10px]">X1</Label><Input className="h-6 text-xs" type="number" value={el.attrs.x1 as number || 0} onChange={(e) => updateAttr('x1', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">Y1</Label><Input className="h-6 text-xs" type="number" value={el.attrs.y1 as number || 0} onChange={(e) => updateAttr('y1', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">X2</Label><Input className="h-6 text-xs" type="number" value={el.attrs.x2 as number || 0} onChange={(e) => updateAttr('x2', parseFloat(e.target.value) || 0)} /></div>
            <div><Label className="text-[10px]">Y2</Label><Input className="h-6 text-xs" type="number" value={el.attrs.y2 as number || 0} onChange={(e) => updateAttr('y2', parseFloat(e.target.value) || 0)} /></div>
          </div>
        )}
        {el.type === 'text' && (
          <div className="space-y-1.5">
            <div><Label className="text-[10px]">Text</Label><Input className="h-6 text-xs" value={el.name} onChange={(e) => updateAttr('name', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-1.5">
              <div><Label className="text-[10px]">X</Label><Input className="h-6 text-xs" type="number" value={el.attrs.x as number || 0} onChange={(e) => updateAttr('x', parseFloat(e.target.value) || 0)} /></div>
              <div><Label className="text-[10px]">Y</Label><Input className="h-6 text-xs" type="number" value={el.attrs.y as number || 0} onChange={(e) => updateAttr('y', parseFloat(e.target.value) || 0)} /></div>
              <div><Label className="text-[10px]">Size</Label><Input className="h-6 text-xs" type="number" value={el.attrs.fontSize as number || 16} onChange={(e) => updateAttr('fontSize', Math.max(4, parseFloat(e.target.value) || 16))} /></div>
            </div>
          </div>
        )}
        {el.type === 'path' && (
          <div>
            <Label className="text-[10px]">Path data (d)</Label>
            <textarea
              className="w-full h-20 text-[10px] font-mono bg-muted rounded p-1 resize-none"
              value={(el.attrs.d as string) || ''}
              onChange={(e) => updateAttr('d', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Transform */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Transform</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div><Label className="text-[10px]">X</Label><Input className="h-6 text-xs" type="number" value={Math.round(el.transform.tx)} onChange={(e) => onUpdateTransform(el.id, { ...el.transform, tx: parseFloat(e.target.value) || 0 })} /></div>
          <div><Label className="text-[10px]">Y</Label><Input className="h-6 text-xs" type="number" value={Math.round(el.transform.ty)} onChange={(e) => onUpdateTransform(el.id, { ...el.transform, ty: parseFloat(e.target.value) || 0 })} /></div>
          <div><Label className="text-[10px]">Rot</Label><Input className="h-6 text-xs" type="number" value={Math.round((el.transform.rot * 180) / Math.PI)} onChange={(e) => onUpdateTransform(el.id, { ...el.transform, rot: (parseFloat(e.target.value) || 0) * Math.PI / 180 })} /></div>
        </div>
      </div>

      {/* Fill */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Fill</p>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            className="w-7 h-7 rounded cursor-pointer border border-border"
            value={el.style.fill === 'none' ? '#000000' : el.style.fill}
            onChange={(e) => updateStyle('fill', e.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] px-1.5"
            onClick={() => updateStyle('fill', el.style.fill === 'none' ? '#000000' : 'none')}
          >
            {el.style.fill === 'none' ? 'Fill' : 'None'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              className={cn('w-5 h-5 rounded border border-border cursor-pointer hover:scale-110 transition-transform', el.style.fill === c && 'ring-2 ring-primary ring-offset-1')}
              style={{ backgroundColor: c }}
              onClick={() => updateStyle('fill', c)}
            />
          ))}
        </div>
        <div>
          <Label className="text-[10px]">Opacity</Label>
          <Slider
            value={[el.style.fillOpacity]}
            min={0} max={1} step={0.05}
            onValueChange={([v]) => updateStyle('fillOpacity', v)}
            className="mt-1"
          />
        </div>
        {gradients.length > 0 && (
          <div>
            <Label className="text-[10px]">Gradient</Label>
            <Select
              value={el.gradientId || ''}
              onValueChange={(v) => onUpdateElement(el.id, {}, { fill: v ? `url(#${v})` : el.style.fill }, v ? { gradientId: v } : { gradientId: undefined })}
            >
              <SelectTrigger className="h-6 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {gradients.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Stroke */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Stroke</p>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            className="w-7 h-7 rounded cursor-pointer border border-border"
            value={el.style.stroke === 'none' ? '#000000' : el.style.stroke}
            onChange={(e) => updateStyle('stroke', e.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] px-1.5"
            onClick={() => updateStyle('stroke', el.style.stroke === 'none' ? '#000000' : 'none')}
          >
            {el.style.stroke === 'none' ? 'Stroke' : 'None'}
          </Button>
        </div>
        <div>
          <Label className="text-[10px]">Width</Label>
          <div className="flex gap-1 mt-1">
            {STROKE_WIDTHS.slice(0, 6).map((w) => (
              <button
                key={w}
                className={cn('h-6 w-6 text-[10px] rounded border border-border hover:bg-accent', el.style.strokeWidth === w && 'bg-accent text-accent-foreground')}
                onClick={() => updateStyle('strokeWidth', w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Opacity</Label>
          <Slider
            value={[el.style.strokeOpacity]}
            min={0} max={1} step={0.05}
            onValueChange={([v]) => updateStyle('strokeOpacity', v)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Filters */}
      {filters.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Filter</p>
          <Select
            value={el.filterId || ''}
            onValueChange={(v) => onUpdateElement(el.id, { filterId: v || undefined } as any)}
          >
            <SelectTrigger className="h-6 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {filters.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.id} ({f.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Overall opacity */}
      <div>
        <Label className="text-[10px]">Opacity</Label>
        <Slider
          value={[el.style.opacity]}
          min={0} max={1} step={0.05}
          onValueChange={([v]) => updateStyle('opacity', v)}
          className="mt-1"
        />
      </div>
    </div>
  )
}

function GradientsContent({
  gradients, onAddGradient, onUpdateGradient, onDeleteGradient,
}: {
  gradients: SvgGradient[]
  onAddGradient: PropertyPanelProps['onAddGradient']
  onUpdateGradient: PropertyPanelProps['onUpdateGradient']
  onDeleteGradient: PropertyPanelProps['onDeleteGradient']
}) {
  const addGradient = (type: GradientType) => {
    onAddGradient({
      id: generateId('grad'),
      type,
      x1: 0, y1: 0, x2: 1, y2: 0,
      cx: 0.5, cy: 0.5, r: 0.5,
      stops: [
        { offset: 0, color: '#ff0000', opacity: 1 },
        { offset: 1, color: '#0000ff', opacity: 1 },
      ],
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => addGradient('linear')}>
          + Linear
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => addGradient('radial')}>
          + Radial
        </Button>
      </div>
      {gradients.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center py-4">No gradients yet</p>
      )}
      {gradients.map((g) => (
        <div key={g.id} className="rounded border border-border p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium">{g.id}</span>
            <button onClick={() => onDeleteGradient(g.id)}><Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" /></button>
          </div>
          <div className="flex gap-1">
            <button className={cn('text-[10px] px-2 py-0.5 rounded', g.type === 'linear' ? 'bg-accent' : 'hover:bg-accent/50')} onClick={() => onUpdateGradient(g.id, { type: 'linear' })}>Linear</button>
            <button className={cn('text-[10px] px-2 py-0.5 rounded', g.type === 'radial' ? 'bg-accent' : 'hover:bg-accent/50')} onClick={() => onUpdateGradient(g.id, { type: 'radial' })}>Radial</button>
          </div>
          {/* Gradient preview bar */}
          <div
            className="h-4 rounded border border-border"
            style={{
              background: `linear-gradient(to right, ${g.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`,
            }}
          />
          {/* Stops */}
          {g.stops.map((stop, si) => (
            <div key={si} className="flex items-center gap-1">
              <input type="color" className="w-5 h-5 rounded cursor-pointer" value={stop.color} onChange={(e) => {
                const stops = [...g.stops]
                stops[si] = { ...stops[si], color: e.target.value }
                onUpdateGradient(g.id, { stops })
              }} />
              <Input className="h-5 w-14 text-[10px]" type="number" min={0} max={100} value={Math.round(stop.offset * 100)} onChange={(e) => {
                const stops = [...g.stops]
                stops[si] = { ...stops[si], offset: Math.max(0, Math.min(1, parseFloat(e.target.value) / 100)) }
                onUpdateGradient(g.id, { stops })
              }} />
              <button onClick={() => {
                if (g.stops.length > 2) {
                  const stops = g.stops.filter((_, i) => i !== si)
                  onUpdateGradient(g.id, { stops })
                }
              }}><Trash2 className="w-3 h-3 text-muted-foreground" /></button>
            </div>
          ))}
          {g.type === 'linear' && (
            <div>
              <Label className="text-[10px]">Angle</Label>
              <Input className="h-5 text-[10px]" type="number" min={0} max={360} value={Math.round(Math.atan2(g.y2 - g.y1, g.x2 - g.x1) * 180 / Math.PI)} onChange={(e) => {
                const angle = (parseFloat(e.target.value) || 0) * Math.PI / 180
                onUpdateGradient(g.id, { x1: 0, y1: 0, x2: Math.cos(angle), y2: Math.sin(angle) })
              }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function FiltersContent({
  filters, onAddFilter, onUpdateFilter, onDeleteFilter,
}: {
  filters: SvgFilter[]
  onAddFilter: PropertyPanelProps['onAddFilter']
  onUpdateFilter: PropertyPanelProps['onUpdateFilter']
  onDeleteFilter: PropertyPanelProps['onDeleteFilter']
}) {
  const addFilter = (type: SvgFilter['type']) => {
    const base: SvgFilter = {
      id: generateId('filter'),
      type,
      params: {},
      color: '#000000',
    }
    if (type === 'drop-shadow') base.params = { dx: 2, dy: 2, blurRadius: 4, strength: 1 }
    else if (type === 'blur') base.params = { stdDeviation: 4 }
    else if (type === 'glow') base.params = { blurRadius: 4, strength: 1 }
    else if (type === 'color-matrix') base.matrix = COLOR_MATRIX_PRESETS.grayscale
    onAddFilter(base)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {(['drop-shadow', 'blur', 'glow', 'color-matrix'] as const).map((type) => (
          <Button key={type} variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={() => addFilter(type)}>
            + {type.replace('-', ' ')}
          </Button>
        ))}
      </div>
      {filters.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center py-4">No filters yet</p>
      )}
      {filters.map((f) => (
        <div key={f.id} className="rounded border border-border p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium">{f.id}</span>
            <button onClick={() => onDeleteFilter(f.id)}><Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" /></button>
          </div>
          {f.type === 'drop-shadow' && (
            <div className="grid grid-cols-2 gap-1">
              <div><Label className="text-[10px]">Dx</Label><Input className="h-5 text-[10px]" type="number" value={f.params.dx || 0} onChange={(e) => onUpdateFilter(f.id, { params: { ...f.params, dx: parseFloat(e.target.value) || 0 } })} /></div>
              <div><Label className="text-[10px]">Dy</Label><Input className="h-5 text-[10px]" type="number" value={f.params.dy || 0} onChange={(e) => onUpdateFilter(f.id, { params: { ...f.params, dy: parseFloat(e.target.value) || 0 } })} /></div>
              <div><Label className="text-[10px]">Blur</Label><Input className="h-5 text-[10px]" type="number" value={f.params.blurRadius || 0} onChange={(e) => onUpdateFilter(f.id, { params: { ...f.params, blurRadius: parseFloat(e.target.value) || 0 } })} /></div>
              <div><Label className="text-[10px]">Strength</Label><Input className="h-5 text-[10px]" type="number" min={0} max={1} step={0.1} value={f.params.strength || 1} onChange={(e) => onUpdateFilter(f.id, { params: { ...f.params, strength: parseFloat(e.target.value) || 0 } })} /></div>
              <div className="col-span-2"><Label className="text-[10px]">Color</Label><input type="color" className="w-full h-5 rounded cursor-pointer" value={f.color || '#000'} onChange={(e) => onUpdateFilter(f.id, { color: e.target.value })} /></div>
            </div>
          )}
          {f.type === 'blur' && (
            <div><Label className="text-[10px]">Radius</Label><Input className="h-5 text-[10px]" type="number" value={f.params.stdDeviation || 0} onChange={(e) => onUpdateFilter(f.id, { params: { ...f.params, stdDeviation: parseFloat(e.target.value) || 0 } })} /></div>
          )}
          {f.type === 'glow' && (
            <div className="grid grid-cols-2 gap-1">
              <div><Label className="text-[10px]">Blur</Label><Input className="h-5 text-[10px]" type="number" value={f.params.blurRadius || 0} onChange={(e) => onUpdateFilter(f.id, { params: { ...f.params, blurRadius: parseFloat(e.target.value) || 0 } })} /></div>
              <div><Label className="text-[10px]">Strength</Label><Input className="h-5 text-[10px]" type="number" min={0} max={1} step={0.1} value={f.params.strength || 1} onChange={(e) => onUpdateFilter(f.id, { params: { ...f.params, strength: parseFloat(e.target.value) || 0 } })} /></div>
              <div className="col-span-2"><Label className="text-[10px]">Color</Label><input type="color" className="w-full h-5 rounded cursor-pointer" value={f.color || '#fff'} onChange={(e) => onUpdateFilter(f.id, { color: e.target.value })} /></div>
            </div>
          )}
          {f.type === 'color-matrix' && (
            <div>
              <div className="flex flex-wrap gap-1 mb-1">
                {Object.keys(COLOR_MATRIX_PRESETS).map((name) => (
                  <button key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent" onClick={() => onUpdateFilter(f.id, { matrix: COLOR_MATRIX_PRESETS[name] })}>
                    {name}
                  </button>
                ))}
              </div>
              {f.matrix && (
                <textarea
                  className="w-full h-14 text-[10px] font-mono bg-muted rounded p-1 resize-none"
                  value={f.matrix.join(' ')}
                  onChange={(e) => {
                    const nums = e.target.value.split(/\s+/).map(Number).filter((n) => !isNaN(n))
                    if (nums.length === 20) onUpdateFilter(f.id, { matrix: nums })
                  }}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PatternsContent({
  patterns, onAddPattern, onUpdatePattern, onDeletePattern,
}: {
  patterns: SvgPattern[]
  onAddPattern: PropertyPanelProps['onAddPattern']
  onUpdatePattern: PropertyPanelProps['onUpdatePattern']
  onDeletePattern: PropertyPanelProps['onDeletePattern']
}) {
  const addPattern = (type: SvgPattern['type']) => {
    onAddPattern({
      id: generateId('pat'),
      type,
      width: 10,
      height: 10,
      fillColor: '#000000',
      bgColor: '#ffffff',
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {(['dots', 'stripes', 'crosshatch', 'checkerboard'] as const).map((type) => (
          <Button key={type} variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={() => addPattern(type)}>
            + {type}
          </Button>
        ))}
      </div>
      {patterns.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center py-4">No patterns yet</p>
      )}
      {patterns.map((p) => (
        <div key={p.id} className="rounded border border-border p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium">{p.id} ({p.type})</span>
            <button onClick={() => onDeletePattern(p.id)}><Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" /></button>
          </div>
          {/* Pattern preview */}
          <div
            className="h-8 rounded border border-border"
            style={{
              background: p.type === 'dots'
                ? `radial-gradient(circle, ${p.fillColor} 2px, ${p.bgColor} 2px)`
                : p.type === 'checkerboard'
                  ? `repeating-conic-gradient(${p.fillColor} 0% 25%, ${p.bgColor} 0% 50%) 0 0 / ${p.width}px ${p.height}px`
                  : p.bgColor,
              backgroundSize: `${p.width}px ${p.height}px`,
            }}
          />
          <div className="grid grid-cols-2 gap-1">
            <div><Label className="text-[10px]">Fill</Label><input type="color" className="w-full h-5 rounded cursor-pointer" value={p.fillColor} onChange={(e) => onUpdatePattern(p.id, { fillColor: e.target.value })} /></div>
            <div><Label className="text-[10px]">Bg</Label><input type="color" className="w-full h-5 rounded cursor-pointer" value={p.bgColor} onChange={(e) => onUpdatePattern(p.id, { bgColor: e.target.value })} /></div>
            <div><Label className="text-[10px]">W</Label><Input className="h-5 text-[10px]" type="number" min={2} value={p.width} onChange={(e) => onUpdatePattern(p.id, { width: Math.max(2, parseFloat(e.target.value) || 2) })} /></div>
            <div><Label className="text-[10px]">H</Label><Input className="h-5 text-[10px]" type="number" min={2} value={p.height} onChange={(e) => onUpdatePattern(p.id, { height: Math.max(2, parseFloat(e.target.value) || 2) })} /></div>
          </div>
        </div>
      ))}
    </div>
  )
}
