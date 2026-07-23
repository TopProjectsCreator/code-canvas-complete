import { Button } from '@/components/ui/button'
import { Hash, Lock, MessageCircle, Search, Info } from 'lucide-react'
import type { ChatChannel, ChatChannelMember } from '@/lib/chat/chatTypes'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ChannelHeaderProps {
  channel: ChatChannel
  memberCount: number
  members?: (ChatChannelMember & { profile?: { display_name?: string | null; avatar_url?: string | null } })[]
  onSearch: () => void
  onDetails: () => void
}

export function ChannelHeader({ channel, memberCount, members, onSearch, onDetails }: ChannelHeaderProps) {
  const Icon = channel.is_dm ? MessageCircle : channel.is_private ? Lock : Hash

  return (
    <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="font-semibold text-sm truncate">{channel.name}</h2>
        {channel.topic && (
          <>
            <span className="text-muted-foreground/30 hidden sm:inline">|</span>
            <p className="text-xs text-muted-foreground truncate max-w-[300px] hidden sm:block">
              {channel.topic}
            </p>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        {members && members.length > 0 && (
          <div className="flex -space-x-1.5 mr-1">
            {members.slice(0, 3).map((m) => (
              <Avatar key={m.id} className="h-5 w-5 border border-background">
                <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[8px]">
                  {(m.profile?.display_name ?? '?')[0]}
                </AvatarFallback>
              </Avatar>
            ))}
            {memberCount > 3 && (
              <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground border border-background">
                +{memberCount - 3}
              </span>
            )}
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSearch}>
          <Search className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDetails}>
          <Info className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
