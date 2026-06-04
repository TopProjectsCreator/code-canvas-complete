import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCADStore } from '../store'
import { getFeatureLabel } from '../registry'
import type { Feature } from '../types'

interface FeatureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  featureId?: string
  bodyId?: string
}

function DialogParamRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-2 gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

function DialogFeatureParams({ feature }: { feature: Feature }) {
  const p = feature as any
  switch (feature.type) {
    case 'primitive':
      return <DialogParamRow label="Primitive" value={p.primitiveType} />
    case 'extrude':
      return <DialogParamRow label="Depth" value={p.depth ?? 'N/A'} />
    case 'revolve':
      return <DialogParamRow label="Angle" value={`${p.angle}°`} />
    case 'fillet':
      return <DialogParamRow label="Radius" value={p.radius} />
    case 'chamfer':
      return <DialogParamRow label="Distance" value={p.distance1} />
    case 'shell':
      return <DialogParamRow label="Thickness" value={p.thickness} />
    case 'draft':
      return <DialogParamRow label="Angle" value={`${p.angle}°`} />
    case 'mirror':
      return <DialogParamRow label="Merge" value={p.merge ? 'Yes' : 'No'} />
    case 'pattern':
      return <DialogParamRow label="Type" value={p.patternType} />
    case 'boolean':
      return <DialogParamRow label="Operation" value={p.operation} />
    case 'hole':
      return <DialogParamRow label="Diameter" value={p.diameter} />
    default:
      return null
  }
}

export function FeatureDialog({ open, onOpenChange, featureId, bodyId }: FeatureDialogProps) {
  const doc = useCADStore(s => s.doc)
  const updateFeature = useCADStore(s => s.updateFeature)
  const [name, setName] = useState('')

  const feature = bodyId && featureId ? doc.bodies[bodyId]?.features.find(f => f.id === featureId) : null

  useEffect(() => {
    if (feature) setName(feature.name)
  }, [feature])

  if (!feature) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Feature Properties</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">No feature selected</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-sm">{getFeatureLabel(feature)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              className="h-7 text-xs"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => { if (name && bodyId) updateFeature(bodyId, feature.id, { name } as any) }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground border-t pt-2">
            <DialogParamRow label="Type" value={feature.type} />
            <DialogParamRow label="Index" value={`#${feature.featureIndex}`} />
            <DialogParamRow label="Suppressed" value={feature.suppressed ? 'Yes' : 'No'} />
            <DialogParamRow label="ID" value={feature.id.slice(0, 12) + '...'} />
          </div>
          <DialogFeatureParams feature={feature} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
