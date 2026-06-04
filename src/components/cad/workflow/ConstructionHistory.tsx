import { useCADStore } from '../store'
import { HistoryNode } from './HistoryNode'
import { DependencyGraph } from './DependencyGraph'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

export function ConstructionHistory() {
  const doc = useCADStore(s => s.doc)
  const [showDeps, setShowDeps] = useState(false)

  const bodiesWithFeatures = Object.values(doc.bodies).filter(b => b.features.length > 0)

  if (bodiesWithFeatures.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No features yet
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-1 space-y-0.5">
        {Object.values(doc.bodies).map(body => (
          <div key={body.id}>
            {body.features.length > 0 && (
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                {body.name}
              </div>
            )}
            {body.features.map((feature, index) => (
              <HistoryNode
                key={feature.id}
                feature={feature}
                index={index}
                bodyId={body.id}
              />
            ))}
          </div>
        ))}

        <button
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground w-full"
          onClick={() => setShowDeps(!showDeps)}
        >
          {showDeps ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Dependencies
        </button>

        {showDeps && <DependencyGraph />}
      </div>
    </ScrollArea>
  )
}
