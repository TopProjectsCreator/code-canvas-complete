import { useCADStore } from '../store'
import { getFeatureLabel } from '../registry'

export function DependencyGraph() {
  const doc = useCADStore(s => s.doc)

  function findFeatureName(featureId: string): string {
    for (const body of Object.values(doc.bodies)) {
      const feat = body.features.find(f => f.id === featureId)
      if (feat) return feat.name || getFeatureLabel(feat)
    }
    return featureId.slice(0, 12) + '...'
  }

  const edges: { fromLabel: string; toLabel: string }[] = []
  for (const body of Object.values(doc.bodies)) {
    for (const feat of body.features) {
      for (const dep of feat.dependencies) {
        edges.push({ fromLabel: feat.name || getFeatureLabel(feat), toLabel: findFeatureName(dep) })
      }
    }
  }

  if (edges.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No dependencies
      </div>
    )
  }

  return (
    <div className="p-3 text-xs space-y-1">
      <div className="font-medium mb-2">Dependencies</div>
      {edges.map((edge, i) => (
        <div key={i} className="flex items-center gap-1 text-muted-foreground">
          <span className="truncate max-w-[120px]">{edge.fromLabel}</span>
          <span>→</span>
          <span className="truncate max-w-[120px]">{edge.toLabel}</span>
        </div>
      ))}
    </div>
  )
}
