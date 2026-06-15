import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useCADStore } from '../store'
import { findSnapPoint, drawSnapIndicator } from './SketchSnap'
import type { SnapPoint } from './SketchSnap'
import { trimEntity, extendEntity, findBestHit } from './SketchTrimExtend'
import { offsetEntity } from './SketchOffset'
import type { SketchEntity } from '../types'

interface Point2D { x: number; y: number }

function createEntityId(): string {
  return `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function SketchCanvas2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeSketch = useCADStore(s => s.activeSketch)
  const sketchTool = useCADStore(s => s.sketchTool)
  const addSketchEntity = useCADStore(s => s.addSketchEntity)
  const updateSketchEntity = useCADStore(s => s.updateSketchEntity)
  const doc = useCADStore(s => s.doc)
  const snapSettings = useCADStore(s => s.snap)

  const [drawing, setDrawing] = useState(false)
  const [start, setStart] = useState<Point2D>({ x: 0, y: 0 })
  const [current, setCurrent] = useState<Point2D>({ x: 0, y: 0 })
  const [preview, setPreview] = useState<{ type: string; start: Point2D; end: Point2D; offsetDist?: number } | null>(null)
  const [snap, setSnap] = useState<SnapPoint | null>(null)
  const [offsetDist, setOffsetDist] = useState(5)
  const [trimPreview, setTrimPreview] = useState<{ point: Point2D; entity: SketchEntity } | null>(null)

  const sketch = activeSketch ? doc.sketches[activeSketch] : null
  const entities = useMemo(() => sketch ? Object.values(sketch.entities) : [], [sketch])

  const toCanvas = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point2D => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: e.clientX - rect.left - rect.width / 2,
      y: -(e.clientY - rect.top - rect.height / 2),
    }
  }, [])

  const applySnap = useCallback((pt: Point2D): Point2D => {
    if (!sketch) return pt
    const snapped = findSnapPoint(
      pt, entities,
      snapSettings.gridSize,
      snapSettings.grid,
      snapSettings.vertex,
      snapSettings.midpoint,
      true,
      snapSettings.center
    )
    if (snapped) {
      setSnap(snapped)
      return { x: snapped.x, y: snapped.y }
    }
    setSnap(null)
    return pt
  }, [sketch, entities, snapSettings])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeSketch) return
    const raw = toCanvas(e)
    const pt = applySnap(raw)

    if (sketchTool === 'select') return

    if (sketchTool === 'trim' || sketchTool === 'extend') {
      if (!sketch) return
      if (sketchTool === 'trim') {
        const hit = findBestHit(pt, entities)
        if (hit) {
          const result = trimEntity(pt, entities)
          if (result) {
            updateSketchEntity(activeSketch, result.trimmedEntity.id, result.trimmedEntity)
          }
        }
      } else {
        const hit = findBestHit(pt, entities)
        if (hit) {
          const result = extendEntity(pt, entities)
          if (result) {
            updateSketchEntity(activeSketch, result.extendedEntity.id, result.extendedEntity)
          }
        }
      }
      return
    }

    if (sketchTool === 'offset') {
      if (!sketch) return
      const result = offsetEntity(pt, entities, offsetDist)
      if (result) {
        addSketchEntity(activeSketch, result.offsetEntity)
      }
      return
    }

    if (e.button === 0) {
      setDrawing(true)
      setStart(pt)
      setCurrent(pt)
    }
  }, [activeSketch, sketchTool, toCanvas, applySnap, sketch, entities, updateSketchEntity, addSketchEntity, offsetDist])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const raw = toCanvas(e)
    const pt = applySnap(raw)

    if (!drawing) {
      if (sketchTool === 'trim' || sketchTool === 'extend') {
        const hit = findBestHit(pt, entities)
        setTrimPreview(hit ? { point: pt, entity: hit.entity } : null)
      }
      return
    }

    setCurrent(pt)

    if (sketchTool === 'line') {
      setPreview({ type: 'line', start, end: pt })
    } else if (sketchTool === 'rectangle') {
      setPreview({ type: 'rectangle', start, end: pt })
    } else if (sketchTool === 'circle') {
      setPreview({ type: 'circle', start, end: pt })
    }
  }, [drawing, sketchTool, start, toCanvas, applySnap, entities])

  const commitEntity = useCallback(() => {
    if (!activeSketch || !drawing) return

    const id = createEntityId()
    if (sketchTool === 'line') {
      addSketchEntity(activeSketch, {
        id, type: 'line',
        params: { x1: start.x, y1: start.y, x2: current.x, y2: current.y },
        construction: false, locked: false, layer: 'default',
      })
    } else if (sketchTool === 'rectangle') {
      addSketchEntity(activeSketch, {
        id, type: 'rectangle',
        params: { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y),
                  width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) },
        construction: false, locked: false, layer: 'default',
      })
    } else if (sketchTool === 'circle') {
      const dx = current.x - start.x
      const dy = current.y - start.y
      const radius = Math.sqrt(dx * dx + dy * dy)
      addSketchEntity(activeSketch, {
        id, type: 'circle',
        params: { cx: start.x, cy: start.y, radius },
        construction: false, locked: false, layer: 'default',
      })
    }

    setDrawing(false)
    setPreview(null)
  }, [activeSketch, drawing, sketchTool, start, current, addSketchEntity])

  const handleMouseUp = useCallback(() => {
    commitEntity()
  }, [commitEntity])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (sketchTool === 'offset') {
      setOffsetDist(v => Math.max(0.5, v + (e.deltaY > 0 ? -0.5 : 0.5)))
    }
  }, [sketchTool])

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const w = canvasRef.current.width
    const h = canvasRef.current.height
    ctx.clearRect(0, 0, w, h)

    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1

    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()

    if (snapSettings.grid && snapSettings.gridSize > 0) {
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 0.5
      const gs = snapSettings.gridSize
      for (let gx = (w / 2) % gs; gx < w; gx += gs) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke()
      }
      for (let gy = (h / 2) % gs; gy < h; gy += gs) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke()
      }
    }

    if (sketch) {
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 2
      for (const ent of Object.values(sketch.entities)) {
        const sp = ent.params as Record<string, number>
        if (ent.type === 'line') {
          ctx.beginPath()
          ctx.moveTo(sp.x1 + w / 2, -(sp.y1 - h / 2))
          ctx.lineTo(sp.x2 + w / 2, -(sp.y2 - h / 2))
          ctx.stroke()
        } else if (ent.type === 'circle') {
          ctx.beginPath()
          ctx.arc(sp.cx + w / 2, -(sp.cy - h / 2), sp.radius, 0, Math.PI * 2)
          ctx.stroke()
        } else if (ent.type === 'rectangle') {
          ctx.strokeRect(sp.x + w / 2, -(sp.y - h / 2), sp.width, sp.height)
        }
      }
    }

    if (preview) {
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])

      if (preview.type === 'line') {
        ctx.beginPath()
        ctx.moveTo(preview.start.x + w / 2, -(preview.start.y - h / 2))
        ctx.lineTo(preview.end.x + w / 2, -(preview.end.y - h / 2))
        ctx.stroke()
      } else if (preview.type === 'rectangle') {
        const x = Math.min(preview.start.x, preview.end.x)
        const y = Math.min(preview.start.y, preview.end.y)
        const rw = Math.abs(preview.end.x - preview.start.x)
        const rh = Math.abs(preview.end.y - preview.start.y)
        ctx.strokeRect(x + w / 2, -(y - h / 2), rw, rh)
      } else if (preview.type === 'circle') {
        const dx = preview.end.x - preview.start.x
        const dy = preview.end.y - preview.start.y
        const radius = Math.sqrt(dx * dx + dy * dy)
        ctx.beginPath()
        ctx.arc(preview.start.x + w / 2, -(preview.start.y - h / 2), radius, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.setLineDash([])
    }

    if (trimPreview && sketch) {
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 2
      ctx.setLineDash([3, 3])
      const sp = trimPreview.entity.params as Record<string, number>
      if (trimPreview.entity.type === 'line') {
        ctx.beginPath()
        ctx.moveTo(sp.x1 + w / 2, -(sp.y1 - h / 2))
        ctx.lineTo(sp.x2 + w / 2, -(sp.y2 - h / 2))
        ctx.stroke()
      }
      ctx.setLineDash([])
    }

    if (snap) {
      drawSnapIndicator(ctx, snap, w, h)
    }

    if (sketchTool === 'offset') {
      ctx.fillStyle = '#a78bfa'
      ctx.font = '10px monospace'
      ctx.fillText(`Offset: ${offsetDist.toFixed(1)}`, 8, 12)
    }
  }, [sketch, preview, snap, trimPreview, sketchTool, offsetDist, snapSettings])

  if (!activeSketch) return null

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onMouseLeave={() => { setDrawing(false); setPreview(null); setSnap(null); setTrimPreview(null) }}
      />
    </div>
  )
}
