// @ts-nocheck
import { cn } from '@/lib/utils'
import type { ChatMessageReaction } from '@/lib/chat/chatTypes'

interface MessageReactionsProps {
  reactions: ChatMessageReaction[]
  currentUserId: string
  onAddReaction: (emoji: string) => void
  onRemoveReaction: (emoji: string) => void
}

export function MessageReactions({ reactions, currentUserId, onAddReaction, onRemoveReaction }: MessageReactionsProps) {
  const grouped: Record<string, ChatMessageReaction[]> = {}
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = []
    grouped[r.emoji].push(r)
  }

  const entries = Object.entries(grouped)

  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, rs]) => {
        const hasReacted = rs.some(r => r.user_id === currentUserId)
        return (
          <button
            key={emoji}
            onClick={() => hasReacted ? onRemoveReaction(emoji) : onAddReaction(emoji)}
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border cursor-pointer',
              hasReacted
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground'
            )}
          >
            <span>{emoji}</span>
            <span className="text-[10px] font-medium">{rs.length}</span>
          </button>
        )
      })}
    </div>
  )
}