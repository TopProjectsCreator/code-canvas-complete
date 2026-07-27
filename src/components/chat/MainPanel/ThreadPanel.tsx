import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { RichTextInput } from '../Shared/RichTextInput'
import { formatMessageTime, formatMessageBody } from '@/lib/chat/chatHelpers'
import { X, Loader2, Send } from 'lucide-react'
import { subscribeToChannelMessages } from '@/lib/chat/chatRealtime'
import type { ChatMessage } from '@/lib/chat/chatTypes'

interface ThreadPanelProps {
  parentMessage: ChatMessage
  onClose: () => void
}

export function ThreadPanel({ parentMessage, onClose }: ThreadPanelProps) {
  const { user } = useAuth()
  const [replies, setReplies] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!parentMessage) return

    let cancelled = false
    setLoading(true)
    setReplies([])

    supabase
      .from('chat_messages')
      .select(`
        *,
        profile:user_id(id, user_id, display_name, avatar_url)
      `)
      .eq('parent_id', parentMessage.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Error fetching thread replies:', error)
          setLoading(false)
          return
        }
        setReplies((data ?? []) as unknown as ChatMessage[])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    const sub = subscribeToChannelMessages(
      parentMessage.channel_id,
      (payload) => {
        const newMsg = payload.new as any
        if (newMsg.parent_id !== parentMessage.id) return
        supabase
          .from('profiles')
          .select('id, user_id, display_name, avatar_url')
          .eq('user_id', newMsg.user_id)
          .single()
          .then(({ data: profile }) => {
            if (!cancelled) {
              setReplies(prev => [...prev, { ...newMsg, profile: profile ?? undefined } as ChatMessage])
            }
          })
      }
    )

    return () => {
      cancelled = true
      sub.unsubscribe()
    }
  }, [parentMessage])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies.length])

  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || !user || sending) return
    setSending(true)

    await supabase
      .from('chat_messages')
      .insert({
        channel_id: parentMessage.channel_id,
        user_id: user.id,
        parent_id: parentMessage.id,
        body: replyText,
      })

    setReplyText('')
    setSending(false)
  }, [replyText, user, sending, parentMessage])

  return (
    <div className="flex flex-col h-full border-l border-border bg-card w-[380px] shrink-0">
      <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
        <h3 className="font-semibold text-sm">Thread</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-y-auto flex-1 ide-scrollbar">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={parentMessage.profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">
                {(parentMessage.profile?.display_name ?? '?')[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{parentMessage.profile?.display_name ?? 'Unknown'}</span>
                <span className="text-[10px] text-muted-foreground">{formatMessageTime(parentMessage.created_at)}</span>
              </div>
              <div
                className="text-sm text-foreground mt-0.5"
                dangerouslySetInnerHTML={{ __html: formatMessageBody(parentMessage.body) }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-2">
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-3 px-4 py-2 hover:bg-accent/30">
                <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                  <AvatarImage src={reply.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(reply.profile?.display_name ?? '?')[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold">{reply.profile?.display_name ?? 'Unknown'}</span>
                    <span className="text-[10px] text-muted-foreground">{formatMessageTime(reply.created_at)}</span>
                  </div>
                  <div
                    className="text-sm mt-0.5"
                    dangerouslySetInnerHTML={{ __html: formatMessageBody(reply.body) }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <RichTextInput
            value={replyText}
            onChange={setReplyText}
            onSend={handleSendReply}
            placeholder="Reply in thread..."
            disabled={sending}
            className="bg-muted/50"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!replyText.trim() || sending}
            onClick={handleSendReply}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
