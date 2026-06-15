import type { Feature } from './types'

export interface FeatureTypeDef {
  type: string
  label: string
  category: 'sketch-based' | 'edge-based' | 'face-based' | 'body-based' | 'transform'
  icon: string
  defaultParams: Record<string, unknown>
}

export const FEATURE_TYPES: FeatureTypeDef[] = [
  { type: 'extrude', label: 'Extrude', category: 'sketch-based', icon: 'extrude', defaultParams: { depth: 10, direction: 'forward', mergeType: 'new-body' } },
  { type: 'revolve', label: 'Revolve', category: 'sketch-based', icon: 'revolve', defaultParams: { angle: 360, startAngle: 0, mergeType: 'new-body' } },
  { type: 'sweep', label: 'Sweep', category: 'sketch-based', icon: 'sweep', defaultParams: { solid: true, alignment: 'free', mergeType: 'new-body' } },
  { type: 'loft', label: 'Loft', category: 'sketch-based', icon: 'loft', defaultParams: { blend: 'smooth', closed: false, mergeType: 'new-body' } },
  { type: 'coil', label: 'Coil', category: 'sketch-based', icon: 'coil', defaultParams: { pitch: 5, revolutions: 5, direction: 'right', profile: 'rectangular', mergeType: 'new-body' } },
  { type: 'rib', label: 'Rib', category: 'sketch-based', icon: 'rib', defaultParams: { thickness: 5, direction: 'symmetric', extension: 'to-next' } },
  { type: 'fillet', label: 'Fillet', category: 'edge-based', icon: 'fillet', defaultParams: { radius: 2, mode: 'constant', tangentPropagation: true, overflow: 'default' } },
  { type: 'chamfer', label: 'Chamfer', category: 'edge-based', icon: 'chamfer', defaultParams: { mode: 'equal', distance1: 2, tangentPropagation: true } },
  { type: 'shell', label: 'Shell', category: 'face-based', icon: 'shell', defaultParams: { thickness: 2, direction: 'inside' } },
  { type: 'draft', label: 'Draft', category: 'face-based', icon: 'draft', defaultParams: { angle: 5, mode: 'face' } },
  { type: 'hole', label: 'Hole', category: 'sketch-based', icon: 'hole', defaultParams: { diameter: 5, depth: 10, holeType: 'simple', endCondition: 'blind', thread: { standard: 'iso', size: 'M5', pitch: 0.8, class: '6H', direction: 'right', modeled: false } } },
  { type: 'boolean', label: 'Boolean', category: 'body-based', icon: 'boolean', defaultParams: { operation: 'union', keepTools: false, tolerance: 0.001 } },
  { type: 'mirror', label: 'Mirror', category: 'transform', icon: 'mirror', defaultParams: { merge: true, weld: true, weldTolerance: 0.001 } },
  { type: 'pattern', label: 'Pattern', category: 'transform', icon: 'pattern', defaultParams: { patternType: 'linear', count1: 3, spacing1: 20 } },
  { type: 'emboss', label: 'Emboss', category: 'sketch-based', icon: 'emboss', defaultParams: { depth: 1, operation: 'emboss', direction: 'normal' } },
  { type: 'wrap', label: 'Wrap', category: 'sketch-based', icon: 'wrap', defaultParams: { depth: 1, direction: 'emboss', alignment: 'parallel' } },
  { type: 'split-body', label: 'Split Body', category: 'body-based', icon: 'split-body', defaultParams: { keepBoth: true } },
  { type: 'move-face', label: 'Move Face', category: 'face-based', icon: 'move-face', defaultParams: { copy: false, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } } },
  { type: 'suppress', label: 'Suppress', category: 'body-based', icon: 'suppress', defaultParams: { suppressedFeatureIds: [] } },
]

export const FEATURE_TYPE_MAP = new Map(FEATURE_TYPES.map(ft => [ft.type, ft]))

export function getFeatureLabel(feature: Feature): string {
  const def = FEATURE_TYPE_MAP.get(feature.type)
  return def?.label ?? feature.type
}

export function getFeatureCategory(feature: Feature): string {
  const def = FEATURE_TYPE_MAP.get(feature.type)
  return def?.category ?? 'body-based'
}

export function createDefaultFeature(type: string, bodyId: string): Feature | null {
  const def = FEATURE_TYPE_MAP.get(type)
  if (!def) return null
  return {
    id: `feat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: def.label,
    type: def.type,
    visible: true,
    suppressed: false,
    bodyId,
    featureIndex: 0,
    dependencies: [],
    ...def.defaultParams,
  } as unknown as Feature
}
