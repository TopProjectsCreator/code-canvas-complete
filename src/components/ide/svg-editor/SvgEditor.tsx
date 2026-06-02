import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { FileNode } from '@/types/ide'
import { Toolbar } from './Toolbar'
import { SvgCanvas } from './SvgCanvas'
import { PropertyPanel } from './PropertyPanel'
import { LayerPanel } from './LayerPanel'
import { useHistory } from './useHistory'
import { parseSvgSource, serializeToSvg, getElementBBox, cloneElements, findElementById } from './svgUtils'
import { parsePathD, segmentsToPathD, updateSegmentPoint } from './pathUtils'
import { performBooleanOp } from './booleanOps'
import { alignElements, distributeElements } from './alignUtils'
import { generateId, DEFAULT_DOCUMENT, resetIdCounter } from './types'
import type {
  SvgDocument, SvgElement, SvgGradient, SvgFilter, SvgPattern,
  ToolMode, GuideLine, SvgTransform,
} from './types'
import { toast } from 'sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SvgEditorProps {
  file: FileNode
  onContentChange: (fileId: string, content: string) => void
}

export function SvgEditor({ file, onContentChange }: SvgEditorProps) {
  const [doc, setDoc] = useState<SvgDocument>(() => {
    resetIdCounter()
    if (file.content) {
      const parsed = parseSvgSource(file.content)
      if (parsed) return parsed
    }
    return { ...DEFAULT_DOCUMENT }
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const [sourceCode, setSourceCode] = useState('')
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)
  const [pathPoints, setPathPoints] = useState<{ x: number; y: number }[]>([])
  const [guideLines, setGuideLines] = useState<GuideLine[]>([])
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [freehandPoints, setFreehandPoints] = useState<{ x: number; y: number }[]>([])
  const dirtyRef = useRef(false)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const docRef = useRef(doc)

  const { push: pushHistory, undo: undoHistory, redo: redoHistory, canUndo, canRedo, reset: resetHistory } = useHistory(doc)

  const persist = useCallback((d: SvgDocument) => {
    const svg = serializeToSvg(d)
    dirtyRef.current = true
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      dirtyRef.current = false
      onContentChange(file.id, svg)
    }, 500)
  }, [file.id, onContentChange])

  const updateDoc = useCallback((newDoc: SvgDocument, shouldPersist = true) => {
    setDoc(newDoc)
    docRef.current = newDoc
    if (shouldPersist) {
      pushHistory(newDoc)
      persist(newDoc)
    }
  }, [pushHistory, persist])

  const updateElementInDoc = useCallback((id: string, attrs: Record<string, string | number>, style?: Partial<SvgElement['style']>, extra?: Record<string, any>) => {
    const newDoc = {
      ...docRef.current,
      elements: docRef.current.elements.map((el) => {
        if (el.id !== id) return el
        const updated = { ...el }
        if ('__deleteIds' in attrs) {
          return updated
        }
        if (style) {
          updated.style = { ...el.style, ...style }
          if (style.fill?.startsWith('url(#')) {
            const ref = (style.fill as string).slice(5, -1)
            updated.gradientId = ref
            updated.patternId = undefined
          } else if ('fill' in style) {
            updated.gradientId = undefined
            updated.patternId = undefined
          }
        }
        if (extra) {
          if ('gradientId' in extra) updated.gradientId = extra.gradientId
          if ('filterId' in extra) updated.filterId = extra.filterId
        }
        for (const [k, v] of Object.entries(attrs)) {
          if (k === 'name') {
            updated.name = v as string
          } else {
            updated.attrs = { ...updated.attrs, [k]: v }
          }
        }
        return updated
      }),
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    const newDoc = {
      ...docRef.current,
      elements: docRef.current.elements.filter((el) => !selectedIds.has(el.id)),
    }
    setSelectedIds(new Set())
    updateDoc(newDoc)
  }, [selectedIds, updateDoc])

  // Handle the __delete__ special case from canvas
  const handleUpdateElement = useCallback((id: string, attrs: Record<string, string | number>, style?: Partial<SvgElement['style']>) => {
    if (attrs.__deleteIds) {
      handleDeleteSelected()
      return
    }
    updateElementInDoc(id, attrs, style)
  }, [handleDeleteSelected, updateElementInDoc])

  const handleMoveElements = useCallback((ids: string[], dx: number, dy: number) => {
    const newDoc = {
      ...docRef.current,
      elements: docRef.current.elements.map((el) => {
        if (!ids.includes(el.id)) return el
        return {
          ...el,
          transform: {
            ...el.transform,
            tx: el.transform.tx + dx,
            ty: el.transform.ty + dy,
          },
        }
      }),
    }
    setDoc(newDoc)
    docRef.current = newDoc
  }, [])

  const handleResizeElement = useCallback((id: string, attrs: Record<string, number>) => {
    const newDoc = {
      ...docRef.current,
      elements: docRef.current.elements.map((el) => {
        if (el.id !== id) return el
        return { ...el, attrs: { ...el.attrs, ...attrs } }
      }),
    }
    setDoc(newDoc)
    docRef.current = newDoc
  }, [])

  const handleUpdateTransform = useCallback((id: string, transform: SvgTransform) => {
    const newDoc = {
      ...docRef.current,
      elements: docRef.current.elements.map((el) => {
        if (el.id !== id) return el
        return { ...el, transform }
      }),
    }
    setDoc(newDoc)
    docRef.current = newDoc
  }, [])

  const handleStartDraw = useCallback((x: number, y: number) => {
    setDrawStart({ x, y })
    setDrawCurrent({ x, y })
  }, [])

  const handleDrawMove = useCallback((x: number, y: number) => {
    setDrawCurrent({ x, y })
  }, [])

  const handleEndDraw = useCallback((x: number, y: number) => {
    if (!drawStart) return

    const sx = drawStart.x
    const sy = drawStart.y
    const ex = x
    const ey = y

    let el: SvgElement | null = null

    switch (toolMode) {
      case 'rect': {
        el = {
          id: generateId('rect'),
          type: 'rect',
          name: 'Rectangle',
          attrs: {
            x: Math.min(sx, ex),
            y: Math.min(sy, ey),
            width: Math.max(1, Math.abs(ex - sx)),
            height: Math.max(1, Math.abs(ey - sy)),
            rx: 0,
            ry: 0,
          },
          style: { fill: '#0099ff', fillOpacity: 0.3, stroke: '#0099ff', strokeWidth: 2, strokeOpacity: 1, opacity: 1 },
          transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
          visible: true,
          locked: false,
          children: [],
        }
        break
      }
      case 'circle': {
        const r = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
        el = {
          id: generateId('circle'),
          type: 'circle',
          name: 'Circle',
          attrs: { cx: sx, cy: sy, r: Math.max(1, r) },
          style: { fill: '#0099ff', fillOpacity: 0.3, stroke: '#0099ff', strokeWidth: 2, strokeOpacity: 1, opacity: 1 },
          transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
          visible: true,
          locked: false,
          children: [],
        }
        break
      }
      case 'ellipse': {
        el = {
          id: generateId('ellipse'),
          type: 'ellipse',
          name: 'Ellipse',
          attrs: { cx: (sx + ex) / 2, cy: (sy + ey) / 2, rx: Math.max(1, Math.abs(ex - sx) / 2), ry: Math.max(1, Math.abs(ey - sy) / 2) },
          style: { fill: '#0099ff', fillOpacity: 0.3, stroke: '#0099ff', strokeWidth: 2, strokeOpacity: 1, opacity: 1 },
          transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
          visible: true,
          locked: false,
          children: [],
        }
        break
      }
      case 'line': {
        el = {
          id: generateId('line'),
          type: 'line',
          name: 'Line',
          attrs: { x1: sx, y1: sy, x2: ex, y2: ey },
          style: { fill: 'none', fillOpacity: 1, stroke: '#0099ff', strokeWidth: 2, strokeOpacity: 1, opacity: 1 },
          transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
          visible: true,
          locked: false,
          children: [],
        }
        break
      }
    }

    if (el) {
      const newDoc = {
        ...docRef.current,
        elements: [...docRef.current.elements, el],
      }
      updateDoc(newDoc)
      setSelectedIds(new Set([el.id]))
    }

    setDrawStart(null)
    setDrawCurrent(null)
  }, [drawStart, toolMode, updateDoc])

  const handleAddPathPoint = useCallback((x: number, y: number) => {
    const newPoints = [...pathPoints, { x, y }]
    setPathPoints(newPoints)

    if (newPoints.length >= 2) {
      const prev = newPoints[newPoints.length - 2]
      const d = newPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
      const el = {
        id: generateId('path'),
        type: 'path' as const,
        name: 'Path',
        attrs: { d },
        style: { fill: 'none', fillOpacity: 1, stroke: '#0099ff', strokeWidth: 2, strokeOpacity: 1, opacity: 1 },
        transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
        visible: true,
        locked: false,
        children: [],
      }

      const existingPath = doc.elements.find((e) => e.id === '__current_path')
      let newDoc: SvgDocument
      if (existingPath) {
        newDoc = {
          ...docRef.current,
          elements: docRef.current.elements.map((e) => e.id === '__current_path' ? { ...el, id: '__current_path' } : e),
        }
      } else {
        newDoc = {
          ...docRef.current,
          elements: [...docRef.current.elements, { ...el, id: '__current_path' }],
        }
      }
      setDoc(newDoc)
      docRef.current = newDoc
    }
  }, [pathPoints, doc])

  // Finalize path on tool change
  const finalizePath = useCallback(() => {
    if (pathPoints.length === 0) return
    const existing = docRef.current.elements.find((e) => e.id === '__current_path')
    if (existing) {
      const newDoc = {
        ...docRef.current,
        elements: docRef.current.elements.map((e) => e.id === '__current_path'
          ? { ...e, id: generateId('path') }
          : e),
      }
      updateDoc(newDoc)
    }
    setPathPoints([])
  }, [pathPoints, updateDoc])

  const handleTextPlace = useCallback((x: number, y: number) => {
    const el: SvgElement = {
      id: generateId('text'),
      type: 'text',
      name: 'Text',
      attrs: { x, y, fontSize: 16, fontFamily: 'sans-serif', textAnchor: 'start' },
      style: { fill: '#000000', fillOpacity: 1, stroke: 'none', strokeWidth: 1, strokeOpacity: 1, opacity: 1 },
      transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
      visible: true,
      locked: false,
      children: [],
      editable: true,
    }

    const newDoc = {
      ...docRef.current,
      elements: [...docRef.current.elements, el],
    }
    updateDoc(newDoc)
    setSelectedIds(new Set([el.id]))
    setEditingTextId(el.id)
    setTimeout(() => setEditingTextId(el.id), 100)
  }, [updateDoc])

  const handleFreehandStart = useCallback((x: number, y: number) => {
    setFreehandPoints([{ x, y }])
  }, [])

  const handleFreehandMove = useCallback((x: number, y: number) => {
    setFreehandPoints((prev) => [...prev, { x, y }])
  }, [])

  const handleFreehandEnd = useCallback((x: number, y: number) => {
    const points = [...freehandPoints, { x, y }]
    if (points.length < 3) {
      setFreehandPoints([])
      return
    }

    // Convert freehand points to a smooth SVG path using Catmull-Rom to cubic bezier
    const d = catmullRomToSvgPath(points)
    if (d.length < 5) {
      setFreehandPoints([])
      return
    }

    const el: SvgElement = {
      id: generateId('freehand'),
      type: 'path',
      name: 'Freehand',
      attrs: { d },
      style: { fill: 'none', fillOpacity: 1, stroke: '#0099ff', strokeWidth: 2, strokeOpacity: 1, opacity: 1 },
      transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
      visible: true,
      locked: false,
      children: [],
    }

    const newDoc = {
      ...docRef.current,
      elements: [...docRef.current.elements, el],
    }
    updateDoc(newDoc)
    setSelectedIds(new Set([el.id]))
    setFreehandPoints([])
  }, [freehandPoints, updateDoc])

  const handleUndo = useCallback(() => {
    const prevDoc = undoHistory()
    if (prevDoc) {
      setDoc(prevDoc)
      docRef.current = prevDoc
      persist(prevDoc)
    }
  }, [undoHistory, persist])

  const handleRedo = useCallback(() => {
    const nextDoc = redoHistory()
    if (nextDoc) {
      setDoc(nextDoc)
      docRef.current = nextDoc
      persist(nextDoc)
    }
  }, [redoHistory, persist])

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.25, 10)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.25, 0.1)), [])
  const handleZoomFit = useCallback(() => {
    const aspect = doc.width / doc.height
    const container = document.querySelector('[data-svg-container]')
    if (container) {
      const rect = container.getBoundingClientRect()
      const scaleX = (rect.width - 40) / doc.width
      const scaleY = (rect.height - 40) / doc.height
      setZoom(Math.min(scaleX, scaleY))
    }
  }, [doc.width, doc.height])

  const handleExportSvg = useCallback(() => {
    const svg = serializeToSvg(docRef.current)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name.replace(/\.svg$/, '') ? `${file.name.replace(/\.svg$/, '')}.svg` : 'canvas.svg'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('SVG exported')
  }, [file.name])

  const handleExportPng = useCallback(() => {
    const svg = serializeToSvg(docRef.current)
    const img = new Image()
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((b) => {
        if (!b) return
        const dlUrl = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = dlUrl
        a.download = file.name.replace(/\.svg$/, '.png')
        a.click()
        URL.revokeObjectURL(dlUrl)
        toast.success('PNG exported')
      }, 'image/png')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [file.name])

  const handleCopySvg = useCallback(() => {
    const svg = serializeToSvg(docRef.current)
    navigator.clipboard.writeText(svg).then(() => toast.success('SVG source copied'))
  }, [])

  const handleSelect = useCallback((ids: Set<string>, toggle?: boolean) => {
    setSelectedIds(ids)
  }, [])

  const handleGroup = useCallback(() => {
    if (selectedIds.size < 2) return
    const groupId = generateId('group')
    const group: SvgElement = {
      id: groupId,
      type: 'group',
      name: 'Group',
      attrs: {},
      style: { fill: 'none', fillOpacity: 1, stroke: 'none', strokeWidth: 1, strokeOpacity: 1, opacity: 1 },
      transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
      visible: true,
      locked: false,
      children: Array.from(selectedIds),
    }

    const newDoc = {
      ...docRef.current,
      elements: [
        ...docRef.current.elements.filter((e) => !selectedIds.has(e.id)),
        group,
      ],
    }
    updateDoc(newDoc)
    setSelectedIds(new Set([groupId]))
    toast.success(`Grouped ${selectedIds.size} elements`)
  }, [selectedIds, updateDoc])

  const handleUngroup = useCallback(() => {
    if (selectedIds.size !== 1) return
    const id = Array.from(selectedIds)[0]
    const el = docRef.current.elements.find((e) => e.id === id)
    if (!el || el.type !== 'group' || el.children.length === 0) return

    const children = el.children.map((cid) => docRef.current.elements.find((e) => e.id === cid)).filter(Boolean) as SvgElement[]
    const newDoc = {
      ...docRef.current,
      elements: [
        ...docRef.current.elements.filter((e) => e.id !== id),
        ...children,
      ],
    }
    updateDoc(newDoc)
    setSelectedIds(new Set(children.map((c) => c.id)))
    toast.success('Ungrouped')
  }, [selectedIds, updateDoc])

  const handleBooleanOp = useCallback((op: 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide') => {
    if (selectedIds.size < 2) return
    const ids = Array.from(selectedIds)
    const result = performBooleanOp(op, ids, docRef.current)
    if (!result) {
      toast.error('Boolean operation failed')
      return
    }

    const newDoc = {
      ...docRef.current,
      elements: [
        ...docRef.current.elements.filter((e) => !ids.includes(e.id)),
        result,
      ],
    }
    updateDoc(newDoc)
    setSelectedIds(new Set([result.id]))
    toast.success(`Boolean ${op} completed`)
  }, [selectedIds, updateDoc])

  const handleAlign = useCallback((mode: 'left' | 'center-x' | 'right' | 'top' | 'middle-y' | 'bottom') => {
    if (selectedIds.size < 2) return
    const newElements = alignElements(docRef.current.elements, selectedIds, mode, doc.width, doc.height)
    const newDoc = { ...docRef.current, elements: newElements }
    updateDoc(newDoc)
  }, [selectedIds, doc, updateDoc])

  const handleDistribute = useCallback((mode: 'horizontal' | 'vertical') => {
    if (selectedIds.size < 3) {
      toast.error('Select at least 3 elements to distribute')
      return
    }
    const newElements = distributeElements(docRef.current.elements, selectedIds, mode)
    const newDoc = { ...docRef.current, elements: newElements }
    updateDoc(newDoc)
  }, [selectedIds, updateDoc])

  const handleToolChange = useCallback((mode: ToolMode) => {
    if (toolMode === 'path' && mode !== 'path') {
      finalizePath()
    }
    setToolMode(mode)
  }, [toolMode, finalizePath])

  const handleUpdatePathPoint = useCallback((elId: string, segIndex: number, pointIndex: number, x: number, y: number) => {
    const el = docRef.current.elements.find((e) => e.id === elId)
    if (!el || el.type !== 'path') return
    const d = (el.attrs.d as string) || ''
    const segments = parsePathD(d)
    const newSegments = updateSegmentPoint(segments, segIndex, pointIndex, x, y)
    const newD = segmentsToPathD(newSegments)
    updateElementInDoc(elId, { d: newD })
  }, [updateElementInDoc])

  const handleAddGradient = useCallback((gradient: SvgGradient) => {
    const newDoc = {
      ...docRef.current,
      gradients: [...docRef.current.gradients, gradient],
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleUpdateGradient = useCallback((id: string, update: Partial<SvgGradient>) => {
    const newDoc = {
      ...docRef.current,
      gradients: docRef.current.gradients.map((g) => g.id === id ? { ...g, ...update } : g),
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleDeleteGradient = useCallback((id: string) => {
    const newDoc = {
      ...docRef.current,
      gradients: docRef.current.gradients.filter((g) => g.id !== id),
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleAddFilter = useCallback((filter: SvgFilter) => {
    const newDoc = {
      ...docRef.current,
      filters: [...docRef.current.filters, filter],
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleUpdateFilter = useCallback((id: string, update: Partial<SvgFilter>) => {
    const newDoc = {
      ...docRef.current,
      filters: docRef.current.filters.map((f) => f.id === id ? { ...f, ...update } : f),
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleDeleteFilter = useCallback((id: string) => {
    const newDoc = {
      ...docRef.current,
      filters: docRef.current.filters.filter((f) => f.id !== id),
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleAddPattern = useCallback((pattern: SvgPattern) => {
    const newDoc = {
      ...docRef.current,
      patterns: [...docRef.current.patterns, pattern],
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleUpdatePattern = useCallback((id: string, update: Partial<SvgPattern>) => {
    const newDoc = {
      ...docRef.current,
      patterns: docRef.current.patterns.map((p) => p.id === id ? { ...p, ...update } : p),
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleDeletePattern = useCallback((id: string) => {
    const newDoc = {
      ...docRef.current,
      patterns: docRef.current.patterns.filter((p) => p.id !== id),
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleLayerReorder = useCallback((fromIndex: number, toIndex: number) => {
    const flatElements = docRef.current.elements.filter((e) => e.type !== 'group')
      .concat(docRef.current.elements.filter((e) => e.type === 'group'))
    const el = flatElements[fromIndex]
    if (!el) return

    const newFlat = [...flatElements]
    newFlat.splice(fromIndex, 1)
    newFlat.splice(toIndex, 0, el)

    const nonGroup = newFlat.filter((e) => e.type !== 'group')
    const groups = newFlat.filter((e) => e.type === 'group')
    const newDoc = {
      ...docRef.current,
      elements: [...nonGroup, ...groups],
    }
    updateDoc(newDoc)
  }, [updateDoc])

  const handleToggleVisibility = useCallback((id: string) => {
    const newDoc = {
      ...docRef.current,
      elements: docRef.current.elements.map((el) =>
        el.id === id ? { ...el, visible: !el.visible } : el,
      ),
    }
    setDoc(newDoc)
    docRef.current = newDoc
  }, [])

  const handleToggleLock = useCallback((id: string) => {
    const newDoc = {
      ...docRef.current,
      elements: docRef.current.elements.map((el) =>
        el.id === id ? { ...el, locked: !el.locked } : el,
      ),
    }
    setDoc(newDoc)
    docRef.current = newDoc
  }, [])

  const handleDuplicate = useCallback((id: string) => {
    const el = docRef.current.elements.find((e) => e.id === id)
    if (!el) return
    const clone: SvgElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: generateId(el.type),
      name: `${el.name} copy`,
      transform: { ...el.transform, tx: el.transform.tx + 20, ty: el.transform.ty + 20 },
    }
    const newDoc = {
      ...docRef.current,
      elements: [...docRef.current.elements, clone],
    }
    updateDoc(newDoc)
    setSelectedIds(new Set([clone.id]))
  }, [updateDoc])

  const handleDelete = useCallback((id: string) => {
    const newDoc = {
      ...docRef.current,
      elements: docRef.current.elements.filter((e) => e.id !== id),
    }
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    updateDoc(newDoc)
  }, [updateDoc])

  // Sync source code
  useEffect(() => {
    if (showSource) {
      setSourceCode(serializeToSvg(doc))
    }
  }, [doc, showSource])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      }
      if (mod && e.key === 'd') {
        e.preventDefault()
        if (selectedIds.size === 1) handleDuplicate(Array.from(selectedIds)[0])
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          handleDeleteSelected()
        }
      }
      if (mod && e.key === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(doc.elements.filter((e) => e.visible).map((e) => e.id)))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo, handleDuplicate, handleDeleteSelected, doc.elements, selectedIds])

  // Clean up current_path on unmount
  useEffect(() => {
    return () => {
      const currentPath = docRef.current.elements.find((e) => e.id === '__current_path')
      if (currentPath) {
        const newDoc = {
          ...docRef.current,
          elements: docRef.current.elements.map((e) => e.id === '__current_path'
            ? { ...e, id: generateId('path') }
            : e),
        }
        onContentChange(file.id, serializeToSvg(newDoc))
      }
    }
  }, [file.id, onContentChange])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      <Toolbar
        toolMode={toolMode}
        onToolChange={handleToolChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((g) => !g)}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid((s) => !s)}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onCopySvg={handleCopySvg}
        onToggleSource={() => {
          if (!showSource) setSourceCode(serializeToSvg(doc))
          setShowSource((s) => !s)
        }}
        showSource={showSource}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
        onBooleanOp={handleBooleanOp}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        selectionCount={selectedIds.size}
      />

      <div className="flex-1 flex overflow-hidden" data-svg-container>
        {showSource ? (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-1 text-xs text-muted-foreground bg-muted/30 font-medium">Source</div>
              <textarea
                className="flex-1 p-4 text-xs font-mono bg-background text-foreground outline-none resize-none border-0"
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                onBlur={() => {
                  const parsed = parseSvgSource(sourceCode)
                  if (parsed) {
                    updateDoc(parsed, true)
                    toast.success('SVG source applied')
                  } else {
                    toast.error('Invalid SVG source')
                  }
                }}
              />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-1 text-xs text-muted-foreground bg-muted/30 font-medium">Preview</div>
              <SvgCanvas
                doc={doc}
                selectedIds={selectedIds}
                toolMode="select"
                zoom={zoom}
                panX={panX}
                panY={panY}
                showGrid={showGrid}
                snapToGrid={snapToGrid}
                gridSize={20}
                guideLines={guideLines}
                editingTextId={editingTextId}
                onSelect={handleSelect}
                onMoveElements={handleMoveElements}
                onResizeElement={handleResizeElement}
                onUpdateTransform={handleUpdateTransform}
                onStartDraw={handleStartDraw}
                onDrawMove={handleDrawMove}
                onEndDraw={handleEndDraw}
                onAddPathPoint={handleAddPathPoint}
                onTextPlace={handleTextPlace}
                onFreehandStart={handleFreehandStart}
                onFreehandMove={handleFreehandMove}
                onFreehandEnd={handleFreehandEnd}
                onUpdateElement={handleUpdateElement}
                onUpdatePathPoint={handleUpdatePathPoint}
                onSetEditingText={setEditingTextId}
                drawStart={drawStart}
                drawCurrent={drawCurrent}
                pathPoints={pathPoints}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <LayerPanel
              elements={doc.elements}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onReorder={handleLayerReorder}
              onToggleVisibility={handleToggleVisibility}
              onToggleLock={handleToggleLock}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
            <div className="flex-1 flex overflow-hidden" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <SvgCanvas
                doc={doc}
                selectedIds={selectedIds}
                toolMode={toolMode}
                zoom={zoom}
                panX={panX}
                panY={panY}
                showGrid={showGrid}
                snapToGrid={snapToGrid}
                gridSize={20}
                guideLines={guideLines}
                editingTextId={editingTextId}
                onSelect={handleSelect}
                onMoveElements={handleMoveElements}
                onResizeElement={handleResizeElement}
                onUpdateTransform={handleUpdateTransform}
                onStartDraw={handleStartDraw}
                onDrawMove={handleDrawMove}
                onEndDraw={handleEndDraw}
                onAddPathPoint={handleAddPathPoint}
                onTextPlace={handleTextPlace}
                onFreehandStart={handleFreehandStart}
                onFreehandMove={handleFreehandMove}
                onFreehandEnd={handleFreehandEnd}
                onUpdateElement={handleUpdateElement}
                onUpdatePathPoint={handleUpdatePathPoint}
                onSetEditingText={setEditingTextId}
                drawStart={drawStart}
                drawCurrent={drawCurrent}
                pathPoints={pathPoints}
              />
            </div>
            <PropertyPanel
              doc={doc}
              selectedIds={selectedIds}
              onUpdateElement={handleUpdateElement}
              onUpdateTransform={handleUpdateTransform}
              onAddGradient={handleAddGradient}
              onUpdateGradient={handleUpdateGradient}
              onDeleteGradient={handleDeleteGradient}
              onAddFilter={handleAddFilter}
              onUpdateFilter={handleUpdateFilter}
              onDeleteFilter={handleDeleteFilter}
              onAddPattern={handleAddPattern}
              onUpdatePattern={handleUpdatePattern}
              onDeletePattern={handleDeletePattern}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-background border-t border-border text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{file.name}</span>
          {selectedIds.size > 0 && (
            <span>{selectedIds.size} element{selectedIds.size > 1 ? 's' : ''} selected</span>
          )}
          {editingTextId && <span>Editing text — press Enter to confirm</span>}
        </div>
        <div className="flex items-center gap-3">
          <span>{doc.width} × {doc.height}</span>
          <span>{doc.elements.length} elements</span>
          {showGrid && <span>Grid: {20}px</span>}
          {snapToGrid && <span>Snap on</span>}
        </div>
      </div>
    </div>
  )
}

function catmullRomToSvgPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) return `M${points[0].x} ${points[0].y}L${points[1].x} ${points[1].y}`

  const d: string[] = [`M${round(points[0].x)} ${round(points[0].y)}`]
  const len = points.length

  for (let i = 0; i < len - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[Math.min(i + 1, len - 1)]
    const p3 = points[Math.min(i + 2, len - 1)]

    const tension = 0.5
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    if (i === 0) {
      d.push(`C${round(cp1x)} ${round(cp1y)}, ${round(cp2x)} ${round(cp2y)}, ${round(p2.x)} ${round(p2.y)}`)
    } else if (i < len - 2) {
      d.push(`S${round(cp2x)} ${round(cp2y)}, ${round(p2.x)} ${round(p2.y)}`)
    }
  }

  return d.join('')
}

function round(n: number): string {
  const r = Math.round(n * 100) / 100
  return r === Math.floor(r) ? r.toString() : r.toFixed(2)
}
