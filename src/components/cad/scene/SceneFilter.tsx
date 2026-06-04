import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useCADStore } from '../store'

export function SceneFilter() {
  const filter = useCADStore(s => s.sceneFilter)
  const setFilter = useCADStore(s => s.setSceneFilter)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2" align="end">
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={filter.bodies} onCheckedChange={c => setFilter({ bodies: !!c })} /> Bodies
          </Label>
          <Label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={filter.sketches} onCheckedChange={c => setFilter({ sketches: !!c })} /> Sketches
          </Label>
          <Label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={filter.planes} onCheckedChange={c => setFilter({ planes: !!c })} /> Planes
          </Label>
          <Label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={filter.construction} onCheckedChange={c => setFilter({ construction: !!c })} /> Construction
          </Label>
        </div>
      </PopoverContent>
    </Popover>
  )
}
