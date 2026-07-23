// @ts-nocheck
import { useState } from 'react'
import { ChannelListItem } from './ChannelListItem'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { ChatChannel } from '@/lib/chat/chatTypes'
import { sortChannels } from '@/lib/chat/chatHelpers'

interface ChannelListProps {
  channels: ChatChannel[]
  activeChannelId: string | null
  onSelect: (channel: ChatChannel) => void
  onCreateChannel: () => void
  unreadCounts: Record<string, number>
}

export function ChannelList({ channels, activeChannelId, onSelect, onCreateChannel, unreadCounts }: ChannelListProps) {
  const [collapsed, setCollapsed] = useState(false)
  const sorted = sortChannels(channels)

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 py-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Channels
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100"
          onClick={onCreateChannel}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {!collapsed && (
        <div className="space-y-0.5">
          {sorted.map((channel) => (
            <ChannelListItem
              key={channel.id}
              channel={channel}
              isActive={activeChannelId === channel.id}
              unread={(unreadCounts[channel.id] ?? 0) > 0}
              mentionCount={unreadCounts[channel.id] ?? 0}
              onClick={() => onSelect(channel)}
            />
          ))}
        </div>
      )}
    </div>
  )
}