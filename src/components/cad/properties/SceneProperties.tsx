import { useCADStore } from '../store'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function SceneProperties() {
  const units = useCADStore(s => s.units)
  const setUnits = useCADStore(s => s.setUnits)
  const precision = useCADStore(s => s.precision)
  const setPrecision = useCADStore(s => s.setPrecision)
  const snap = useCADStore(s => s.snap)
  const setSnapEnabled = useCADStore(s => s.setSnapEnabled)
  const setGridSize = useCADStore(s => s.setGridSize)
  const setAngleStep = useCADStore(s => s.setAngleStep)
  const setThreshold = useCADStore(s => s.setThreshold)

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium">Scene Settings</div>

      <div className="space-y-1">
        <Label className="text-xs">Units</Label>
        <Select value={units} onValueChange={v => setUnits(v as any)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['mm', 'cm', 'm', 'in', 'ft', 'um'].map(u => (
              <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Precision (decimal places)</Label>
        <Select value={String(precision)} onValueChange={v => setPrecision(parseInt(v))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3, 4, 5, 6].map(p => (
              <SelectItem key={p} value={String(p)} className="text-xs">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="text-xs font-medium">Snap Settings</div>

      {(['grid', 'vertex', 'edge', 'midpoint', 'center', 'angle'] as const).map(key => (
        <div key={key} className="flex items-center justify-between">
          <Label className="text-xs capitalize">{key}</Label>
          <Switch
            checked={snap[key]}
            onCheckedChange={checked => setSnapEnabled(key, checked)}
          />
        </div>
      ))}

      <div className="space-y-1">
        <Label className="text-xs">Grid Size</Label>
        <Input
          type="number"
          className="h-7 text-xs"
          value={snap.gridSize}
          onChange={e => setGridSize(parseFloat(e.target.value) || 1)}
          min={0.1}
          step={1}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Angle Step (°)</Label>
        <Input
          type="number"
          className="h-7 text-xs"
          value={snap.angleStep}
          onChange={e => setAngleStep(parseFloat(e.target.value) || 15)}
          min={1}
          max={90}
          step={5}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Snap Threshold</Label>
        <Input
          type="number"
          className="h-7 text-xs"
          value={snap.threshold}
          onChange={e => setThreshold(parseFloat(e.target.value) || 1)}
          min={1}
          step={1}
        />
      </div>
    </div>
  )
}
