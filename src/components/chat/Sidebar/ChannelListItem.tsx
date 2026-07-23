// @ts-nocheck
import { cn } from '@/lib/utils'
import { Hash, Lock, MessageCircle } from 'lucide-react'
import type { ChatChannel } from '@/lib/chat/chatTypes'

interface ChannelListItemProps {
  channel: ChatChannel
  isActive: boolean
  unread: boolean
  mentionCount: number
  onClick: () => void
}

export function ChannelListItem({ channel, isActive, unread, mentionCount, onClick }: ChannelListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-sm group cursor-pointer',
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        unread && !isActive && 'font-semibold text-foreground'
      )}
    >
      {channel.is_dm ? (
        <MessageCircle className="h-4 w-4 shrink-0" />
      ) : channel.is_private ? (
        <Lock className="h-4 w-4 shrink-0" />
      ) : (
        <Hash className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate flex-1 text-left">{channel.name}</span>
      {mentionCount > 0 && (
        <span className="flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
          {mentionCount}
        </span>
      )}

    </button>
  )
}