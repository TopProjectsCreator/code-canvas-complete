import type { PathSegment } from './types'

export function parsePathD(d: string): PathSegment[] {
  const segments: PathSegment[] = []
  const re = /([MLQCASZ])\s*([-\d.,\s]*)/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(d)) !== null) {
    const type = match[1].toUpperCase() as PathSegment['type']
    const isAbsolute = match[1] === match[1].toUpperCase()
    const nums = match[2].trim()
      ? match[2].trim().split(/[\s,]+/).map(Number)
      : []

    if (type === 'M' || type === 'L') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        segments.push({ type, points: [nums[i], nums[i + 1]], absolute: isAbsolute })
      }
    } else if (type === 'C') {
      for (let i = 0; i + 5 < nums.length; i += 6) {
        segments.push({
          type,
          points: [nums[i], nums[i + 1], nums[i + 2], nums[i + 3], nums[i + 4], nums[i + 5]],
          absolute: isAbsolute,
        })
      }
    } else if (type === 'Q') {
      for (let i = 0; i + 3 < nums.length; i += 4) {
        segments.push({
          type,
          points: [nums[i], nums[i + 1], nums[i + 2], nums[i + 3]],
          absolute: isAbsolute,
        })
      }
    } else if (type === 'A') {
      for (let i = 0; i + 6 < nums.length; i += 7) {
        segments.push({
          type,
          points: [nums[i], nums[i + 1], nums[i + 2], nums[i + 3], nums[i + 4], nums[i + 5], nums[i + 6]],
          absolute: isAbsolute,
        })
      }
    } else if (type === 'Z') {
      segments.push({ type: 'Z', points: [], absolute: isAbsolute })
    }
  }

  return segments
}

export function segmentsToPathD(segments: PathSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === 'Z') return 'Z'
      const t = seg.absolute ? seg.type : seg.type.toLowerCase()
      return `${t}${seg.points.map((p) => {
        const s = Math.round(p * 100) / 100
        return s === Math.floor(s) ? s.toString() : s.toFixed(2)
      }).join(' ')}`
    })
    .join(' ')
}

export interface ControlPoints {
  anchor: { x: number; y: number }
  cp1?: { x: number; y: number }
  cp2?: { x: number; y: number }
}

export function getSegmentControlPoints(
  segments: PathSegment[],
  index: number,
  prevPoint?: { x: number; y: number },
): ControlPoints | null {
  const seg = segments[index]
  if (!seg) return null
  const pts = seg.points

  if (seg.type === 'M' || seg.type === 'L') {
    return { anchor: { x: pts[0], y: pts[1] } }
  }

  if (seg.type === 'C') {
    return {
      cp1: { x: pts[0], y: pts[1] },
      cp2: { x: pts[2], y: pts[3] },
      anchor: { x: pts[4], y: pts[5] },
    }
  }

  if (seg.type === 'Q') {
    return {
      cp1: { x: pts[0], y: pts[1] },
      anchor: { x: pts[2], y: pts[3] },
    }
  }

  if (seg.type === 'A') {
    return { anchor: { x: pts[5], y: pts[6] } }
  }

  return null
}

export function getSegmentAnchors(segments: PathSegment[]): { x: number; y: number }[] {
  const anchors: { x: number; y: number }[] = []
  let prevX = 0, prevY = 0

  for (const seg of segments) {
    const pts = seg.points
    if (seg.type === 'M' || seg.type === 'L') {
      if (pts.length >= 2) {
        anchors.push({ x: pts[0], y: pts[1] })
        prevX = pts[0]
        prevY = pts[1]
      }
    } else if (seg.type === 'C') {
      if (pts.length >= 6) {
        anchors.push({ x: pts[4], y: pts[5] })
        prevX = pts[4]
        prevY = pts[5]
      }
    } else if (seg.type === 'Q') {
      if (pts.length >= 4) {
        anchors.push({ x: pts[2], y: pts[3] })
        prevX = pts[2]
        prevY = pts[3]
      }
    } else if (seg.type === 'A') {
      if (pts.length >= 7) {
        anchors.push({ x: pts[5], y: pts[6] })
        prevX = pts[5]
        prevY = pts[6]
      }
    }
  }

  return anchors
}

export function updateSegmentPoint(
  segments: PathSegment[],
  segIndex: number,
  pointIndex: number,
  x: number,
  y: number,
): PathSegment[] {
  const result = segments.map((s) => ({ ...s, points: [...s.points] }))
  const seg = result[segIndex]
  if (!seg) return result

  const pi = pointIndex * 2
  if (pi < seg.points.length) seg.points[pi] = x
  if (pi + 1 < seg.points.length) seg.points[pi + 1] = y

  return result
}

export function insertPointInPath(
  segments: PathSegment[],
  clickX: number,
  clickY: number,
): PathSegment[] {
  let minDist = Infinity
  let bestSegIndex = -1
  let bestT = 0.5
  let prevX = 0, prevY = 0

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const pts = seg.points

    if (seg.type === 'M') {
      prevX = pts[0]
      prevY = pts[1]
      continue
    }

    if (seg.type === 'L' && pts.length >= 2) {
      const dist = pointToSegmentDist(clickX, clickY, prevX, prevY, pts[0], pts[1])
      if (dist.t < minDist) {
        minDist = dist.t
        bestSegIndex = i
        bestT = dist.t
      }
      prevX = pts[0]
      prevY = pts[1]
    } else if (seg.type === 'C' && pts.length >= 6) {
      for (let t = 0; t <= 1; t += 0.05) {
        const p = cubicBezierPoint(prevX, prevY, pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], t)
        const d = Math.sqrt((clickX - p.x) ** 2 + (clickY - p.y) ** 2)
        if (d < minDist) {
          minDist = d
          bestSegIndex = i
          bestT = t
        }
      }
      prevX = pts[4]
      prevY = pts[5]
    } else if (seg.type === 'Q' && pts.length >= 4) {
      for (let t = 0; t <= 1; t += 0.05) {
        const p = quadBezierPoint(prevX, prevY, pts[0], pts[1], pts[2], pts[3], t)
        const d = Math.sqrt((clickX - p.x) ** 2 + (clickY - p.y) ** 2)
        if (d < minDist) {
          minDist = d
          bestSegIndex = i
          bestT = t
        }
      }
      prevX = pts[2]
      prevY = pts[3]
    }
  }

  if (bestSegIndex < 0) return segments

  const seg = segments[bestSegIndex]
  const result = [...segments]

  if (seg.type === 'L') {
    const [ax, ay] = getPreviousAnchor(segments, bestSegIndex)
    const p = lerpPoint(ax, ay, seg.points[0], seg.points[1], bestT)
    result.splice(bestSegIndex, 1,
      { type: 'L', points: [p.x, p.y], absolute: true },
      { type: 'L', points: [seg.points[0], seg.points[1]], absolute: true },
    )
  } else if (seg.type === 'C') {
    const [ax, ay] = getPreviousAnchor(segments, bestSegIndex)
    const p1 = cubicBezierPoint(ax, ay, seg.points[0], seg.points[1], seg.points[2], seg.points[3], seg.points[4], seg.points[5], bestT - 0.05)
    const p2 = cubicBezierPoint(ax, ay, seg.points[0], seg.points[1], seg.points[2], seg.points[3], seg.points[4], seg.points[5], bestT + 0.05)
    const split = cubicSplit(ax, ay, seg.points[0], seg.points[1], seg.points[2], seg.points[3], seg.points[4], seg.points[5], bestT)
    if (split) {
      result.splice(bestSegIndex, 1,
        { type: 'C', points: [...split.left], absolute: true },
        { type: 'C', points: [...split.right], absolute: true },
      )
    }
  }

  return result
}

export function deletePointFromPath(
  segments: PathSegment[],
  anchorIndex: number,
): PathSegment[] {
  let count = 0
  const result: PathSegment[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.type === 'M' || seg.type === 'L') {
      if (count === anchorIndex) continue
      count++
    } else if (seg.type === 'C') {
      if (count === anchorIndex) {
        count++
        continue
      }
      count++
    } else if (seg.type === 'Q') {
      if (count === anchorIndex) {
        count++
        continue
      }
      count++
    }
    result.push(seg)
  }

  return result.length > 0 ? result : segments
}

export function getPreviousAnchor(
  segments: PathSegment[],
  index: number,
): [number, number] {
  for (let i = index - 1; i >= 0; i--) {
    const pts = segments[i].points
    if (pts.length >= 2) return [pts[pts.length - 2], pts[pts.length - 1]]
  }
  return [0, 0]
}

function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { dist: number; t: number } {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { dist: Math.sqrt((px - ax) ** 2 + (py - ay) ** 2), t: 0 }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const nearX = ax + t * dx
  const nearY = ay + t * dy
  return { dist: Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2), t }
}

function lerpPoint(
  ax: number, ay: number,
  bx: number, by: number,
  t: number,
): { x: number; y: number } {
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t }
}

function cubicBezierPoint(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  dx: number, dy: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: mt3 * ax + 3 * mt2 * t * bx + 3 * mt * t2 * cx + t3 * dx,
    y: mt3 * ay + 3 * mt2 * t * by + 3 * mt * t2 * cy + t3 * dy,
  }
}

function quadBezierPoint(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  return {
    x: mt2 * ax + 2 * mt * t * bx + t2 * cx,
    y: mt2 * ay + 2 * mt * t * by + t2 * cy,
  }
}

function cubicSplit(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  dx: number, dy: number,
  t: number,
): { left: number[]; right: number[] } | null {
  const p1x = ax + (bx - ax) * t
  const p1y = ay + (by - ay) * t
  const p2x = bx + (cx - bx) * t
  const p2y = by + (cy - by) * t
  const p3x = cx + (dx - cx) * t
  const p3y = cy + (dy - cy) * t
  const p4x = p1x + (p2x - p1x) * t
  const p4y = p1y + (p2y - p1y) * t
  const p5x = p2x + (p3x - p2x) * t
  const p5y = p2y + (p3y - p2y) * t
  const p6x = p4x + (p5x - p4x) * t
  const p6y = p4y + (p5y - p4y) * t

  return {
    left: [ax, ay, p1x, p1y, p4x, p4y, p6x, p6y],
    right: [p6x, p6y, p5x, p5y, p3x, p3y, dx, dy],
  }
}
