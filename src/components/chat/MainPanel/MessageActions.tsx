import { Button } from '@/components/ui/button'
import { MessageCircle, SmilePlus, Trash2 } from 'lucide-react'
import { EmojiPicker } from '@/components/chat/Shared/EmojiPicker'

interface MessageActionsProps {
  onReply: () => void
  onAddReaction: (emoji: string) => void
  onDelete?: () => void
  canDelete: boolean
  isPinned?: boolean
}

export function MessageActions({ onReply, onAddReaction, onDelete, canDelete }: MessageActionsProps) {
  return (
    <div className="absolute -top-3 right-2 flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
      <EmojiPicker
        onSelect={onAddReaction}
        trigger={
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        }
      />
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
