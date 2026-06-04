import { useCADStore } from '../store'
import { getFeatureLabel } from '../registry'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Feature, PrimitiveFeature, ExtrudeFeature, RevolveFeature, FilletFeature, ChamferFeature, ShellFeature, DraftFeature, MirrorFeature, PatternFeature, BooleanFeature, HoleFeature } from '../types'

interface ParamRowProps {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'select'
  options?: { value: string; label: string }[]
}

function ParamRow({ label, value, onChange, type = 'text', options }: ParamRowProps) {
  return (
    <div className="grid grid-cols-2 gap-1 items-center">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      {type === 'select' && options ? (
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger className="h-6 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-[11px]">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="h-6 text-[11px]"
          type={type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

function FeatureParamEditor({ feature, bodyId, updateFeature }: { feature: Feature; bodyId: string; updateFeature: (bodyId: string, featureId: string, patch: Partial<Feature>) => void }) {
  const patch = (p: Partial<Feature>) => updateFeature(bodyId, feature.id, p)

  switch (feature.type) {
    case 'primitive': {
      const f = feature as PrimitiveFeature
      return (
        <>
          <ParamRow label="Type" value={f.primitiveType} onChange={v => patch({ primitiveType: v as any })} type="select" options={[
            { value: 'box', label: 'Box' },
            { value: 'sphere', label: 'Sphere' },
            { value: 'cylinder', label: 'Cylinder' },
            { value: 'cone', label: 'Cone' },
            { value: 'torus', label: 'Torus' },
            { value: 'wedge', label: 'Wedge' },
          ]} />
          {Object.entries(f.params ?? {}).map(([k, v]) => (
            <ParamRow key={k} label={k} value={String(v ?? 0)} onChange={val => patch({ params: { ...f.params, [k]: parseFloat(val) || 0 } })} type="number" />
          ))}
        </>
      )
    }
    case 'extrude': {
      const f = feature as ExtrudeFeature
      return (
        <>
          <ParamRow label="Depth" value={f.depth ?? 10} onChange={v => patch({ depth: parseFloat(v) || 0 })} type="number" />
          <ParamRow label="Direction" value={f.direction} onChange={v => patch({ direction: v as any })} type="select" options={[
            { value: 'forward', label: 'Forward' },
            { value: 'reverse', label: 'Reverse' },
            { value: 'symmetric', label: 'Symmetric' },
          ]} />
          <ParamRow label="End Condition" value={f.endCondition} onChange={v => patch({ endCondition: v as any })} type="select" options={[
            { value: 'blind', label: 'Blind' },
            { value: 'through-all', label: 'Through All' },
            { value: 'to-face', label: 'To Face' },
          ]} />
          <ParamRow label="Merge" value={f.mergeType} onChange={v => patch({ mergeType: v as any })} type="select" options={[
            { value: 'new-body', label: 'New Body' },
            { value: 'add', label: 'Add' },
            { value: 'subtract', label: 'Subtract' },
            { value: 'intersect', label: 'Intersect' },
          ]} />
          {f.taperAngle !== undefined && (
            <ParamRow label="Taper Angle" value={f.taperAngle} onChange={v => patch({ taperAngle: parseFloat(v) || 0 })} type="number" />
          )}
        </>
      )
    }
    case 'revolve': {
      const f = feature as RevolveFeature
      return (
        <>
          <ParamRow label="Angle" value={f.angle} onChange={v => patch({ angle: parseFloat(v) || 0 })} type="number" />
          <ParamRow label="Start Angle" value={f.startAngle} onChange={v => patch({ startAngle: parseFloat(v) || 0 })} type="number" />
          <ParamRow label="End Condition" value={f.endCondition} onChange={v => patch({ endCondition: v as any })} type="select" options={[
            { value: 'blind', label: 'Blind' },
            { value: 'to-face', label: 'To Face' },
          ]} />
          <ParamRow label="Merge" value={f.mergeType} onChange={v => patch({ mergeType: v as any })} type="select" options={[
            { value: 'new-body', label: 'New Body' },
            { value: 'add', label: 'Add' },
            { value: 'subtract', label: 'Subtract' },
          ]} />
        </>
      )
    }
    case 'fillet': {
      const f = feature as FilletFeature
      return (
        <>
          <ParamRow label="Radius" value={f.radius} onChange={v => patch({ radius: parseFloat(v) || 0 })} type="number" />
          <ParamRow label="Mode" value={f.mode} onChange={v => patch({ mode: v as any })} type="select" options={[
            { value: 'constant', label: 'Constant' },
            { value: 'variable', label: 'Variable' },
            { value: 'full-round', label: 'Full Round' },
          ]} />
          <ParamRow label="Blend" value={f.blendType} onChange={v => patch({ blendType: v as any })} type="select" options={[
            { value: 'circular', label: 'Circular' },
            { value: 'conic', label: 'Conic' },
            { value: 'curvature-continuous', label: 'Curvature' },
          ]} />
          <div className="text-[10px] text-muted-foreground">{f.edges.length} edge(s) selected</div>
        </>
      )
    }
    case 'chamfer': {
      const f = feature as ChamferFeature
      return (
        <>
          <ParamRow label="Mode" value={f.mode} onChange={v => patch({ mode: v as any })} type="select" options={[
            { value: 'equal', label: 'Equal' },
            { value: 'two-distance', label: 'Two Distance' },
            { value: 'distance-angle', label: 'Distance/Angle' },
          ]} />
          <ParamRow label="Distance 1" value={f.distance1} onChange={v => patch({ distance1: parseFloat(v) || 0 })} type="number" />
          {f.mode !== 'equal' && (
            <ParamRow label="Distance 2" value={f.distance2 ?? 0} onChange={v => patch({ distance2: parseFloat(v) || 0 })} type="number" />
          )}
          {f.mode === 'distance-angle' && (
            <ParamRow label="Angle" value={f.angle ?? 45} onChange={v => patch({ angle: parseFloat(v) || 0 })} type="number" />
          )}
          <div className="text-[10px] text-muted-foreground">{f.edges.length} edge(s) selected</div>
        </>
      )
    }
    case 'shell': {
      const f = feature as ShellFeature
      return (
        <>
          <ParamRow label="Thickness" value={f.thickness} onChange={v => patch({ thickness: parseFloat(v) || 0 })} type="number" />
          <ParamRow label="Direction" value={f.direction} onChange={v => patch({ direction: v as any })} type="select" options={[
            { value: 'inside', label: 'Inside' },
            { value: 'outside', label: 'Outside' },
            { value: 'both', label: 'Both' },
          ]} />
          <div className="text-[10px] text-muted-foreground">{f.openFaces.length} open face(s)</div>
        </>
      )
    }
    case 'draft': {
      const f = feature as DraftFeature
      return (
        <>
          <ParamRow label="Angle" value={f.angle} onChange={v => patch({ angle: parseFloat(v) || 0 })} type="number" />
          <ParamRow label="Mode" value={f.mode} onChange={v => patch({ mode: v as any })} type="select" options={[
            { value: 'face', label: 'Face' },
            { value: 'neutral-plane', label: 'Neutral Plane' },
            { value: 'parting-line', label: 'Parting Line' },
          ]} />
          <div className="text-[10px] text-muted-foreground">{f.faces.length} face(s)</div>
        </>
      )
    }
    case 'mirror': {
      const f = feature as MirrorFeature
      return (
        <>
          <ParamRow label="Merge" value={f.merge ? 'yes' : 'no'} onChange={v => patch({ merge: v === 'yes' })} type="select" options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]} />
          <ParamRow label="Weld" value={f.weld ? 'yes' : 'no'} onChange={v => patch({ weld: v === 'yes' })} type="select" options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]} />
        </>
      )
    }
    case 'pattern': {
      const f = feature as PatternFeature
      return (
        <>
          <ParamRow label="Pattern Type" value={f.patternType} onChange={v => patch({ patternType: v as any })} type="select" options={[
            { value: 'linear', label: 'Linear' },
            { value: 'circular', label: 'Circular' },
            { value: 'curve', label: 'Curve' },
          ]} />
          {f.count1 !== undefined && (
            <ParamRow label="Count X" value={f.count1} onChange={v => patch({ count1: parseInt(v) || 0 })} type="number" />
          )}
          {f.spacing1 !== undefined && (
            <ParamRow label="Spacing X" value={f.spacing1} onChange={v => patch({ spacing1: parseFloat(v) || 0 })} type="number" />
          )}
          {f.count2 !== undefined && (
            <ParamRow label="Count Y" value={f.count2} onChange={v => patch({ count2: parseInt(v) || 0 })} type="number" />
          )}
          {f.spacing2 !== undefined && (
            <ParamRow label="Spacing Y" value={f.spacing2} onChange={v => patch({ spacing2: parseFloat(v) || 0 })} type="number" />
          )}
        </>
      )
    }
    case 'boolean': {
      const f = feature as BooleanFeature
      return (
        <>
          <ParamRow label="Operation" value={f.operation} onChange={v => patch({ operation: v as any })} type="select" options={[
            { value: 'union', label: 'Union' },
            { value: 'subtract', label: 'Subtract' },
            { value: 'intersect', label: 'Intersect' },
            { value: 'split', label: 'Split' },
          ]} />
          <ParamRow label="Tolerance" value={f.tolerance} onChange={v => patch({ tolerance: parseFloat(v) || 0 })} type="number" />
        </>
      )
    }
    case 'hole': {
      const f = feature as HoleFeature
      return (
        <>
          <ParamRow label="Type" value={f.holeType} onChange={v => patch({ holeType: v as any })} type="select" options={[
            { value: 'simple', label: 'Simple' },
            { value: 'counterbore', label: 'Counterbore' },
            { value: 'countersink', label: 'Countersink' },
            { value: 'tapped', label: 'Tapped' },
          ]} />
          <ParamRow label="Diameter" value={f.diameter} onChange={v => patch({ diameter: parseFloat(v) || 0 })} type="number" />
          <ParamRow label="Depth" value={f.depth} onChange={v => patch({ depth: parseFloat(v) || 0 })} type="number" />
          <ParamRow label="End Condition" value={f.endCondition} onChange={v => patch({ endCondition: v as any })} type="select" options={[
            { value: 'blind', label: 'Blind' },
            { value: 'through-all', label: 'Through All' },
          ]} />
        </>
      )
    }
    default:
      return <p className="text-[10px] text-muted-foreground">No editable parameters</p>
  }
}

export function FeatureProperties() {
  const selection = useCADStore(s => s.selection)
  const updateFeature = useCADStore(s => s.updateFeature)
  const doc = useCADStore(s => s.doc)

  const featureSel = selection.find(s => s.type === 'feature')
  if (!featureSel) return null

  let foundBodyId: string | null = null
  let foundFeature: Feature | null = null
  for (const body of Object.values(doc.bodies)) {
    const f = body.features.find(f => f.id === featureSel.featureId) ?? null
    if (f) { foundFeature = f; foundBodyId = body.id; break }
  }

  if (!foundFeature) {
    return <p className="text-xs text-muted-foreground">Feature not found</p>
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">{getFeatureLabel(foundFeature)}</div>

      <div className="space-y-1">
        <Label className="text-xs">Name</Label>
        <Input
          className="h-7 text-xs"
          value={foundFeature.name}
          onChange={e => {
            if (foundBodyId) updateFeature(foundBodyId, foundFeature!.id, { name: e.target.value } as any)
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-2 text-[10px] text-muted-foreground border-t pt-2 mt-2">
        <span>ID: {foundFeature.id.slice(0, 12)}...</span>
        <span>Index: #{foundFeature.featureIndex}</span>
        <span>Type: {foundFeature.type}</span>
        <span>Suppressed: {foundFeature.suppressed ? 'Yes' : 'No'}</span>
      </div>

      <div className="space-y-1 border-t pt-2">
        <Label className="text-[10px] font-medium text-muted-foreground">Parameters</Label>
        <FeatureParamEditor feature={foundFeature} bodyId={foundBodyId!} updateFeature={updateFeature} />
      </div>
    </div>
  )
}
