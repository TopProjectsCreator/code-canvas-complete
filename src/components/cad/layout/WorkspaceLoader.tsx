import { useCADStore } from '../store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LayoutDashboard } from 'lucide-react'

const WORKSPACES = [
  { id: 'modeling', label: 'Modeling' },
  { id: 'sculpting', label: 'Sculpting' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'animation', label: 'Animation' },
  { id: 'rendering', label: 'Rendering' },
]

export function WorkspaceLoader() {
  const workspace = useCADStore(s => s.workspace)
  const setWorkspace = useCADStore(s => s.setWorkspace)

  const current = WORKSPACES.find(w => w.id === workspace)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
          <LayoutDashboard className="h-3.5 w-3.5" />
          {current?.label ?? workspace}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {WORKSPACES.map(ws => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => setWorkspace(ws.id)}
            className={ws.id === workspace ? 'bg-accent' : ''}
          >
            {ws.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
