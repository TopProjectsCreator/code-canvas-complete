// @ts-nocheck
import { useState } from 'react'
import { ChannelListItem } from './ChannelListItem'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { ChatChannel, ProfileBrief } from '@/lib/chat/chatTypes'

interface DirectMessageListProps {
  dmChannels: ChatChannel[]
  activeChannelId: string | null
  onSelect: (channel: ChatChannel) => void
  onStartDM: () => void
  unreadCounts: Record<string, number>
}

export function DirectMessageList({ dmChannels, activeChannelId, onSelect, onStartDM, unreadCounts }: DirectMessageListProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Direct Messages
        </button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onStartDM}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {!collapsed && (
        <div className="space-y-0.5">
          {dmChannels.map((channel) => (
            <ChannelListItem
              key={channel.id}
              channel={channel}
              isActive={activeChannelId === channel.id}
              unread={(unreadCounts[channel.id] ?? 0) > 0}
              mentionCount={unreadCounts[channel.id] ?? 0}
              onClick={() => onSelect(channel)}
            />
          ))}
          {dmChannels.length === 0 && (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">No direct messages yet</p>
          )}
        </div>
      )}
    </div>
  )
}