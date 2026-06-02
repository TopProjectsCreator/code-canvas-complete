import type { SvgElement, SvgDocument, BBox } from './types'
import { generateId } from './types'
import { getElementBBox } from './svgUtils'

type BooleanOp = 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide'

export function performBooleanOp(
  op: BooleanOp,
  sourceIds: string[],
  doc: SvgDocument,
): SvgElement | null {
  if (sourceIds.length < 2) return null

  const elements = sourceIds
    .map((id) => doc.elements.find((e) => e.id === id))
    .filter(Boolean) as SvgElement[]

  if (elements.length < 2) return null

  const canvas = document.createElement('canvas')
  const bbox = getCombinedBBox(elements)
  const padding = 10
  const scale = 4
  const w = Math.ceil((bbox.width + padding * 2) * scale)
  const h = Math.ceil((bbox.height + padding * 2) * scale)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const ox = (bbox.x - padding) * scale
  const oy = (bbox.y - padding) * scale

  const renderOps: Array<{ el: SvgElement; comp: GlobalCompositeOperation }> = []

  if (op === 'union') {
    for (const el of elements) {
      renderOps.push({ el, comp: 'source-over' })
    }
  } else if (op === 'intersect') {
    // Draw first shape, then use source-in for subsequent
    renderOps.push({ el: elements[0], comp: 'source-over' })
    for (let i = 1; i < elements.length; i++) {
      renderOps.push({ el: elements[i], comp: 'source-in' })
    }
  } else if (op === 'subtract') {
    renderOps.push({ el: elements[0], comp: 'source-over' })
    for (let i = 1; i < elements.length; i++) {
      renderOps.push({ el: elements[i], comp: 'destination-out' })
    }
  } else if (op === 'exclude') {
    renderOps.push({ el: elements[0], comp: 'source-over' })
    for (let i = 1; i < elements.length; i++) {
      renderOps.push({ el: elements[i], comp: 'xor' })
    }
  } else if (op === 'divide') {
    renderOps.push({ el: elements[0], comp: 'source-over' })
    for (let i = 1; i < elements.length; i++) {
      renderOps.push({ el: elements[i], comp: 'destination-out' })
    }
  }

  for (const renderOp of renderOps) {
    ctx.globalCompositeOperation = renderOp.comp
    renderElementToCanvas(ctx, renderOp.el, ox, oy, scale)
  }

  const imageData = ctx.getImageData(0, 0, w, h)
  const contourPoints = traceContour(imageData, w, h)

  if (contourPoints.length < 3) return null

  const simplified = simplifyPath(contourPoints, 0.5)
  const d = pointsToPathD(simplified, ox, oy, scale, bbox.x - padding, bbox.y - padding)

  if (d.length < 10) return null

  const firstEl = elements[0]
  const result: SvgElement = {
    id: generateId('bool'),
    type: 'path',
    name: `${op}-result`,
    attrs: { d },
    style: { ...firstEl.style },
    transform: { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
    visible: true,
    locked: false,
    children: [],
  }

  return result
}

function getCombinedBBox(elements: SvgElement[]): BBox {
  let bbox: BBox | null = null
  for (const el of elements) {
    const b = getElementBBox(el)
    if (!bbox) {
      bbox = { ...b }
    } else {
      const minX = Math.min(bbox.x, b.x)
      const minY = Math.min(bbox.y, b.y)
      const maxX = Math.max(bbox.x + bbox.width, b.x + b.width)
      const maxY = Math.max(bbox.y + bbox.height, b.y + b.height)
      bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }
  }
  return bbox || { x: 0, y: 0, width: 100, height: 100 }
}

function renderElementToCanvas(
  ctx: CanvasRenderingContext2D,
  el: SvgElement,
  ox: number,
  oy: number,
  scale: number,
) {
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = Math.max(1, (el.style.strokeWidth || 1) * scale)

  const a = el.attrs
  const tf = el.transform
  ctx.translate(
    (a.x as number || 0) * scale - ox + tf.tx * scale,
    (a.y as number || 0) * scale - oy + tf.ty * scale,
  )

  switch (el.type) {
    case 'rect': {
      const w = (a.width as number) * scale || 0
      const h = (a.height as number) * scale || 0
      const rx = (a.rx as number || 0) * scale
      const ry = (a.ry as number || 0) * scale
      if (rx > 0 || ry > 0) {
        ctx.beginPath()
        ctx.roundRect(0, 0, w, h, Math.max(rx, ry))
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.fillRect(0, 0, w, h)
        ctx.strokeRect(0, 0, w, h)
      }
      break
    }
    case 'circle': {
      const cx = ((a.cx as number) || 0) * scale - ((a.x as number) || 0) * scale
      const cy = ((a.cy as number) || 0) * scale - ((a.y as number) || 0) * scale
      const r = ((a.r as number) || 0) * scale
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'ellipse': {
      const cx = ((a.cx as number) || 0) * scale - ((a.x as number) || 0) * scale
      const cy = ((a.cy as number) || 0) * scale - ((a.y as number) || 0) * scale
      const rx = ((a.rx as number) || 0) * scale
      const ry = ((a.ry as number) || 0) * scale
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'line': {
      const x1 = ((a.x1 as number) || 0) * scale - ((a.x as number) || 0) * scale
      const y1 = ((a.y1 as number) || 0) * scale - ((a.y as number) || 0) * scale
      const x2 = ((a.x2 as number) || 0) * scale - ((a.x as number) || 0) * scale
      const y2 = ((a.y2 as number) || 0) * scale - ((a.y as number) || 0) * scale
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      break
    }
    case 'path': {
      const d = (a.d as string) || ''
      const path2d = new Path2D(d)
      ctx.save()
      ctx.translate(-((a.x as number) || 0) * scale, -((a.y as number) || 0) * scale)
      ctx.scale(scale, scale)
      ctx.fill(path2d)
      ctx.stroke(path2d)
      ctx.restore()
      break
    }
    case 'text': {
      const fs = ((a.fontSize as number) || 16) * scale
      ctx.font = `${fs}px ${a.fontFamily || 'sans-serif'}`
      ctx.fillText(el.name || '', 0, fs)
      break
    }
  }

  ctx.restore()
}

function traceContour(
  data: ImageData,
  w: number,
  h: number,
): Array<{ x: number; y: number }> {
  const pixels = new Uint8Array(data.data)
  const visited = new Uint8Array(w * h)

  let startX = -1
  let startY = -1

  for (let y = 0; y < h && startX < 0; y++) {
    for (let x = 0; x < w && startX < 0; x++) {
      const alpha = pixels[(y * w + x) * 4 + 3]
      if (alpha > 128) {
        startX = x
        startY = y
      }
    }
  }

  if (startX < 0) return []

  const points: Array<{ x: number; y: number }> = []
  let cx = startX
  let cy = startY
  let dir = 0
  const maxPoints = w * h * 2
  let safety = 0

  const isFilled = (px: number, py: number): boolean => {
    if (px < 0 || px >= w || py < 0 || py >= h) return false
    return pixels[(py * w + px) * 4 + 3] > 128
  }

  const neighbors: Array<[number, number]> = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1],
  ]

  do {
    points.push({ x: cx, y: cy })
    visited[cy * w + cx] = 1

    let found = false
    for (let i = 0; i < 8; i++) {
      const ni = (dir + i) % 8
      const [dx, dy] = neighbors[ni]
      const nx = cx + dx
      const ny = cy + dy
      if (isFilled(nx, ny)) {
        cx = nx
        cy = ny
        dir = (ni + 5) % 8
        found = true
        break
      }
    }

    if (!found) break
    safety++
  } while ((cx !== startX || cy !== startY) && safety < maxPoints)

  return points
}

function simplifyPath(
  points: Array<{ x: number; y: number }>,
  tolerance: number,
): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIndex = 0

  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDist(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyPath(points.slice(maxIndex), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [first, last]
}

function perpendicularDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
}

function pointsToPathD(
  points: Array<{ x: number; y: number }>,
  ox: number,
  oy: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): string {
  if (points.length < 2) return ''

  const segments: string[] = []
  const toCoord = (p: { x: number; y: number }) => ({
    x: p.x / scale + offsetX,
    y: p.y / scale + offsetY,
  })

  const first = toCoord(points[0])
  segments.push(`M${round(first.x)} ${round(first.y)}`)

  for (let i = 1; i < points.length; i++) {
    const p = toCoord(points[i])
    segments.push(`L${round(p.x)} ${round(p.y)}`)
  }

  segments.push('Z')
  return segments.join('')
}

function round(n: number): string {
  const r = Math.round(n * 100) / 100
  return r === Math.floor(r) ? r.toString() : r.toFixed(2)
}
