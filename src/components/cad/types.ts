export interface Transform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  pivot?: [number, number, number]
}

export type SketchEntityType =
  | 'line' | 'circle' | 'arc' | 'rectangle' | 'polygon' | 'spline'
  | 'ellipse' | 'parabola' | 'hyperbola' | 'helix' | 'spiral'
  | 'slot' | 'keyhole' | 'gear-tooth' | 'text' | 'reference-line'
  | 'reference-point' | 'offset-curve' | 'projected-edge'
  | 'construction-line' | 'construction-circle'

export interface SketchEntity {
  id: string
  type: SketchEntityType
  params: Record<string, unknown>
  construction: boolean
  locked: boolean
  layer: string
}

export type ConstraintType =
  | 'horizontal' | 'vertical' | 'parallel' | 'perpendicular'
  | 'tangent' | 'coincident' | 'concentric' | 'equal'
  | 'collinear' | 'symmetric' | 'midpoint' | 'fix'
  | 'fix-angle' | 'distance-h' | 'distance-v' | 'distance-aligned'
  | 'angle' | 'radius' | 'diameter' | 'arc-length'
  | 'perimeter' | 'area' | 'equal-curvature'
  | 'fix-length' | 'lock'

export interface Constraint {
  id: string
  type: ConstraintType
  entityIds: string[]
  params?: Record<string, number | string>
  driving: boolean
  expression?: string
  error?: number
}

export interface Dimension {
  id: string
  entityId: string
  value: number
  precision: number
}

export interface Sketch {
  id: string
  plane: PlaneRef
  entities: Record<string, SketchEntity>
  constraints: Constraint[]
  dimensions: Record<string, Dimension>
  solverState: {
    dof: number
    status: 'under' | 'full' | 'over' | 'conflicting'
    errors: Record<string, number>
  }
}

export type PlaneRef =
  | { type: 'standard'; plane: 'xy' | 'xz' | 'yz' }
  | { type: 'offset'; plane: 'xy' | 'xz' | 'yz'; offset: number }
  | { type: 'face'; bodyId: string; faceIndex: number }
  | { type: 'custom'; origin: [number, number, number]; normal: [number, number, number]; xAxis: [number, number, number] }

export interface BaseFeature {
  id: string
  name: string
  type: string
  visible: boolean
  suppressed: boolean
  color?: string
  bodyId: string
  featureIndex: number
  dependencies: string[]
}

export interface ExtrudeFeature extends BaseFeature {
  type: 'extrude'
  sketchId: string
  direction: 'forward' | 'reverse' | 'symmetric'
  endCondition: 'blind' | 'through-all' | 'to-face' | 'to-surface' | 'to-vertex' | 'offset-from-face'
  depth?: number
  faceId?: string
  offset?: number
  taperAngle?: number
  mergeType: 'new-body' | 'add' | 'subtract' | 'intersect'
  targetBodyId?: string
  thinWall?: { thickness: number; direction: 'inside' | 'outside' | 'both' }
}

export interface RevolveFeature extends BaseFeature {
  type: 'revolve'
  sketchId: string
  axis: AxisRef
  angle: number
  startAngle: number
  endCondition: 'blind' | 'to-face' | 'to-surface'
  mergeType: 'new-body' | 'add' | 'subtract' | 'intersect'
  thinWall?: { thickness: number }
}

export interface SweepFeature extends BaseFeature {
  type: 'sweep'
  profileSketchId: string
  pathSketchId: string
  guideCurves?: string[]
  twistAngle?: number
  twistStep?: number
  scaleFactor?: number
  scaleType?: 'constant' | 'taper' | 'curve'
  solid: boolean
  alignment: 'free' | 'fixed' | 'parallel'
  mergeType: 'new-body' | 'add' | 'subtract'
}

export interface LoftFeature extends BaseFeature {
  type: 'loft'
  sectionIds: string[]
  guideCurves?: string[]
  centerlineId?: string
  blend: 'straight' | 'smooth' | 'continuous'
  closed: boolean
  mergeType: 'new-body' | 'add' | 'subtract'
  thinWall?: { thickness: number }
}

export interface CoilFeature extends BaseFeature {
  type: 'coil'
  sketchId: string
  axis: AxisRef
  pitch: number
  revolutions: number
  height: number
  direction: 'right' | 'left'
  taperAngle?: number
  profile: 'rectangular' | 'trapezoidal' | 'round' | 'custom'
  profileParams: Record<string, number>
  mergeType: 'new-body' | 'add' | 'subtract'
}

export interface RibFeature extends BaseFeature {
  type: 'rib'
  sketchId: string
  thickness: number
  direction: 'side1' | 'side2' | 'symmetric'
  draftAngle?: number
  extension: 'to-surface' | 'to-next' | 'limited'
  depth?: number
}

export interface FilletFeature extends BaseFeature {
  type: 'fillet'
  edges: EdgeRef[]
  radius: number
  radii?: Record<string, number>
  mode: 'constant' | 'variable' | 'full-round' | 'face-blend'
  blendType: 'circular' | 'conic' | 'curvature-continuous'
  tangentPropagation: boolean
  overflow: 'default' | 'preserve-adjacent' | 'roll-along' | 'straight'
}

export interface ChamferFeature extends BaseFeature {
  type: 'chamfer'
  edges: EdgeRef[]
  mode: 'equal' | 'two-distance' | 'distance-angle' | 'vertex'
  distance1: number
  distance2?: number
  angle?: number
  tangentPropagation: boolean
}

export interface ShellFeature extends BaseFeature {
  type: 'shell'
  thickness: number
  thicknesses?: Record<string, number>
  openFaces: FaceRef[]
  direction: 'inside' | 'outside' | 'both'
}

export interface DraftFeature extends BaseFeature {
  type: 'draft'
  faces: FaceRef[]
  neutralPlane: PlaneRef
  pullDirection: [number, number, number]
  angle: number
  mode: 'face' | 'neutral-plane' | 'parting-line' | 'step'
  partingLineId?: string
}

export interface ThreadSpec {
  standard: 'iso' | 'unc' | 'unf' | 'bsp' | 'npt' | 'custom'
  size: string
  pitch: number
  class: string
  direction: 'right' | 'left'
  modeled: boolean
}

export interface HoleFeature extends BaseFeature {
  type: 'hole'
  sketchId: string
  holeType: 'simple' | 'counterbore' | 'countersink' | 'cbore-csink' | 'tapped' | 'clearance' | 'tapered'
  diameter: number
  depth: number
  endCondition: 'blind' | 'through-all' | 'to-face'
  cboreDiameter?: number
  cboreDepth?: number
  csinkDiameter?: number
  csinkAngle?: number
  thread: ThreadSpec
  faceId?: string
}

export interface BooleanFeature extends BaseFeature {
  type: 'boolean'
  operation: 'union' | 'subtract' | 'intersect' | 'split' | 'slice' | 'xor' | 'fragment'
  targetBodyId: string
  toolBodyIds: string[]
  keepTools: boolean
  tolerance: number
}

export interface MirrorFeature extends BaseFeature {
  type: 'mirror'
  bodyIds: string[]
  mirrorPlane: PlaneRef
  merge: boolean
  weld: boolean
  weldTolerance: number
}

export interface PatternFeature extends BaseFeature {
  type: 'pattern'
  patternType: 'linear' | 'circular' | 'curve' | 'fill' | 'mirror'
  bodyIds: string[]
  direction1?: [number, number, number]
  count1?: number
  spacing1?: number
  direction2?: [number, number, number]
  count2?: number
  spacing2?: number
  stagger?: 'none' | 'odd' | 'even'
  axis?: AxisRef
  angle?: number
  count?: number
  equispaced?: boolean
  instanceRotation?: boolean
  curveId?: string
  alignToCurve?: boolean
  startOffset?: number
  endOffset?: number
  scaleMode?: 'none' | 'uniform' | 'curve'
  fillBoundaryId?: string
  fillLayout?: 'grid' | 'hexagon' | 'triangle'
  spacing?: number
  mirrorPlanes?: PlaneRef[]
  instanceVariation?: {
    scale?: [number, number]
    rotation?: [number, number]
    seed: number
  }
}

export interface EmbossFeature extends BaseFeature {
  type: 'emboss'
  sketchId: string
  bodyId: string
  operation: 'emboss' | 'deboss' | 'engrave'
  depth: number
  draftAngle?: number
  direction: 'normal' | 'reverse' | 'symmetric'
}

export interface WrapFeature extends BaseFeature {
  type: 'wrap'
  sketchId: string
  bodyId: string
  faceIds?: FaceRef[]
  depth: number
  direction: 'emboss' | 'deboss' | 'engrave' | 'score'
  alignment: 'parallel' | 'normal'
}

export interface SplitBodyFeature extends BaseFeature {
  type: 'split-body'
  bodyId: string
  toolPlane: PlaneRef
  keepBoth: boolean
  colorSplit?: string
}

export interface MoveFaceFeature extends BaseFeature {
  type: 'move-face'
  faces: FaceRef[]
  transform: Transform
  copy: boolean
}

export interface SuppressFeature extends BaseFeature {
  type: 'suppress'
  suppressedFeatureIds: string[]
}

export interface PrimitiveFeature extends BaseFeature {
  type: 'primitive'
  primitiveType: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane'
  params: Record<string, number>
}

export type Feature =
  | PrimitiveFeature | ExtrudeFeature | RevolveFeature | SweepFeature | LoftFeature
  | CoilFeature | RibFeature | FilletFeature | ChamferFeature
  | ShellFeature | DraftFeature | HoleFeature | BooleanFeature
  | MirrorFeature | PatternFeature | EmbossFeature | WrapFeature
  | SplitBodyFeature | MoveFaceFeature | SuppressFeature

export interface MassProperties {
  volume: number
  surfaceArea: number
  mass: number
  centerOfMass: [number, number, number]
  inertiaTensor: [[number, number, number], [number, number, number], [number, number, number]]
}

export interface Body {
  id: string
  name: string
  features: Feature[]
  materialId?: string
  appearance: BodyAppearance
  massProperties?: MassProperties
}

export interface BodyAppearance {
  color: string
  opacity: number
  roughness: number
  metalness: number
  visible: boolean
  transparency: number
}

export interface MaterialDef {
  id: string
  name: string
  category: string
  color: string
  roughness: number
  metalness: number
  opacity: number
  emissive?: string
  emissiveIntensity?: number
  clearcoat?: number
  clearcoatRoughness?: number
  ior?: number
  transmission?: number
  thickness?: number
  normalMap?: string
  normalScale?: number
  aoMap?: string
  roughnessMap?: string
  metalnessMap?: string
  displacementMap?: string
  displacementScale?: number
  envMapIntensity?: number
  side: 'front' | 'back' | 'double'
  blendMode: 'opaque' | 'transparent' | 'additive'
}

export interface SceneNode {
  id: string
  name: string
  visible: boolean
  locked: boolean
  selectable: boolean
  transform: Transform
  bodyId: string | null
  children: SceneNode[]
  parentId: string | null
  materialId?: string
  metadata?: Record<string, string>
  instanceOf?: string
}

export interface ConstructionPlane {
  id: string
  name: string
  origin: [number, number, number]
  normal: [number, number, number]
  xAxis: [number, number, number]
  visualSize: number
  reference: boolean
}

export interface ConstructionAxis {
  id: string
  name: string
  type: 'line' | 'axis'
  origin: [number, number, number]
  direction: [number, number, number]
  reference: boolean
}

export interface ConstructionPoint {
  id: string
  name: string
  position: [number, number, number]
  reference: boolean
}

export interface ConstructionCoordinateSystem {
  id: string
  name: string
  origin: [number, number, number]
  xAxis: [number, number, number]
  yAxis: [number, number, number]
  zAxis: [number, number, number]
}

export interface CadDocument {
  version: number
  bodies: Record<string, Body>
  scene: SceneNode[]
  sketches: Record<string, Sketch>
  constructionPlanes: Record<string, ConstructionPlane>
  constructionAxes: Record<string, ConstructionAxis>
  constructionPoints: Record<string, ConstructionPoint>
  constructionCSys: Record<string, ConstructionCoordinateSystem>
  materials: Record<string, MaterialDef>
  assembly?: AssemblyDef
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'um'
  precision: number
  angleUnits: 'degrees' | 'radians'
  metadata: {
    name: string
    description: string
    author: string
    createdAt: string
    modifiedAt: string
    version: number
    appVersion: string
  }
}

export interface AssemblyDef {
  joints: Joint[]
  mates: Mate[]
  explodedView?: ExplodedView
}

export interface Joint {
  id: string
  type: 'rigid' | 'revolute' | 'cylindrical' | 'prismatic' | 'planar' | 'spherical' | 'ball' | 'slot' | 'universal'
  sourceNodeId: string
  targetNodeId: string
  sourceTransform: Transform
  targetTransform: Transform
  limits?: {
    min?: number
    max?: number
    current?: number
  }[]
  friction?: number
  stiffness?: number
}

export interface Mate {
  id: string
  type: 'coincident' | 'parallel' | 'perpendicular' | 'tangent' | 'concentric' | 'distance' | 'angle' | 'symmetric' | 'width' | 'path' | 'gear' | 'rack-pinion' | 'screw'
  sourceEntity: SelectionTarget
  targetEntity: SelectionTarget
  distance?: number
  angle?: number
  flip?: boolean
  locked?: boolean
  ratio?: number
  offset?: number
}

export interface ExplodedView {
  steps: ExplodeStep[]
  lines: ExplodeLine[]
}

export interface ExplodeStep {
  id: string
  nodeIds: string[]
  translation: [number, number, number]
  rotation: [number, number, number]
}

export interface ExplodeLine {
  start: [number, number, number]
  end: [number, number, number]
}

export interface SimulationSetup {
  type: 'static' | 'modal' | 'thermal' | 'buckling' | 'cfd'
  mesh: MeshSettings
  loads: Load[]
  constraints: SimulationConstraint[]
  materials: Record<string, SimulationMaterial>
  solver: SolverSettings
  results?: SimulationResults
}

export interface MeshSettings {
  elementType: 'tetrahedral' | 'hexahedral' | 'mixed'
  maxElementSize: number
  minElementSize: number
  curvatureRefinement: number
  adaptive: boolean
  localRefinements: { bodyId: string; size: number }[]
  qualityMetrics: boolean
}

export interface Load {
  id: string
  type: 'force' | 'pressure' | 'torque' | 'moment' | 'gravity' | 'acceleration' | 'centrifugal' | 'bearing'
  targetId: string
  targetType: 'face' | 'edge' | 'vertex' | 'body'
  value: number
  direction?: [number, number, number]
  distribution?: 'uniform' | 'parabolic' | 'sinusoidal'
}

export interface SimulationConstraint {
  id: string
  type: 'fixed' | 'roller' | 'slider' | 'pinned' | 'displacement' | 'remote'
  targetId: string
  targetType: 'face' | 'edge' | 'vertex' | 'body'
  dof: [boolean, boolean, boolean, boolean, boolean, boolean]
  displacement?: [number, number, number, number, number, number]
}

export interface SimulationMaterial {
  bodyId: string
  youngsModulus: number
  poissonRatio: number
  density: number
  yieldStrength: number
  thermalConductivity: number
  specificHeat: number
  thermalExpansion: number
}

export interface SolverSettings {
  method: 'direct' | 'iterative'
  tolerance: number
  maxIterations: number
  symmetry: 'none' | 'planar' | 'cyclic'
  threads: number
  precision: 'single' | 'double'
}

export interface SimulationResults {
  status: 'solved' | 'failed' | 'partial'
  displacement?: ResultField
  stress?: ResultField
  strain?: ResultField
  temperature?: ResultField
  heatFlux?: ResultField
  modes?: ModalResult[]
  bucklingFactors?: number[]
  flowVelocity?: ResultField
  flowPressure?: ResultField
  mass: number
  volume: number
}

export interface ResultField {
  nodeValues: Float32Array
  min: number
  max: number
  unit: string
}

export interface ModalResult {
  modeNumber: number
  frequency: number
  displacement: ResultField
}

export interface RenderSettings {
  width: number
  height: number
  samples: number
  bounces: number
  denoiser: boolean
  environment: string
  cameraId: string
  passes: string[]
  outputFormat: 'png' | 'jpg' | 'exr'
  outputColorSpace: 'srgb' | 'linear' | 'aces'
}

export interface AnimationData {
  duration: number
  fps: number
  tracks: AnimationTrack[]
}

export interface AnimationTrack {
  targetId: string
  property: 'position' | 'rotation' | 'scale' | 'material.color' | 'material.opacity' | 'visibility'
  keyframes: Keyframe[]
  interpolation: 'linear' | 'bezier' | 'step' | 'ease-in' | 'ease-out' | 'ease-in-out'
  extrapolation: 'constant' | 'extend' | 'cycle' | 'cycle-relative' | 'oscillate'
}

export interface Keyframe {
  time: number
  value: unknown
  inTangent?: [number, number]
  outTangent?: [number, number]
}

export type ToolMode =
  | 'select'
  | 'move' | 'rotate' | 'scale'
  | 'sketch'
  | 'extrude' | 'revolve' | 'sweep' | 'loft' | 'coil'
  | 'rib' | 'fillet' | 'chamfer' | 'shell' | 'draft' | 'hole' | 'thread'
  | 'boolean'
  | 'mirror' | 'pattern'
  | 'emboss' | 'wrap' | 'thicken'
  | 'split-body' | 'move-face' | 'suppress'
  | 'measure'
  | 'mesh-vertex' | 'mesh-edge' | 'mesh-face'
  | 'sculpt'
  | 'nurbs-curve' | 'nurbs-surface'
  | 'sheet-metal'
  | 'assembly-joint' | 'assembly-mate'
  | 'material'
  | 'section-view'
  | 'annotate-3d'
  | 'probe'

export type SelectionTarget =
  | { type: 'node'; nodeId: string }
  | { type: 'body'; bodyId: string }
  | { type: 'feature'; featureId: string }
  | { type: 'face'; bodyId: string; faceIndex: number }
  | { type: 'edge'; bodyId: string; edgeIndex: number }
  | { type: 'vertex'; bodyId: string; vertexIndex: number }
  | { type: 'sketch-entity'; sketchId: string; entityId: string }
  | { type: 'sketch-constraint'; sketchId: string; constraintId: string }
  | { type: 'construction-plane'; planeId: string }
  | { type: 'construction-axis'; axisId: string }
  | { type: 'construction-point'; pointId: string }
  | { type: 'construction-csys'; csysId: string }

export type AxisRef =
  | { type: 'standard'; axis: 'x' | 'y' | 'z' }
  | { type: 'edge'; bodyId: string; edgeIndex: number }
  | { type: 'face-axis'; bodyId: string; faceIndex: number }
  | { type: 'custom'; origin: [number, number, number]; direction: [number, number, number] }
  | { type: 'construction-axis'; axisId: string }
  | { type: 'two-points'; point1: [number, number, number]; point2: [number, number, number] }

export interface EdgeRef { bodyId: string; edgeIndex: number; edgeLoop?: number[] }
export interface FaceRef { bodyId: string; faceIndex: number }

export interface Command {
  id: string
  name: string
  timestamp: number
  execute: () => void
  undo: () => void
  merge?: (other: Command) => Command | null
}

export interface BackgroundTask {
  id: string
  name: string
  type: 'codegen' | 'csg' | 'remesh' | 'constraint' | 'import' | 'export' | 'simulation' | 'slicing'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  message?: string
  error?: string
  cancel?: () => void
}

export interface GizmoState {
  mode: 'translate' | 'rotate' | 'scale'
  space: 'local' | 'world'
  pivot: 'median' | 'individual' | 'cursor'
  snapping: boolean
}

export interface SnapSettings {
  grid: boolean
  vertex: boolean
  edge: boolean
  midpoint: boolean
  center: boolean
  angle: boolean
  gridSize: number
  angleStep: number
  threshold: number
}

export interface ViewportSettings {
  background: 'light' | 'dark' | 'environment'
  environmentPreset: 'studio' | 'outdoor' | 'indoor' | 'cave' | 'night' | 'custom'
  customBackgroundColor: string
  grid: boolean
  wireframe: boolean
  ghostMode: boolean
  hiddenLine: boolean
  sectionEnabled: boolean
  sectionPlane?: PlaneRef
}

export interface WorkspaceLayout {
  id: string
  name: string
  panels: Record<string, { visible: boolean; order: number; size: number }>
}

export interface CollabUser {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number }
  selection?: SelectionTarget[]
}
