import { useCADStore } from '../store'

interface FeatureSuppressProps {
  bodyId: string
  featureId: string
}

export function FeatureSuppress({ bodyId, featureId }: FeatureSuppressProps) {
  const doc = useCADStore(s => s.doc)
  const updateFeature = useCADStore(s => s.updateFeature)

  const body = doc.bodies[bodyId]
  if (!body) return null
  const feature = body.features.find(f => f.id === featureId)
  if (!feature) return null

  return (
    <button
      className="text-[10px] text-muted-foreground hover:text-foreground"
      onClick={() => updateFeature(bodyId, featureId, { suppressed: !feature.suppressed })}
      title={feature.suppressed ? 'Unsuppress' : 'Suppress'}
    >
      {feature.suppressed ? 'Unsuppress' : 'Suppress'}
    </button>
  )
}
