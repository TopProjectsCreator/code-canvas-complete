export const CAD_DOCUMENT_VERSION = 1
export const CAD_APP_VERSION = '0.1.0'

export const GRID_DEFAULTS = {
  cellSize: 10,
  sectionSize: 100,
  extent: 1000,
  color: '#94a3b8',
  sectionColor: '#64748b',
  axisColor: '#475569',
} as const

export const TOLERANCE = {
  default: 1e-6,
  welding: 1e-3,
  chordal: 0.01,
  angle: 0.001,
} as const

export const DEFAULT_BACKGROUNDS = {
  light: '#f8fafc',
  dark: '#0f172a',
} as const

export const UNIT_LABELS: Record<string, string> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  in: '"',
  ft: '\'',
  um: 'µm',
}

export const UNIT_SCALES: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
  um: 0.001,
}
