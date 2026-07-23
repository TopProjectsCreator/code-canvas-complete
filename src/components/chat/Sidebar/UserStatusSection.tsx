// @ts-nocheck
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatUserPresence } from '@/lib/chat/chatTypes'

interface UserStatusSectionProps {
  displayName: string | null
  avatarUrl: string | null
  presence: ChatUserPresence | null
  onStatusClick: () => void
}

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400',
}

export function UserStatusSection({ displayName, avatarUrl, presence, onStatusClick }: UserStatusSectionProps) {
  const status = presence?.status ?? 'offline'

  return (
    <div className="border-t border-border px-2 py-2">
      <Button
        variant="ghost"
        className="w-full flex items-center gap-2 h-auto py-1.5 px-2 cursor-pointer"
        onClick={onStatusClick}
      >
        <div className="relative shrink-0">
          <Avatar className="h-7 w-7">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">
              {(displayName ?? 'U')[0]}
            </AvatarFallback>
          </Avatar>
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
            STATUS_DOT[status]
          )} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium truncate">{displayName ?? 'User'}</p>
          {presence?.custom_status_text && (
            <p className="text-[10px] text-muted-foreground truncate">
              {presence.custom_status_emoji} {presence.custom_status_text}
            </p>
          )}
        </div>
      </Button>
    </div>
  )
}