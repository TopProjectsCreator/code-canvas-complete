import { useCADStore } from '../store'
import { FEATURE_ICONS } from '../cadIcons'
import { getFeatureLabel } from '../registry'
import type { Feature } from '../types'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface HistoryNodeProps {
  feature: Feature
  index: number
  bodyId: string
}

export function HistoryNode({ feature, index, bodyId }: HistoryNodeProps) {
  const select = useCADStore(s => s.select)
  const selection = useCADStore(s => s.selection)
  const updateFeature = useCADStore(s => s.updateFeature)
  const [expanded, setExpanded] = useState(false)

  const isSelected = selection.some(s => s.type === 'feature' && s.featureId === feature.id)
  const Icon = FEATURE_ICONS[feature.type as keyof typeof FEATURE_ICONS]

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs hover:bg-accent/50 ${
          isSelected ? 'bg-accent text-accent-foreground' : ''
        } ${feature.suppressed ? 'opacity-40' : ''}`}
        onClick={() => select({ type: 'feature', featureId: feature.id })}
        onContextMenu={e => {
          e.preventDefault()
          useCADStore.getState().showContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              { label: 'Edit', action: 'edit-feature', featureId: feature.id, bodyId },
              { label: feature.suppressed ? 'Unsuppress' : 'Suppress', action: 'toggle-suppress', featureId: feature.id, bodyId },
              { label: 'Delete', action: 'delete-feature', featureId: feature.id, bodyId },
            ],
          })
        }}
      >
        <button
          className="p-0.5 hover:bg-muted rounded"
          onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}

        <span className="flex-1 truncate">{getFeatureLabel(feature)}</span>

        <span className="text-[10px] text-muted-foreground">#{index}</span>

        {feature.suppressed && (
          <span className="text-[10px] text-amber-500">S</span>
        )}
      </div>
    </div>
  )
}
