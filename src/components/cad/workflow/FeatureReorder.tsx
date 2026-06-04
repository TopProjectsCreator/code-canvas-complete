import { useCADStore } from '../store'

interface FeatureReorderProps {
  bodyId: string
  featureId: string
}

export function FeatureReorder({ bodyId, featureId }: FeatureReorderProps) {
  const doc = useCADStore(s => s.doc)
  const reorderFeature = useCADStore(s => s.reorderFeature)

  const body = doc.bodies[bodyId]
  if (!body) return null

  const idx = body.features.findIndex(f => f.id === featureId)
  if (idx < 0) return null

  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        className="p-1 hover:bg-accent rounded disabled:opacity-30"
        disabled={idx === 0}
        onClick={() => reorderFeature(bodyId, featureId, idx - 1)}
      >
        ↑
      </button>
      <span className="text-muted-foreground">{idx + 1} / {body.features.length}</span>
      <button
        className="p-1 hover:bg-accent rounded disabled:opacity-30"
        disabled={idx === body.features.length - 1}
        onClick={() => reorderFeature(bodyId, featureId, idx + 1)}
      >
        ↓
      </button>
    </div>
  )
}
