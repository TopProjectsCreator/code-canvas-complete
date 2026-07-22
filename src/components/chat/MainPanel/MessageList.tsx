import { useEffect, useRef, useCallback } from 'react'
import { MessageBubble } from './MessageBubble'
import { formatMessageDateSeparator, isSameDay, formatRelativeTime } from '@/lib/chat/chatHelpers'
import { Loader2, Hash, MessageCircle } from 'lucide-react'
import type { ChatMessage, ChatChannel } from '@/lib/chat/chatTypes'

interface MessageListProps {
  messages: ChatMessage[]
  channel: ChatChannel | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onReply: (message: ChatMessage) => void
  onDelete: (messageId: string) => void
  onAddReaction: (messageId: string, emoji: string) => void
  onRemoveReaction: (messageId: string, emoji: string) => void
}

export function MessageList({
  messages,
  channel,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onReply,
  onDelete,
  onAddReaction,
  onRemoveReaction,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevMessageCount = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (messages.length > 0 && prevMessageCount.current === 0) {
      bottomRef.current?.scrollIntoView()
    }
    prevMessageCount.current = messages.length
  }, [messages.length])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || loadingMore || !hasMore) return
    if (el.scrollTop < 200) {
      const prevScrollHeight = el.scrollHeight
      onLoadMore()
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevScrollHeight
      })
    }
  }, [loadingMore, hasMore, onLoadMore])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Hash className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-muted-foreground">Select a channel</h3>
          <p className="text-sm text-muted-foreground/60">Choose a channel from the sidebar to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto ide-scrollbar"
      onScroll={handleScroll}
    >
      {loadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!hasMore && messages.length > 0 && (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Beginning of #{channel.name}
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            {channel.created_at ? formatRelativeTime(channel.created_at) : ''}
          </p>
        </div>
      )}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Hash className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-medium">Welcome to #{channel.name}</h3>
            <p className="text-sm text-muted-foreground">
              {channel.topic ?? 'Start the conversation'}
            </p>
          </div>
        </div>
      )}
      <div className="py-2">
        {messages.map((msg, i) => {
          const prevMsg = i > 0 ? messages[i - 1] : null
          const showDateSep = !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at)
          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                    {formatMessageDateSeparator(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <MessageBubble
                message={msg}
                prevMessage={prevMsg}
                onReply={() => onReply(msg)}
                onDelete={() => onDelete(msg.id)}
                onAddReaction={(emoji) => onAddReaction(msg.id, emoji)}
                onRemoveReaction={(emoji) => onRemoveReaction(msg.id, emoji)}
              />
            </div>
          )
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}
