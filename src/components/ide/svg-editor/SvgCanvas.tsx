import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import type { SvgElement, SvgDocument, ToolMode, GuideLine, BBox, SvgTransform } from './types'
import { getElementBBox, getSelectionBBox, getElementAtPoint } from './svgUtils'
import { parsePathD, segmentsToPathD, getSegmentControlPoints, getSegmentAnchors, updateSegmentPoint } from './pathUtils'
import { cn } from '@/lib/utils'

interface SvgCanvasProps {
  doc: SvgDocument
  selectedIds: Set<string>
  toolMode: ToolMode
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  guideLines: GuideLine[]
  editingTextId: string | null
  onSelect: (ids: Set<string>, toggle?: boolean) => void
  onMoveElements: (ids: string[], dx: number, dy: number) => void
  onResizeElement: (id: string, attrs: Record<string, number>) => void
  onUpdateTransform: (id: string, transform: SvgTransform) => void
  onStartDraw: (x: number, y: number) => void
  onDrawMove: (x: number, y: number) => void
  onEndDraw: (x: number, y: number) => void
  onAddPathPoint: (x: number, y: number) => void
  onTextPlace: (x: number, y: number) => void
  onFreehandStart: (x: number, y: number) => void
  onFreehandMove: (x: number, y: number) => void
  onFreehandEnd: (x: number, y: number) => void
  onUpdateElement: (id: string, attrs: Record<string, string | number>) => void
  onUpdatePathPoint: (id: string, segIndex: number, pointIndex: number, x: number, y: number) => void
  onSetEditingText: (id: string | null) => void
  drawStart: { x: number; y: number } | null
  drawCurrent: { x: number; y: number } | null
  pathPoints: { x: number; y: number }[]
}

type HandleType = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'rotate'

export function SvgCanvas({
  doc, selectedIds, toolMode, zoom, panX, panY,
  showGrid, snapToGrid, gridSize, guideLines,
  editingTextId,
  onSelect, onMoveElements, onResizeElement, onUpdateTransform,
  onStartDraw, onDrawMove, onEndDraw,
  onAddPathPoint, onTextPlace,
  onFreehandStart, onFreehandMove, onFreehandEnd,
  onUpdateElement, onUpdatePathPoint, onSetEditingText,
  drawStart, drawCurrent, pathPoints,
}: SvgCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [resizeHandle, setResizeHandle] = useState<HandleType | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; bbox: BBox } | null>(null)
  const [rubberBand, setRubberBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [dragGuides, setDragGuides] = useState<GuideLine[]>([])
  const [editingPathId, setEditingPathId] = useState<string | null>(null)
  const [draggingControl, setDraggingControl] = useState<{
    elId: string; segIndex: number; pointIndex: number
  } | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, y: svgPt.y }
  }, [])

  const snapPoint = useCallback((x: number, y: number) => {
    if (!snapToGrid) return { x, y }
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    }
  }, [snapToGrid, gridSize])

  const computeGuides = useCallback((mx: number, my: number, ids: Set<string>): GuideLine[] => {
    const guides: GuideLine[] = []
    const threshold = 8 / zoom

    const others = doc.elements.filter((e) => !ids.has(e.id) && e.visible)
    const selBBox = getSelectionBBox(doc.elements, ids)
    if (!selBBox) return guides

    const selEdges = {
      left: selBBox.x,
      right: selBBox.x + selBBox.width,
      top: selBBox.y,
      bottom: selBBox.y + selBBox.height,
      centerX: selBBox.x + selBBox.width / 2,
      centerY: selBBox.y + selBBox.height / 2,
    }

    for (const other of others) {
      const ob = getElementBBox(other)
      const oEdges = {
        left: ob.x,
        right: ob.x + ob.width,
        top: ob.y,
        bottom: ob.y + ob.height,
        centerX: ob.x + ob.width / 2,
        centerY: ob.y + ob.height / 2,
      }

      if (Math.abs(selEdges.left - oEdges.left) < threshold) {
        guides.push({ axis: 'vertical', value: oEdges.left, label: '←', color: '#ff4444' })
      }
      if (Math.abs(selEdges.right - oEdges.right) < threshold) {
        guides.push({ axis: 'vertical', value: oEdges.right, label: '→', color: '#ff4444' })
      }
      if (Math.abs(selEdges.centerX - oEdges.centerX) < threshold) {
        guides.push({ axis: 'vertical', value: oEdges.centerX, label: '↕', color: '#44aaff' })
      }
      if (Math.abs(selEdges.top - oEdges.top) < threshold) {
        guides.push({ axis: 'horizontal', value: oEdges.top, label: '↑', color: '#ff4444' })
      }
      if (Math.abs(selEdges.bottom - oEdges.bottom) < threshold) {
        guides.push({ axis: 'horizontal', value: oEdges.bottom, label: '↓', color: '#ff4444' })
      }
      if (Math.abs(selEdges.centerY - oEdges.centerY) < threshold) {
        guides.push({ axis: 'horizontal', value: oEdges.centerY, label: '↔', color: '#44aaff' })
      }
    }

    return guides
  }, [doc.elements, zoom])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const pt = getSvgPoint(e.clientX, e.clientY)
    const snapped = snapPoint(pt.x, pt.y)

    if (toolMode === 'select') {
      const hitEl = getElementAtPoint(doc.elements, pt.x, pt.y)
      if (hitEl) {
        if (selectedIds.has(hitEl.id)) {
          setDragStart(snapped)
          setDragOffset({ x: snapped.x, y: snapped.y })
          setDragging(true)
        } else {
          onSelect(new Set([hitEl.id]), e.shiftKey)
          setDragStart(snapped)
          setDragOffset({ x: snapped.x, y: snapped.y })
          setDragging(true)
        }
      } else {
        if (!e.shiftKey) onSelect(new Set())
        setRubberBand({ x: pt.x, y: pt.y, w: 0, h: 0 })
      }
    } else if (toolMode === 'path') {
      onAddPathPoint(snapped.x, snapped.y)
    } else if (toolMode === 'text') {
      onTextPlace(snapped.x, snapped.y)
    } else if (toolMode === 'freehand') {
      onFreehandStart(snapped.x, snapped.y)
    } else {
      onStartDraw(snapped.x, snapped.y)
    }
  }, [toolMode, getSvgPoint, snapPoint, doc.elements, selectedIds, onSelect, onAddPathPoint, onTextPlace, onFreehandStart, onStartDraw])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const pt = getSvgPoint(e.clientX, e.clientY)
    const snapped = snapPoint(pt.x, pt.y)

    if (toolMode === 'select' && dragging && dragStart && selectedIds.size > 0) {
      const dx = snapped.x - dragStart.x
      const dy = snapped.y - dragStart.y
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        onMoveElements(Array.from(selectedIds), dx, dy)
        setDragStart(snapped)
        const guides = computeGuides(pt.x, pt.y, selectedIds)
        setDragGuides(guides)
      }
    } else if (rubberBand) {
      setRubberBand({ ...rubberBand, w: pt.x - rubberBand.x, h: pt.y - rubberBand.y })
    } else if (toolMode === 'freehand' && dragStart) {
      onFreehandMove(snapped.x, snapped.y)
    } else if (drawStart && (toolMode !== 'select' && toolMode !== 'freehand' && toolMode !== 'text' && toolMode !== 'path')) {
      onDrawMove(snapped.x, snapped.y)
    } else if (resizeHandle && resizeStart) {
      handleResize(snapped)
    } else if (draggingControl) {
      onUpdatePathPoint(draggingControl.elId, draggingControl.segIndex, draggingControl.pointIndex, snapped.x, snapped.y)
    } else if (toolMode === 'select') {
      const hit = getElementAtPoint(doc.elements, pt.x, pt.y)
      setHoveredId(hit?.id || null)
    }
  }, [toolMode, dragging, dragStart, selectedIds, getSvgPoint, snapPoint, rubberBand, drawStart, resizeHandle, resizeStart, draggingControl, computeGuides, onMoveElements, onFreehandMove, onDrawMove, onUpdatePathPoint, doc.elements])

  function handleResize(pt: { x: number; y: number }) {
    if (!resizeStart) return
    const { bbox } = resizeStart
    if (!resizeHandle) return

    const handle = resizeHandle
    let dx = 0, dy = 0, dw = 0, dh = 0
    const mx = pt.x
    const my = pt.y

    if (handle.includes('left')) { dx = mx - bbox.x; dw = -dx }
    if (handle.includes('right')) { dw = mx - (bbox.x + bbox.width) }
    if (handle.includes('top')) { dy = my - bbox.y; dh = -dy }
    if (handle.includes('bottom')) { dh = my - (bbox.y + bbox.height) }
    if (handle === 'middle-left') { dx = mx - bbox.x; dw = -dx }
    if (handle === 'middle-right') { dw = mx - (bbox.x + bbox.width) }

    for (const id of selectedIds) {
      const el = doc.elements.find((e) => e.id === id)
      if (!el) continue
      if (el.type === 'rect') {
        const newX = (el.attrs.x as number || 0) + (handle.includes('left') ? dx : (handle === 'top-left' ? dx : 0))
        const newY = (el.attrs.y as number || 0) + (handle.includes('top') ? dy : 0)
        const newW = Math.max(5, (el.attrs.width as number || 0) + (handle.includes('left') ? -dx : (handle.includes('right') ? dw : 0)))
        const newH = Math.max(5, (el.attrs.height as number || 0) + (handle.includes('top') ? -dy : (handle.includes('bottom') ? dh : 0)))
        onResizeElement(id, { x: newX, y: newY, width: newW, height: newH })
      } else if (el.type === 'circle') {
        const newR = Math.max(5, (el.attrs.r as number || 0) + (dw / 2))
        onResizeElement(id, { r: newR })
      } else if (el.type === 'ellipse') {
        const newRx = Math.max(5, (el.attrs.rx as number || 0) + (handle.includes('left') || handle.includes('right') ? dw / 2 : 0))
        const newRy = Math.max(5, (el.attrs.ry as number || 0) + (handle.includes('top') || handle.includes('bottom') ? dh / 2 : 0))
        onResizeElement(id, { rx: newRx, ry: newRy })
      }
    }
  }

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const pt = getSvgPoint(e.clientX, e.clientY)
    const snapped = snapPoint(pt.x, pt.y)

    if (rubberBand) {
      const rb = rubberBand
      const rx = rb.w > 0 ? rb.x : rb.x + rb.w
      const ry = rb.h > 0 ? rb.y : rb.y + rb.h
      const rw = Math.abs(rb.w)
      const rh = Math.abs(rb.h)
      if (rw > 3 || rh > 3) {
        const hitIds = new Set<string>()
        for (const el of doc.elements) {
          if (!el.visible || el.locked) continue
          const bbox = getElementBBox(el)
          if (bbox.x + bbox.width >= rx && bbox.x <= rx + rw &&
              bbox.y + bbox.height >= ry && bbox.y <= ry + rh) {
            hitIds.add(el.id)
          }
        }
        onSelect(hitIds)
      }
      setRubberBand(null)
    } else if (toolMode === 'freehand') {
      onFreehandEnd(snapped.x, snapped.y)
    } else if (drawStart && (toolMode !== 'select' && toolMode !== 'freehand' && toolMode !== 'text' && toolMode !== 'path')) {
      onEndDraw(snapped.x, snapped.y)
    }

    setDragging(false)
    setDragStart(null)
    setDragOffset(null)
    setResizeHandle(null)
    setResizeStart(null)
    setDragGuides([])
    setDraggingControl(null)
  }, [rubberBand, toolMode, drawStart, getSvgPoint, snapPoint, doc.elements, onSelect, onFreehandEnd, onEndDraw])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const pt = getSvgPoint(e.clientX, e.clientY)
    const hit = getElementAtPoint(doc.elements, pt.x, pt.y)
    if (hit?.type === 'text' && hit.editable) {
      onSetEditingText(hit.id)
    }
  }, [getSvgPoint, doc.elements, onSetEditingText])

  const handleResizeHandleMouseDown = useCallback((handle: HandleType, e: React.MouseEvent) => {
    e.stopPropagation()
    const selBBox = getSelectionBBox(doc.elements, selectedIds)
    if (!selBBox) return
    setResizeHandle(handle)
    setResizeStart({ x: e.clientX, y: e.clientY, bbox: selBBox })
  }, [doc.elements, selectedIds])

  const handleControlPointMouseDown = useCallback((elId: string, segIndex: number, pointIndex: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setDraggingControl({ elId, segIndex, pointIndex })
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && toolMode === 'select' && selectedIds.size > 0) {
      const remaining = doc.elements.filter((el) => !selectedIds.has(el.id))
      onUpdateElement('__delete__', { __deleteIds: Array.from(selectedIds) })
    }
    if (e.key === 'Escape') {
      setEditingPathId(null)
      onSetEditingText(null)
    }
  }, [selectedIds, toolMode, doc.elements, onUpdateElement, onSetEditingText])

  const selectionBBox = useMemo(() => getSelectionBBox(doc.elements, selectedIds), [doc.elements, selectedIds])

  const allGuides = useMemo(() => {
    const result = [...guideLines, ...dragGuides]
    const seen = new Set<string>()
    return result.filter((g) => {
      const key = `${g.axis}-${g.value}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [guideLines, dragGuides])

  const renderTransformHandles = () => {
    if (!selectionBBox || selectedIds.size === 0) return null

    const { x, y, width, height } = selectionBBox
    const hs = 6
    const handles: Array<{ type: HandleType; cx: number; cy: number; cursor: string }> = [
      { type: 'top-left', cx: x, cy: y, cursor: 'nw-resize' },
      { type: 'top-center', cx: x + width / 2, cy: y, cursor: 'n-resize' },
      { type: 'top-right', cx: x + width, cy: y, cursor: 'ne-resize' },
      { type: 'middle-left', cx: x, cy: y + height / 2, cursor: 'w-resize' },
      { type: 'middle-right', cx: x + width, cy: y + height / 2, cursor: 'e-resize' },
      { type: 'bottom-left', cx: x, cy: y + height, cursor: 'sw-resize' },
      { type: 'bottom-center', cx: x + width / 2, cy: y + height, cursor: 's-resize' },
      { type: 'bottom-right', cx: x + width, cy: y + height, cursor: 'se-resize' },
      { type: 'rotate', cx: x + width / 2, cy: y - 20, cursor: 'grab' },
    ]

    return (
      <g className="transform-handles" pointerEvents="all">
        <rect
          x={x} y={y} width={width} height={height}
          fill="none" stroke="#0099ff" strokeWidth={1 / zoom}
          strokeDasharray={`${3 / zoom} ${2 / zoom}`}
          pointerEvents="none"
        />
        {handles.map((h) => (
          <rect
            key={h.type}
            x={(h.cx - hs) / zoom} y={(h.cy - hs) / zoom}
            width={hs * 2 / zoom} height={hs * 2 / zoom}
            fill="white" stroke="#0099ff" strokeWidth={1.5 / zoom}
            style={{ cursor: h.cursor }}
            onMouseDown={(e) => handleResizeHandleMouseDown(h.type, e)}
          />
        ))}
        {/* Rotate handle */}
        <line
          x1={x + width / 2} y1={y} x2={x + width / 2} y2={y - 20}
          stroke="#0099ff" strokeWidth={1 / zoom}
          pointerEvents="none"
        />
      </g>
    )
  }

  const renderPathEditing = () => {
    if (selectedIds.size !== 1) return null
    const id = Array.from(selectedIds)[0]
    const el = doc.elements.find((e) => e.id === id)
    if (!el || el.type !== 'path') return null

    const d = (el.attrs.d as string) || ''
    const segments = parsePathD(d)
    const anchors = getSegmentAnchors(segments)

    return (
      <g className="path-editing" pointerEvents="all">
        {segments.map((seg, si) => {
          const cp = getSegmentControlPoints(segments, si)
          if (!cp) return null
          const pts: Array<{ x: number; y: number; type: 'anchor' | 'cp' }> = []
          if (cp.cp1) pts.push({ ...cp.cp1, type: 'cp' })
          if (cp.cp2) pts.push({ ...cp.cp2, type: 'cp' })
          pts.push({ ...cp.anchor, type: 'anchor' })

          return pts.map((p, pi) => {
            const globalPi = segments.slice(0, si).reduce((acc, s) => acc + Math.ceil(s.points.length / 2), 0) + pi
            return (
              <circle
                key={`${si}-${pi}`}
                cx={p.x} cy={p.y}
                r={p.type === 'anchor' ? 4 / zoom : 3 / zoom}
                fill={p.type === 'anchor' ? '#0099ff' : 'white'}
                stroke="#0099ff"
                strokeWidth={1.5 / zoom}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  // Determine point index within segment
                  const pointIdx = pi // 0=cp1, 1=cp2, 2=anchor (for C)
                  handleControlPointMouseDown(el.id, si, pointIdx, e)
                }}
              />
            )
          })
        })}
      </g>
    )
  }

  const renderGrid = () => {
    if (!showGrid) return null
    const { width, height } = doc
    const lines: React.ReactNode[] = []
    const gs = gridSize
    for (let x = 0; x <= width; x += gs) {
      lines.push(
        <line key={`gv-${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#e0e0e0" strokeWidth={0.5 / zoom} opacity={0.5} />,
      )
    }
    for (let y = 0; y <= height; y += gs) {
      lines.push(
        <line key={`gh-${y}`} x1={0} y1={y} x2={width} y2={y} stroke="#e0e0e0" strokeWidth={0.5 / zoom} opacity={0.5} />,
      )
    }
    return <g className="grid-lines">{lines}</g>
  }

  const renderRubberBand = () => {
    if (!rubberBand) return null
    const rx = rubberBand.w > 0 ? rubberBand.x : rubberBand.x + rubberBand.w
    const ry = rubberBand.h > 0 ? rubberBand.y : rubberBand.y + rubberBand.h
    const rw = Math.abs(rubberBand.w)
    const rh = Math.abs(rubberBand.h)
    return (
      <rect
        x={rx} y={ry} width={rw} height={rh}
        fill="rgba(0, 153, 255, 0.1)"
        stroke="#0099ff"
        strokeWidth={1 / zoom}
        strokeDasharray={`${4 / zoom} ${3 / zoom}`}
      />
    )
  }

  const renderDrawPreview = () => {
    if (!drawStart || !drawCurrent || toolMode === 'select' || toolMode === 'text' || toolMode === 'path' || toolMode === 'freehand') return null
    const sx = drawStart.x
    const sy = drawStart.y
    const ex = drawCurrent.x
    const ey = drawCurrent.y

    let node: React.ReactNode = null
    switch (toolMode) {
      case 'rect':
        node = <rect x={Math.min(sx, ex)} y={Math.min(sy, ey)} width={Math.abs(ex - sx)} height={Math.abs(ey - sy)} fill="rgba(0,153,255,0.15)" stroke="#0099ff" strokeWidth={1 / zoom} />
        break
      case 'circle': {
        const r = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
        node = <circle cx={sx} cy={sy} r={r} fill="rgba(0,153,255,0.15)" stroke="#0099ff" strokeWidth={1 / zoom} />
        break
      }
      case 'ellipse':
        node = <ellipse cx={(sx + ex) / 2} cy={(sy + ey) / 2} rx={Math.abs(ex - sx) / 2} ry={Math.abs(ey - sy) / 2} fill="rgba(0,153,255,0.15)" stroke="#0099ff" strokeWidth={1 / zoom} />
        break
      case 'line':
        node = <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#0099ff" strokeWidth={2 / zoom} />
        break
    }
    return node
  }

  const renderPathPreview = () => {
    if (toolMode !== 'path' || pathPoints.length === 0) return null
    const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
    return (
      <g>
        <path d={d} fill="none" stroke="#0099ff" strokeWidth={2 / zoom} strokeLinejoin="round" />
        {pathPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3 / zoom} fill={i === 0 ? '#0099ff' : 'white'} stroke="#0099ff" strokeWidth={1.5 / zoom} />
        ))}
      </g>
    )
  }

  const renderGuideLines = () => {
    return allGuides.map((g, i) => (
      g.axis === 'vertical' ? (
        <line key={i} x1={g.value} y1={0} x2={g.value} y2={doc.height} stroke={g.color || '#ff4444'} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} opacity={0.8} />
      ) : (
        <line key={i} x1={0} y1={g.value} x2={doc.width} y2={g.value} stroke={g.color || '#ff4444'} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} opacity={0.8} />
      )
    ))
  }

  const renderElement = (el: SvgElement) => {
    const isSelected = selectedIds.has(el.id)
    const isHovered = hoveredId === el.id
    const fillColor = el.gradientId ? `url(#${el.gradientId})` : el.patternId ? `url(#${el.patternId})` : el.style.fill
    const filterId = el.filterId ? `url(#${el.filterId})` : undefined

    const commonProps = {
      fill: fillColor,
      'fill-opacity': el.style.fillOpacity,
      stroke: el.style.stroke === 'none' ? undefined : el.style.stroke,
      'stroke-width': el.style.strokeWidth,
      'stroke-opacity': el.style.strokeOpacity,
      opacity: el.style.opacity,
      filter: filterId,
      transform: buildTransformAttr(el.transform),
      onPointerDown: (e: React.PointerEvent) => {
        e.stopPropagation()
        if (toolMode === 'select') {
          if (e.shiftKey) {
            const next = new Set(selectedIds)
            if (next.has(el.id)) next.delete(el.id)
            else next.add(el.id)
            onSelect(next)
          } else {
            onSelect(new Set([el.id]))
          }
        }
      },
      onMouseEnter: () => toolMode === 'select' && setHoveredId(el.id),
      onMouseLeave: () => setHoveredId(null),
      className: cn(
        'transition-opacity cursor-pointer',
        isHovered && !isSelected && 'opacity-80',
      ) || undefined,
    }

    const renderShape = () => {
      switch (el.type) {
        case 'rect':
          return <rect key={el.id} x={el.attrs.x} y={el.attrs.y} width={el.attrs.width} height={el.attrs.height} rx={el.attrs.rx || 0} ry={el.attrs.ry || 0} {...commonProps} />
        case 'circle':
          return <circle key={el.id} cx={el.attrs.cx} cy={el.attrs.cy} r={el.attrs.r} {...commonProps} />
        case 'ellipse':
          return <ellipse key={el.id} cx={el.attrs.cx} cy={el.attrs.cy} rx={el.attrs.rx} ry={el.attrs.ry} {...commonProps} />
        case 'line':
          return <line key={el.id} x1={el.attrs.x1} y1={el.attrs.y1} x2={el.attrs.x2} y2={el.attrs.y2} {...commonProps} />
        case 'path':
          return <path key={el.id} d={el.attrs.d} {...commonProps} />
        case 'text':
          return (
            <text key={el.id} x={el.attrs.x} y={el.attrs.y} fontSize={el.attrs.fontSize || 16} fontFamily={el.attrs.fontFamily || 'sans-serif'} textAnchor={el.attrs.textAnchor || 'start'} {...commonProps}>
              {editingTextId === el.id ? (
                <tspan>{el.name}</tspan>
              ) : el.name}
            </text>
          )
        case 'image':
          return <image key={el.id} x={el.attrs.x} y={el.attrs.y} width={el.attrs.width} height={el.attrs.height} href={el.attrs.href as string} preserveAspectRatio={(el.attrs.preserveAspectRatio as string) || 'xMidYMid meet'} {...commonProps} />
        case 'group':
          return (
            <g key={el.id} {...commonProps}>
              {el.children.map((cid) => {
                const child = doc.elements.find((e) => e.id === cid)
                return child ? renderElement(child) : null
              })}
            </g>
          )
        default:
          return null
      }
    }

    return !el.visible ? null : renderShape()
  }

  return (
    <div
      className="flex-1 overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <svg
        ref={svgRef}
        viewBox={doc.viewBox}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: toolMode === 'select' ? 'default' : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Defs for gradients, patterns, filters */}
        <defs>
          {doc.gradients.map((g) => {
            const stops = g.stops.map((s) => (
              <stop key={`${s.offset}-${s.color}`} offset={`${s.offset * 100}%`} stopColor={s.color} stopOpacity={s.opacity} />
            ))
            if (g.type === 'linear') {
              return <linearGradient key={g.id} id={g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>{stops}</linearGradient>
            }
            return <radialGradient key={g.id} id={g.id} cx={g.cx} cy={g.cy} r={g.r}>{stops}</radialGradient>
          })}
          {doc.patterns.map((p) => (
            <pattern key={p.id} id={p.id} width={p.width} height={p.height} patternUnits="userSpaceOnUse">
              {p.type === 'dots' && (
                <>
                  <rect width={p.width} height={p.height} fill={p.bgColor} />
                  <circle cx={p.width / 2} cy={p.height / 2} r={Math.min(p.width, p.height) / 4} fill={p.fillColor} />
                </>
              )}
              {p.type === 'checkerboard' && (
                <>
                  <rect width={p.width} height={p.height} fill={p.bgColor} />
                  <rect width={p.width / 2} height={p.height / 2} fill={p.fillColor} />
                  <rect x={p.width / 2} y={p.height / 2} width={p.width / 2} height={p.height / 2} fill={p.fillColor} />
                </>
              )}
            </pattern>
          ))}
          {doc.filters.map((f) => {
            if (f.type === 'drop-shadow') {
              return (
                <filter key={f.id} id={f.id}>
                  <feDropShadow dx={f.params.dx || 2} dy={f.params.dy || 2} stdDeviation={f.params.blurRadius || 4} floodColor={f.color || '#000'} floodOpacity={f.params.strength || 1} />
                </filter>
              )
            }
            if (f.type === 'blur') {
              return (
                <filter key={f.id} id={f.id}>
                  <feGaussianBlur stdDeviation={f.params.stdDeviation || 4} />
                </filter>
              )
            }
            if (f.type === 'glow') {
              return (
                <filter key={f.id} id={f.id}>
                  <feGaussianBlur stdDeviation={f.params.blurRadius || 4} result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              )
            }
            if (f.type === 'color-matrix' && f.matrix) {
              return (
                <filter key={f.id} id={f.id}>
                  <feColorMatrix type="matrix" values={f.matrix.join(' ')} />
                </filter>
              )
            }
            return null
          })}
        </defs>

        {/* Canvas background */}
        <rect width={doc.width} height={doc.height} fill="white" />

        {/* Grid */}
        {renderGrid()}

        {/* Elements */}
        {doc.elements.filter((e) => e.visible && e.type !== 'group').map((el) => renderElement(el))}

        {/* Groups rendered after individual elements for correct z-order */}
        {doc.elements.filter((e) => e.visible && e.type === 'group').map((el) => renderElement(el))}

        {/* Draw preview */}
        {renderDrawPreview()}

        {/* Path preview */}
        {renderPathPreview()}

        {/* Rubber band selection */}
        {renderRubberBand()}

        {/* Transform handles */}
        {renderTransformHandles()}

        {/* Path editing handles */}
        {renderPathEditing()}

        {/* Smart guide lines */}
        {renderGuideLines()}
      </svg>

      {/* Text editing overlay */}
      {editingTextId && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <input
            ref={textInputRef}
            className="pointer-events-auto bg-transparent border-b border-primary outline-none text-center text-sm font-sans"
            defaultValue={doc.elements.find((e) => e.id === editingTextId)?.name || ''}
            autoFocus
            onBlur={(e) => {
              const el = doc.elements.find((el) => el.id === editingTextId)
              if (el) {
                onUpdateElement(editingTextId, { name: e.target.value })
              }
              onSetEditingText(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur()
              }
            }}
          />
        </div>
      )}
    </div>
  )
}

function buildTransformAttr(tf: SvgTransform): string | undefined {
  const parts: string[] = []
  if (tf.tx !== 0 || tf.ty !== 0) parts.push(`translate(${tf.tx},${tf.ty})`)
  if (tf.sx !== 1 || tf.sy !== 1) parts.push(`scale(${tf.sx},${tf.sy})`)
  if (tf.rot !== 0) parts.push(`rotate(${(tf.rot * 180) / Math.PI})`)
  return parts.length > 0 ? parts.join(' ') : undefined
}
