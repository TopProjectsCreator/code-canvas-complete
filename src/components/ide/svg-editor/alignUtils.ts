import type { SvgElement, BBox } from './types'
import { getElementBBox } from './svgUtils'

type AlignMode = 'left' | 'center-x' | 'right' | 'top' | 'middle-y' | 'bottom'
type DistributeMode = 'horizontal' | 'vertical'

export function alignElements(
  elements: SvgElement[],
  ids: Set<string>,
  mode: AlignMode,
  canvasWidth: number,
  canvasHeight: number,
): SvgElement[] {
  const selected = elements.filter((e) => ids.has(e.id))
  if (selected.length === 0) return elements

  const bboxes = selected.map((e) => getElementBBox(e))
  const selBBox = combineBBoxes(bboxes)

  let targetValue: number
  switch (mode) {
    case 'left':
      targetValue = selBBox.x
      break
    case 'center-x':
      targetValue = selBBox.x + selBBox.width / 2
      break
    case 'right':
      targetValue = selBBox.x + selBBox.width
      break
    case 'top':
      targetValue = selBBox.y
      break
    case 'middle-y':
      targetValue = selBBox.y + selBBox.height / 2
      break
    case 'bottom':
      targetValue = selBBox.y + selBBox.height
      break
    default:
      return elements
  }

  const result = elements.map((el) => {
    if (!ids.has(el.id)) return el
    const bbox = getElementBBox(el)
    let dx = 0
    let dy = 0

    switch (mode) {
      case 'left':
        dx = targetValue - bbox.x
        break
      case 'center-x':
        dx = targetValue - (bbox.x + bbox.width / 2)
        break
      case 'right':
        dx = (targetValue - (bbox.x + bbox.width))
        break
      case 'top':
        dy = targetValue - bbox.y
        break
      case 'middle-y':
        dy = targetValue - (bbox.y + bbox.height / 2)
        break
      case 'bottom':
        dy = (targetValue - (bbox.y + bbox.height))
        break
    }

    return {
      ...el,
      transform: {
        ...el.transform,
        tx: el.transform.tx + dx,
        ty: el.transform.ty + dy,
      },
    }
  })

  return result
}

export function distributeElements(
  elements: SvgElement[],
  ids: Set<string>,
  mode: DistributeMode,
): SvgElement[] {
  const selected = elements.filter((e) => ids.has(e.id))
  if (selected.length < 3) return elements

  const sorted = [...selected].sort((a, b) => {
    const ba = getElementBBox(a)
    const bb = getElementBBox(b)
    return mode === 'horizontal' ? ba.x - bb.x : ba.y - bb.y
  })

  const bboxes = sorted.map((e) => getElementBBox(e))
  const first = bboxes[0]
  const last = bboxes[bboxes.length - 1]

  const totalSpace = mode === 'horizontal'
    ? (last.x + last.width) - first.x
    : (last.y + last.height) - first.y

  const totalElementSize = bboxes.reduce((sum, b) =>
    sum + (mode === 'horizontal' ? b.width : b.height), 0)

  const gap = (totalSpace - totalElementSize) / (sorted.length - 1)

  const result = elements.map((el) => {
    const idx = sorted.indexOf(el)
    if (idx < 0) return el

    const bbox = bboxes[idx]
    const targetPos = mode === 'horizontal'
      ? first.x + bboxes.slice(0, idx).reduce((s, b) => s + b.width, 0) + gap * idx
      : first.y + bboxes.slice(0, idx).reduce((s, b) => s + b.height, 0) + gap * idx

    const dx = mode === 'horizontal' ? targetPos - bbox.x : 0
    const dy = mode === 'vertical' ? targetPos - bbox.y : 0

    return {
      ...el,
      transform: {
        ...el.transform,
        tx: el.transform.tx + dx,
        ty: el.transform.ty + dy,
      },
    }
  })

  return result
}

function combineBBoxes(bboxes: BBox[]): BBox {
  if (bboxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of bboxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
