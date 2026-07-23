// @ts-nocheck
import { supabase } from '@/integrations/supabase/client'
import type { ChatMessage, ChatChannel, ProfileBrief } from './chatTypes'

export interface SearchResult {
  message: ChatMessage
  channel: Pick<ChatChannel, 'id' | 'name' | 'is_dm'>
  profile: ProfileBrief | null
  rank: number
}

export async function searchMessages(
  query: string,
  workspaceId: string,
  userId: string
): Promise<SearchResult[]> {
  const { data: channelIds } = await supabase
    .from('chat_channel_members')
    .select('channel_id')
    .eq('user_id', userId)

  if (!channelIds || channelIds.length === 0) return []

  const ids = channelIds.map(c => c.channel_id)

  const { data: channels } = await supabase
    .from('chat_channels')
    .select('id, name, is_dm')
    .in('id', ids)
    .eq('workspace_id', workspaceId)

  if (!channels || channels.length === 0) return []

  const channelIdSet = channels.map(c => c.id)

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select(`
      *,
      profile:user_id(id, user_id, display_name, avatar_url),
      reactions:chat_message_reactions(*)
    `)
    .in('channel_id', channelIdSet)
        .textSearch('body', query, {
      type: 'websearch',
      config: 'english',
    })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !messages) return []

  const channelMap = new Map(channels.map(c => [c.id, c]))

  return (messages as any[]).map((m: any) => ({
    message: m as ChatMessage,
    channel: channelMap.get(m.channel_id) ?? { id: m.channel_id, name: 'unknown', is_dm: false },
    profile: m.profile as ProfileBrief | null,
    rank: 0,
  }))
}