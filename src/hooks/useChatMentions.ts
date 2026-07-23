import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { parseMentions } from '@/lib/chat/chatHelpers'
import type { ProfileBrief } from '@/lib/chat/chatTypes'

export function useChatMentions() {
  const { user } = useAuth()
  const [mentionSuggestions, setMentionSuggestions] = useState<ProfileBrief[]>([])

  const searchUsers = useCallback(async (query: string, channelId: string) => {
    if (!query || query.length < 1) {
      setMentionSuggestions([])
      return
    }

    const { data: members } = await supabase
      .from('chat_channel_members')
      .select('user_id')
      .eq('channel_id', channelId)

    if (!members || members.length === 0) {
      setMentionSuggestions([])
      return
    }

    const userIds = members.map(m => m.user_id)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, avatar_url')
      .in('user_id', userIds)
      .ilike('display_name', `%${query}%`)
      .limit(10)

    setMentionSuggestions((profiles ?? []) as ProfileBrief[])
  }, [])

  const notifyMentions = useCallback(async (body: string, channelId: string, _workspaceId: string) => {
    const mentions = parseMentions(body)
    if (mentions.length === 0 || !user) return

    const { data: channel } = await supabase
      .from('chat_channels')
      .select('name')
      .eq('id', channelId)
      .single()

    const channelName = channel?.name ?? 'unknown'

    const orFilters = mentions.map(m => `display_name.ilike.%${m}%`).join(',')
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id')
      .or(orFilters)

    if (!profiles) return

    for (const profile of profiles) {
      if (profile.user_id === user.id) continue
      await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: profile.user_id,
          subject: `Mentioned you in #${channelName}`,
          body_html: `<p>${user.email ?? 'Someone'} mentioned you in <strong>#${channelName}</strong></p><blockquote>${body}</blockquote>`,
          kind: 'chat_mention',
        })
        .maybeSingle()
    }
  }, [user])

  return { mentionSuggestions, searchUsers, notifyMentions }
}
