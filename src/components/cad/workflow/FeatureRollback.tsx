import { useState } from 'react'
import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import { Undo2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function FeatureRollback() {
  const doc = useCADStore(s => s.doc)
  const removeFeature = useCADStore(s => s.removeFeature)
  const [open, setOpen] = useState(false)

  const bodiesWithFeatures = Object.values(doc.bodies).filter(b => b.features.length > 0)

  function handleRollbackTo(bodyId: string, featureId: string) {
    const body = doc.bodies[bodyId]
    if (!body) return
    const idx = body.features.findIndex(f => f.id === featureId)
    if (idx < 0) return
    const toRemove = body.features.slice(idx + 1)
    for (const f of toRemove) {
      removeFeature(bodyId, f.id)
    }
    setOpen(false)
  }

  if (bodiesWithFeatures.length === 0) return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <Undo2 className="h-3.5 w-3.5" />
        Rollback
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Rollback Construction History</DialogTitle>
            <DialogDescription className="text-xs">
              Select a feature to roll back to. All features after it will be removed.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[300px] overflow-auto space-y-0.5">
            {bodiesWithFeatures.map(body => (
              <div key={body.id}>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                  {body.name}
                </div>
                {body.features.map((feature, i) => (
                  <button
                    key={feature.id}
                    className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2"
                    onClick={() => handleRollbackTo(body.id, feature.id)}
                  >
                    <span className="text-muted-foreground font-mono text-[10px]">#{i}</span>
                    <span className="flex-1 truncate">{feature.name}</span>
                    <span className="text-muted-foreground text-[10px]">
                      +{body.features.length - i - 1} after
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
