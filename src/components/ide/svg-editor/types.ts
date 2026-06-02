export type ElementType = 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'text' | 'group' | 'image'

export type ToolMode = 'select' | 'rect' | 'circle' | 'ellipse' | 'line' | 'text' | 'path' | 'freehand'

export type FilterType = 'drop-shadow' | 'blur' | 'glow' | 'color-matrix'

export type GradientType = 'linear' | 'radial'

export type PatternStyle = 'dots' | 'stripes' | 'crosshatch' | 'checkerboard' | 'custom'

export interface SvgTransform {
  tx: number
  ty: number
  sx: number
  sy: number
  rot: number
}

export interface SvgElement {
  id: string
  type: ElementType
  name: string
  attrs: Record<string, string | number>
  style: {
    fill: string
    fillOpacity: number
    stroke: string
    strokeWidth: number
    strokeOpacity: number
    opacity: number
  }
  gradientId?: string
  patternId?: string
  filterId?: string
  transform: SvgTransform
  visible: boolean
  locked: boolean
  children: string[]
  editable?: boolean
}

export interface SvgGradient {
  id: string
  type: GradientType
  x1: number
  y1: number
  x2: number
  y2: number
  cx: number
  cy: number
  r: number
  stops: SvgGradientStop[]
}

export interface SvgGradientStop {
  offset: number
  color: string
  opacity: number
}

export interface SvgPattern {
  id: string
  type: PatternStyle
  width: number
  height: number
  fillColor: string
  bgColor: string
  pathData?: string
}

export interface SvgFilter {
  id: string
  type: FilterType
  params: Record<string, number>
  color?: string
  matrix?: number[]
}

export type SegmentType = 'M' | 'L' | 'C' | 'Q' | 'A' | 'Z'

export interface PathSegment {
  type: SegmentType
  points: number[]
  absolute: boolean
}

export interface SvgDocument {
  width: number
  height: number
  viewBox: string
  elements: SvgElement[]
  gradients: SvgGradient[]
  patterns: SvgPattern[]
  filters: SvgFilter[]
}

export interface HistoryEntry {
  elements: SvgElement[]
  gradients: SvgGradient[]
  patterns: SvgPattern[]
  filters: SvgFilter[]
}

export interface EditorState {
  doc: SvgDocument
  selectedIds: Set<string>
  toolMode: ToolMode
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  showSource: boolean
  sourceCode: string
  drawing: boolean
  drawStart: { x: number; y: number } | null
  drawCurrent: { x: number; y: number } | null
  pathPoints: { x: number; y: number }[]
  editingTextId: string | null
  guideLines: GuideLine[]
  activeGradientId: string | null
  activeFilterId: string | null
  activePatternId: string | null
}

export interface GuideLine {
  axis: 'horizontal' | 'vertical'
  value: number
  label?: string
  color?: string
}

export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_DOCUMENT: SvgDocument = {
  width: 800,
  height: 600,
  viewBox: '0 0 800 600',
  elements: [],
  gradients: [],
  patterns: [],
  filters: [],
}

export const COLOR_PRESETS = [
  '#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#0066ff',
  '#6600cc', '#cc0066', '#000000', '#666666', '#cccccc',
  '#ffffff', '#ff9999', '#99ccff', '#99ff99', '#ffcc99',
]

export const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 12, 16]

export const FONT_SIZES = [12, 14, 16, 18, 24, 32, 48, 64, 72]

export const COLOR_MATRIX_PRESETS: Record<string, number[]> = {
  grayscale: [0.33, 0.34, 0.33, 0, 0, 0.33, 0.34, 0.33, 0, 0, 0.33, 0.34, 0.33, 0, 0, 0, 0, 0, 1, 0],
  sepia: [0.39, 0.34, 0.27, 0, 0, 0.35, 0.31, 0.25, 0, 0, 0.27, 0.24, 0.19, 0, 0, 0, 0, 0, 1, 0],
  invert: [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0],
  brightness: [1.5, 0, 0, 0, 0, 0, 1.5, 0, 0, 0, 0, 0, 1.5, 0, 0, 0, 0, 0, 1, 0],
  contrast: [2, 0, 0, 0, -0.5, 0, 2, 0, 0, -0.5, 0, 0, 2, 0, -0.5, 0, 0, 0, 1, 0],
}

let _idCounter = 0
export function generateId(prefix = 'svg'): string {
  return `${prefix}-${++_idCounter}-${Math.random().toString(36).slice(2, 6)}`
}

export function resetIdCounter() {
  _idCounter = 0
}
