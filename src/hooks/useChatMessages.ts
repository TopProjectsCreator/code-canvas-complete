import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToChannelMessages } from '@/lib/chat/chatRealtime'
import type { ChatMessage, ChatMessageReaction, ChatMessageAttachment, NewMessage } from '@/lib/chat/chatTypes'
import { uploadChatAttachment, deleteChatAttachment } from '@/lib/chat/chatStorage'

const PAGE_SIZE = 50

export function useChatMessages(channelId: string | null) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sending, setSending] = useState(false)
  const channelRef = useRef<ReturnType<typeof subscribeToChannelMessages> | null>(null)
  const mountedRef = useRef(true)
  const channelIdRef = useRef<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchMessages = useCallback(async (cursor?: string) => {
    if (!channelId) {
      setMessages([])
      setLoading(false)
      return
    }

    cursor ? setLoadingMore(true) : setLoading(true)

    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        profile:user_id(id, user_id, display_name, avatar_url),
        reactions:chat_message_reactions(*),
        attachments:chat_message_attachments(*)
      `)
      .eq('channel_id', channelId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching messages:', error)
      cursor ? setLoadingMore(false) : setLoading(false)
      return
    }

    const fetched = (data ?? []) as unknown as ChatMessage[]

    const countMap: Record<string, number> = {}
    if (fetched.length > 0) {
      const msgIds = fetched.map(m => m.id)
      const { data: replies } = await supabase
        .from('chat_messages')
        .select('parent_id')
        .in('parent_id', msgIds)
      if (replies) {
        for (const row of replies as { parent_id: string }[]) {
          countMap[row.parent_id] = (countMap[row.parent_id] ?? 0) + 1
        }
      }
    }

    const sorted = fetched
      .map(msg => ({ ...msg, reply_count: countMap[msg.id] ?? 0 }))
      .reverse()

    if (cursor) {
      setMessages(prev => [...sorted, ...prev])
      setHasMore(fetched.length === PAGE_SIZE)
    } else {
      setMessages(sorted)
      setHasMore(fetched.length === PAGE_SIZE)
    }

    cursor ? setLoadingMore(false) : setLoading(false)
  }, [channelId])

  useEffect(() => {
    setMessages([])
    setHasMore(true)
    setLoading(true)
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (!channelId) return

    if (channelRef.current) channelRef.current.unsubscribe()

    channelIdRef.current = channelId

    channelRef.current = subscribeToChannelMessages(
      channelId,
      (payload) => {
        if (!mountedRef.current || channelIdRef.current !== channelId) return
        const newMsg = payload.new as any
        if (newMsg.parent_id) {
          setMessages(prev => prev.map(m =>
            m.id === newMsg.parent_id
              ? { ...m, reply_count: (m.reply_count ?? 0) + 1 }
              : m
          ))
          return
        }
        supabase
          .from('profiles')
          .select('id, user_id, display_name, avatar_url')
          .eq('user_id', newMsg.user_id)
          .single()
          .then(({ data: profile }) => {
            if (!mountedRef.current || channelIdRef.current !== channelId) return
            setMessages(prev => [...prev, {
              ...newMsg,
              profile: profile ?? undefined,
              reactions: [],
              attachments: [],
              reply_count: 0,
            } as ChatMessage])
          })
      },
      (payload) => {
        if (!mountedRef.current || channelIdRef.current !== channelId) return
        const updated = payload.new as any
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
      },
      (payload) => {
        if (!mountedRef.current || channelIdRef.current !== channelId) return
        const deleted = payload.old as any
        setMessages(prev => prev.filter(m => m.id !== deleted.id))
      }
    )

    const chUnsub = channelRef.current
    return () => {
      if (chUnsub) chUnsub.unsubscribe()
    }
  }, [channelId])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || messages.length === 0) return
    const oldest = messages[0]
    fetchMessages(oldest.created_at)
  }, [loadingMore, hasMore, messages, fetchMessages])

  const sendMessage = useCallback(async (msg: NewMessage, files?: File[]) => {
    if (!user || !channelId) return { error: 'Not authenticated' }

    setSending(true)

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        body: msg.body,
        body_html: msg.body_html ?? null,
        parent_id: msg.parent_id ?? null,
      })
      .select()
      .single()

    if (error) {
      setSending(false)
      return { error: error.message }
    }

    if (files && files.length > 0) {
      for (const file of files) {
        const result = await uploadChatAttachment(file, user.id, message.id)
        if ('error' in result) continue
        const { error: insertError } = await supabase.from('chat_message_attachments').insert({
          message_id: message.id,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: result.storage_path,
        })
        if (insertError) {
          console.error('Failed to save attachment record:', insertError)
          await deleteChatAttachment(result.storage_path)
        }
      }
    }

    setSending(false)
    return { data: message as ChatMessage }
  }, [user, channelId])

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    return {}
  }, [user])

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      await supabase
        .from('chat_message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji })
        .maybeSingle()
    } catch (err) {
      console.error('Failed to add reaction:', err)
    }
  }, [user])

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      await supabase
        .from('chat_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
    } catch (err) {
      console.error('Failed to remove reaction:', err)
    }
  }, [user])

  const updateLastRead = useCallback(async () => {
    if (!user || !channelId) return

    try {
      await supabase
        .from('chat_channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
    } catch (err) {
      console.error('Failed to update last read:', err)
    }
  }, [user, channelId])

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    sending,
    sendMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    loadMore,
    updateLastRead,
  }
}
