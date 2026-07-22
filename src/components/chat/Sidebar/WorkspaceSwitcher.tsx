import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Plus, Settings, LogOut } from 'lucide-react'
import type { ChatWorkspace } from '@/lib/chat/chatTypes'

interface WorkspaceSwitcherProps {
  workspaces: ChatWorkspace[]
  activeWorkspace: ChatWorkspace | null
  onSelect: (workspace: ChatWorkspace) => void
  onCreate: () => void
  onSettings: () => void
}

export function WorkspaceSwitcher({ workspaces, activeWorkspace, onSelect, onCreate, onSettings }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between gap-2 h-12 px-3 rounded-none border-b border-border cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {(activeWorkspace?.name ?? 'W')[0]}
            </div>
            <span className="font-semibold text-sm truncate">
              {activeWorkspace?.name ?? 'Select Workspace'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-64 p-1">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer ${
              ws.id === activeWorkspace?.id
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50 text-foreground'
            }`}
            onClick={() => { onSelect(ws); setOpen(false) }}
          >
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
              {ws.name[0]}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium truncate">{ws.name}</p>
              {ws.description && (
                <p className="text-[10px] text-muted-foreground truncate">{ws.description}</p>
              )}
            </div>
          </button>
        ))}
        <div className="border-t border-border mt-1 pt-1">
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground cursor-pointer"
            onClick={() => { onCreate(); setOpen(false) }}
          >
            <Plus className="h-4 w-4" />
            New Workspace
          </button>
          {activeWorkspace && (
            <>
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground cursor-pointer"
                onClick={() => { onSettings(); setOpen(false) }}
              >
                <Settings className="h-4 w-4" />
                Workspace Settings
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
