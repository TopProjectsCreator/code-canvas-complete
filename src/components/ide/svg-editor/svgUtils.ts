import type { SvgElement, SvgDocument, BBox, SvgTransform, PathSegment } from './types'

export function parseSvgSource(xml: string): SvgDocument | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return null

    const width = parseAttr(svg, 'width', 800)
    const height = parseAttr(svg, 'height', 600)
    const viewBox = svg.getAttribute('viewBox') || `0 0 ${width} ${height}`

    const result: SvgDocument = {
      width,
      height,
      viewBox,
      elements: [],
      gradients: [],
      patterns: [],
      filters: [],
    }

    const defs = svg.querySelector('defs')
    if (defs) {
      defs.querySelectorAll('linearGradient, radialGradient').forEach((el) => {
        const grad = parseGradient(el as SVGElement)
        if (grad) result.gradients.push(grad)
      })
      defs.querySelectorAll('pattern').forEach((el) => {
        const pat = parsePattern(el as SVGElement)
        if (pat) result.patterns.push(pat)
      })
      defs.querySelectorAll('filter').forEach((el) => {
        const f = parseFilter(el as SVGElement)
        if (f) result.filters.push(f)
      })
    }

    const children = Array.from(svg.children).filter((c) => c.tagName !== 'defs')
    for (const child of children) {
      const el = parseChildElement(child as SVGElement, result)
      if (el) result.elements.push(el)
    }

    return result
  } catch {
    return null
  }
}

function parseAttr(el: Element, name: string, fallback: number): number {
  const v = el.getAttribute(name)
  if (!v) return fallback
  const n = parseFloat(v)
  return isNaN(n) ? fallback : n
}

function parseGradient(el: SVGElement): import('./types').SvgGradient | null {
  const id = el.getAttribute('id')
  if (!id) return null
  const isRadial = el.tagName === 'radialGradient'
  const stops: import('./types').SvgGradientStop[] = []
  el.querySelectorAll('stop').forEach((s) => {
    stops.push({
      offset: parseFloat(s.getAttribute('offset') || '0') / 100,
      color: s.getAttribute('stop-color') || '#000',
      opacity: parseFloat(s.getAttribute('stop-opacity') || '1'),
    })
  })
  return {
    id,
    type: isRadial ? 'radial' : 'linear',
    x1: parseAttr(el, 'x1', 0),
    y1: parseAttr(el, 'y1', 0),
    x2: parseAttr(el, 'x2', 1),
    y2: parseAttr(el, 'y2', 0),
    cx: parseAttr(el, 'cx', 0.5),
    cy: parseAttr(el, 'cy', 0.5),
    r: parseAttr(el, 'r', 0.5),
    stops,
  }
}

function parsePattern(el: SVGElement): import('./types').SvgPattern | null {
  const id = el.getAttribute('id')
  if (!id) return null
  return {
    id,
    type: 'custom',
    width: parseAttr(el, 'width', 10),
    height: parseAttr(el, 'height', 10),
    fillColor: '#000',
    bgColor: 'transparent',
    pathData: el.innerHTML,
  }
}

function parseFilter(el: SVGElement): import('./types').SvgFilter | null {
  const id = el.getAttribute('id')
  if (!id) return null
  const feDropShadow = el.querySelector('feDropShadow')
  if (feDropShadow) {
    return {
      id,
      type: 'drop-shadow',
      params: {
        dx: parseAttr(feDropShadow, 'dx', 2),
        dy: parseAttr(feDropShadow, 'dy', 2),
        blurRadius: parseAttr(feDropShadow, 'stdDeviation', 4),
        strength: parseAttr(feDropShadow, 'flood-opacity', 1),
      },
      color: feDropShadow.getAttribute('flood-color') || '#000',
    }
  }
  const feGaussianBlur = el.querySelector('feGaussianBlur')
  if (feGaussianBlur) {
    return {
      id,
      type: 'blur',
      params: { stdDeviation: parseAttr(feGaussianBlur, 'stdDeviation', 4) },
    }
  }
  const feColorMatrix = el.querySelector('feColorMatrix')
  if (feColorMatrix) {
    const values = feColorMatrix.getAttribute('values') || ''
    return {
      id,
      type: 'color-matrix',
      params: {},
      matrix: values.split(/\s+/).map(Number),
    }
  }
  return {
    id,
    type: 'glow',
    params: { blurRadius: 4, strength: 1 },
    color: '#fff',
  }
}

function parseChildElement(el: SVGElement, doc: SvgDocument): SvgElement | null {
  const tag = el.tagName.toLowerCase()
  const id = el.getAttribute('id') || `el-${Math.random().toString(36).slice(2, 8)}`

  const base: SvgElement = {
    id,
    type: 'rect',
    name: tag,
    attrs: {},
    style: {
      fill: el.getAttribute('fill') || '#000000',
      fillOpacity: parseFloat(el.getAttribute('fill-opacity') || '1'),
      stroke: el.getAttribute('stroke') || 'none',
      strokeWidth: parseFloat(el.getAttribute('stroke-width') || '1'),
      strokeOpacity: parseFloat(el.getAttribute('stroke-opacity') || '1'),
      opacity: parseFloat(el.getAttribute('opacity') || '1'),
    },
    transform: parseTransform(el.getAttribute('transform')),
    visible: true,
    locked: false,
    children: [],
  }

  if (tag === 'g') {
    base.type = 'group'
    const children = Array.from(el.children)
    for (const child of children) {
      const ce = parseChildElement(child as SVGElement, doc)
      if (ce) {
        doc.elements.push(ce)
        base.children.push(ce.id)
      }
    }
    return base
  }

  if (tag === 'rect') {
    base.type = 'rect'
    base.attrs = {
      x: parseAttr(el, 'x', 0),
      y: parseAttr(el, 'y', 0),
      width: parseAttr(el, 'width', 100),
      height: parseAttr(el, 'height', 100),
      rx: parseAttr(el, 'rx', 0),
      ry: parseAttr(el, 'ry', 0),
    }
  } else if (tag === 'circle') {
    base.type = 'circle'
    base.attrs = {
      cx: parseAttr(el, 'cx', 100),
      cy: parseAttr(el, 'cy', 100),
      r: parseAttr(el, 'r', 50),
    }
  } else if (tag === 'ellipse') {
    base.type = 'ellipse'
    base.attrs = {
      cx: parseAttr(el, 'cx', 100),
      cy: parseAttr(el, 'cy', 100),
      rx: parseAttr(el, 'rx', 80),
      ry: parseAttr(el, 'ry', 50),
    }
  } else if (tag === 'line') {
    base.type = 'line'
    base.attrs = {
      x1: parseAttr(el, 'x1', 0),
      y1: parseAttr(el, 'y1', 0),
      x2: parseAttr(el, 'x2', 100),
      y2: parseAttr(el, 'y2', 100),
    }
  } else if (tag === 'path') {
    base.type = 'path'
    base.attrs = { d: el.getAttribute('d') || '' }
  } else if (tag === 'text') {
    base.type = 'text'
    base.attrs = {
      x: parseAttr(el, 'x', 0),
      y: parseAttr(el, 'y', 20),
      fontSize: parseAttr(el, 'font-size', 16),
      fontFamily: el.getAttribute('font-family') || 'sans-serif',
      textAnchor: el.getAttribute('text-anchor') || 'start',
    }
    base.name = el.textContent || 'Text'
    base.editable = true
  } else if (tag === 'image') {
    base.type = 'image'
    base.attrs = {
      x: parseAttr(el, 'x', 0),
      y: parseAttr(el, 'y', 0),
      width: parseAttr(el, 'width', 100),
      height: parseAttr(el, 'height', 100),
      href: el.getAttribute('href') || el.getAttribute('xlink:href') || '',
      preserveAspectRatio: el.getAttribute('preserveAspectRatio') || 'xMidYMid meet',
    }
  } else {
    return null
  }

  const fillUrl = el.getAttribute('fill')
  if (fillUrl?.startsWith('url(#')) {
    const ref = fillUrl.slice(5, -1)
    if (doc.gradients.find((g) => g.id === ref)) base.gradientId = ref
    if (doc.patterns.find((p) => p.id === ref)) base.patternId = ref
  }

  const filterUrl = el.getAttribute('filter')
  if (filterUrl?.startsWith('url(#')) {
    base.filterId = filterUrl.slice(5, -1)
  }

  return base
}

function parseTransform(transform: string | null): SvgTransform {
  const def: SvgTransform = { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 }
  if (!transform) return def
  const t = transform.match(/(\w+)\(([^)]+)\)/g)
  if (!t) return def
  for (const part of t) {
    const m = part.match(/(\w+)\(([^)]+)\)/)
    if (!m) continue
    const args = m[2].split(/[\s,]+/).map(Number)
    switch (m[1]) {
      case 'translate':
        def.tx = args[0] || 0
        def.ty = args[1] || 0
        break
      case 'scale':
        def.sx = args[0] || 1
        def.sy = args[1] || args[0] || 1
        break
      case 'rotate':
        def.rot = ((args[0] || 0) * Math.PI) / 180
        break
      case 'matrix':
        if (args.length >= 6) {
          def.sx = args[0]
          def.sy = args[3]
          def.tx = args[4]
          def.ty = args[5]
          def.rot = Math.atan2(args[1], args[0])
        }
        break
    }
  }
  return def
}

export function serializeToSvg(doc: SvgDocument): string {
  const lines: string[] = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${doc.viewBox}" width="${doc.width}" height="${doc.height}">`)

  const hasDefs = doc.gradients.length > 0 || doc.patterns.length > 0 || doc.filters.length > 0
  if (hasDefs) {
    lines.push('  <defs>')
    for (const g of doc.gradients) {
      const stops = g.stops.map((s) => `      <stop offset="${Math.round(s.offset * 100)}%" stop-color="${s.color}" stop-opacity="${s.opacity}"/>`).join('\n')
      if (g.type === 'linear') {
        lines.push(`    <linearGradient id="${g.id}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">`)
        lines.push(stops)
        lines.push('    </linearGradient>')
      } else {
        lines.push(`    <radialGradient id="${g.id}" cx="${g.cx}" cy="${g.cy}" r="${g.r}">`)
        lines.push(stops)
        lines.push('    </radialGradient>')
      }
    }
    for (const p of doc.patterns) {
      lines.push(`    <pattern id="${p.id}" width="${p.width}" height="${p.height}" patternUnits="userSpaceOnUse">`)
      if (p.type === 'dots') {
        lines.push(`      <rect width="${p.width}" height="${p.height}" fill="${p.bgColor}"/>`)
        lines.push(`      <circle cx="${p.width / 2}" cy="${p.height / 2}" r="${Math.min(p.width, p.height) / 4}" fill="${p.fillColor}"/>`)
      } else if (p.type === 'stripes') {
        lines.push(`      <rect width="${p.width}" height="${p.height}" fill="${p.bgColor}"/>`)
        lines.push(`      <line x1="0" y1="0" x2="${p.width}" y2="${p.height}" stroke="${p.fillColor}" stroke-width="1"/>`)
      } else if (p.type === 'crosshatch') {
        lines.push(`      <rect width="${p.width}" height="${p.height}" fill="${p.bgColor}"/>`)
        lines.push(`      <line x1="0" y1="0" x2="${p.width}" y2="${p.height}" stroke="${p.fillColor}" stroke-width="1"/>`)
        lines.push(`      <line x1="${p.width}" y1="0" x2="0" y2="${p.height}" stroke="${p.fillColor}" stroke-width="1"/>`)
      } else if (p.type === 'checkerboard') {
        lines.push(`      <rect width="${p.width}" height="${p.height}" fill="${p.bgColor}"/>`)
        lines.push(`      <rect width="${p.width / 2}" height="${p.height / 2}" fill="${p.fillColor}"/>`)
        lines.push(`      <rect x="${p.width / 2}" y="${p.height / 2}" width="${p.width / 2}" height="${p.height / 2}" fill="${p.fillColor}"/>`)
      } else if (p.pathData) {
        lines.push(`      ${p.pathData}`)
      }
      lines.push('    </pattern>')
    }
    for (const f of doc.filters) {
      lines.push(`    <filter id="${f.id}">`)
      if (f.type === 'drop-shadow') {
        lines.push(`      <feDropShadow dx="${f.params.dx || 2}" dy="${f.params.dy || 2}" stdDeviation="${f.params.blurRadius || 4}" flood-color="${f.color || '#000'}" flood-opacity="${f.params.strength || 1}"/>`)
      } else if (f.type === 'blur') {
        lines.push(`      <feGaussianBlur stdDeviation="${f.params.stdDeviation || 4}"/>`)
      } else if (f.type === 'glow') {
        lines.push(`      <feGaussianBlur stdDeviation="${f.params.blurRadius || 4}" result="coloredBlur"/>`)
        lines.push(`      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>`)
      } else if (f.type === 'color-matrix' && f.matrix) {
        lines.push(`      <feColorMatrix type="matrix" values="${f.matrix.join(' ')}"/>`)
      }
      lines.push('    </filter>')
    }
    lines.push('  </defs>')
  }

  for (const el of doc.elements) {
    lines.push(serializeElement(el, '  '))
  }

  lines.push('</svg>')
  return lines.join('\n')
}

function serializeElement(el: SvgElement, indent: string): string {
  const tf = buildTransformString(el.transform)
  const style = buildStyleString(el.style)
  const fill = el.gradientId ? `url(#${el.gradientId})` : el.patternId ? `url(#${el.patternId})` : el.style.fill
  const filter = el.filterId ? `url(#${el.filterId})` : undefined

  const common = {
    id: el.id,
    fill,
    'fill-opacity': el.style.fillOpacity !== 1 ? el.style.fillOpacity : undefined,
    stroke: el.style.stroke !== 'none' ? el.style.stroke : undefined,
    'stroke-width': el.style.strokeWidth !== 1 ? el.style.strokeWidth : undefined,
    'stroke-opacity': el.style.strokeOpacity !== 1 ? el.style.strokeOpacity : undefined,
    opacity: el.style.opacity !== 1 ? el.style.opacity : undefined,
    filter,
    transform: tf || undefined,
    style: style || undefined,
  }

  const attrs = { ...common, ...el.attrs }
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')

  if (el.type === 'group') {
    if (el.children.length === 0) return `${indent}<g ${attrStr}/>`
    const children = el.children.map((cid) => {
      const child = findElement(el, cid)
      return child ? serializeElement(child, indent + '  ') : ''
    }).filter(Boolean)
    return `${indent}<g ${attrStr}>\n${children.join('\n')}\n${indent}</g>`
  }

  if (el.type === 'text') {
    return `${indent}<text ${attrStr}>${escapeXml(el.name)}</text>`
  }

  return `${indent}<${el.type} ${attrStr}/>`
}

function findElement(el: SvgElement, id: string): SvgElement | null {
  const stack = [el]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.id === id) return current
    stack.push(...current.children.map((c) => ({ id: c } as SvgElement)))
  }
  return null
}

function buildTransformString(tf: SvgTransform): string {
  const parts: string[] = []
  if (tf.tx !== 0 || tf.ty !== 0) parts.push(`translate(${tf.tx},${tf.ty})`)
  if (tf.sx !== 1 || tf.sy !== 1) parts.push(`scale(${tf.sx},${tf.sy})`)
  if (tf.rot !== 0) parts.push(`rotate(${(tf.rot * 180) / Math.PI})`)
  return parts.join(' ')
}

function buildStyleString(style: SvgElement['style']): string {
  const parts: string[] = []
  return parts.join(';')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function getElementBBox(el: SvgElement): BBox {
  const a = el.attrs
  const tf = el.transform

  let bbox: BBox
  switch (el.type) {
    case 'rect':
      bbox = { x: (a.x as number) || 0, y: (a.y as number) || 0, width: (a.width as number) || 0, height: (a.height as number) || 0 }
      break
    case 'circle': {
      const cx = (a.cx as number) || 0
      const cy = (a.cy as number) || 0
      const r = (a.r as number) || 0
      bbox = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
      break
    }
    case 'ellipse': {
      const cx = (a.cx as number) || 0
      const cy = (a.cy as number) || 0
      const rx = (a.rx as number) || 0
      const ry = (a.ry as number) || 0
      bbox = { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
      break
    }
    case 'line': {
      const x1 = (a.x1 as number) || 0
      const y1 = (a.y1 as number) || 0
      const x2 = (a.x2 as number) || 0
      const y2 = (a.y2 as number) || 0
      bbox = { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
      break
    }
    case 'text':
      bbox = { x: (a.x as number) || 0, y: (a.y as number) - ((a.fontSize as number) || 16), width: el.name.length * ((a.fontSize as number) || 16) * 0.6, height: (a.fontSize as number) || 16 }
      break
    case 'path':
      bbox = getPathBBox((a.d as string) || '')
      break
    default:
      bbox = { x: 0, y: 0, width: 0, height: 0 }
  }

  if (tf.tx !== 0 || tf.ty !== 0) {
    bbox.x += tf.tx
    bbox.y += tf.ty
  }

  return bbox
}

function getPathBBox(d: string): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const nums = d.match(/[-+]?\d*\.?\d+/g)
  if (!nums) return { x: 0, y: 0, width: 0, height: 0 }

  for (let i = 0; i < nums.length; i += 2) {
    const x = parseFloat(nums[i])
    const y = parseFloat(nums[i + 1])
    if (!isNaN(x) && !isNaN(y)) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function hitTestElement(el: SvgElement, mx: number, my: number, tolerance = 5): boolean {
  const bbox = getElementBBox(el)
  if (mx >= bbox.x - tolerance && mx <= bbox.x + bbox.width + tolerance &&
      my >= bbox.y - tolerance && my <= bbox.y + bbox.height + tolerance) {
    if (el.type === 'ellipse') {
      const cx = (el.attrs.cx as number) || 0
      const cy = (el.attrs.cy as number) || 0
      const rx = (el.attrs.rx as number) || 0
      const ry = (el.attrs.ry as number) || 0
      const dx = (mx - cx) / rx
      const dy = (my - cy) / ry
      return dx * dx + dy * dy <= 1
    }
    if (el.type === 'circle') {
      const cx = (el.attrs.cx as number) || 0
      const cy = (el.attrs.cy as number) || 0
      const r = (el.attrs.r as number) || 0
      return (mx - cx) ** 2 + (my - cy) ** 2 <= (r + tolerance) ** 2
    }
    return true
  }
  return false
}

export function findElementById(elements: SvgElement[], id: string): SvgElement | undefined {
  for (const el of elements) {
    if (el.id === id) return el
    if (el.children.length > 0) {
      const found = findElementById(el.children.map((cid) => elements.find((e) => e.id === cid)!).filter(Boolean), id)
      if (found) return found
    }
  }
  return undefined
}

export function getSelectionBBox(elements: SvgElement[], ids: Set<string>): BBox | null {
  let bbox: BBox | null = null
  for (const el of elements) {
    if (ids.has(el.id)) {
      const b = getElementBBox(el)
      if (!bbox) {
        bbox = b
      } else {
        bbox.x = Math.min(bbox.x, b.x)
        bbox.y = Math.min(bbox.y, b.y)
        bbox.width = Math.max(bbox.x + bbox.width, b.x + b.width) - bbox.x
        bbox.height = Math.max(bbox.y + bbox.height, b.y + b.height) - bbox.y
      }
    }
  }
  return bbox
}

export function getElementAtPoint(elements: SvgElement[], x: number, y: number): SvgElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (!el.visible || el.locked) continue
    if (hitTestElement(el, x, y)) return el
    if (el.children.length > 0) {
      const children = el.children.map((cid) => elements.find((e) => e.id === cid)!).filter(Boolean)
      const found = getElementAtPoint(children, x, y)
      if (found) return found
    }
  }
  return null
}

export function cloneElements(elements: SvgElement[]): SvgElement[] {
  return JSON.parse(JSON.stringify(elements))
}
