export const CAD_COLORS = {
  selection: '#3b82f6',
  selectionPulse: '#60a5fa',
  hover: '#60a5fa',
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',

  gizmoX: '#ef4444',
  gizmoY: '#22c55e',
  gizmoZ: '#3b82f6',
  gizmoAlpha: 0.5,

  sketchUnder: '#06b6d4',
  sketchFull: '#e2e8f0',
  sketchOver: '#ef4444',
  sketchConflicting: '#d946ef',

  snapPoint: '#facc15',
  snapLine: '#facc15',

  gridLight: '#94a3b8',
  gridDark: '#64748b',

  backgroundLight: '#f8fafc',
  backgroundDark: '#0f172a',

  panelBg: 'hsl(var(--cad-panel-bg, var(--background)))',
  panelBorder: 'hsl(var(--cad-panel-border, var(--border)))',
  panelHeader: 'hsl(var(--cad-panel-header, var(--muted)))',
} as const

export const CAD_THEME_CSS_VARS = `
  :root {
    --cad-panel-bg: 0 0% 100%;
    --cad-panel-border: 240 5.9% 90%;
    --cad-panel-header: 240 4.8% 95.9%;
  }
  .dark {
    --cad-panel-bg: 240 10% 3.9%;
    --cad-panel-border: 240 3.7% 15.9%;
    --cad-panel-header: 240 3.7% 15.9%;
  }
`
