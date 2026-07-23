// @ts-nocheck
import { Button } from '@/components/ui/button'
import { MessageCircle, SmilePlus, Share2, Pin, Trash2 } from 'lucide-react'

interface MessageActionsProps {
  onReply: () => void
  onReact: () => void
  onDelete?: () => void
  canDelete: boolean
  isPinned?: boolean
}

export function MessageActions({ onReply, onReact, onDelete, canDelete, isPinned }: MessageActionsProps) {
  return (
    <div className="absolute -top-3 right-2 flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReact}>
        <SmilePlus className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReply}>
        <MessageCircle className="h-3.5 w-3.5" />
      </Button>
      {canDelete && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}