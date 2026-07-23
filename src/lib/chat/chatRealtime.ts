// @ts-nocheck
import { supabase } from '@/integrations/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function subscribeToChannelMessages(
  channelId: string,
  onInsert: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`chat-messages-${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        if (payload.errors) return
        onInsert(payload)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        if (payload.errors) return
        onUpdate?.(payload)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        if (payload.errors) return
        onDelete?.(payload)
      }
    )
    .subscribe()
}

export function subscribeToMessageReactions(
  messageId: string,
  onInsert: (payload: any) => void,
  onDelete?: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`chat-reactions-${messageId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_message_reactions',
        filter: `message_id=eq.${messageId}`,
      },
      (payload) => {
        if (payload.errors) return
        onInsert(payload)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_message_reactions',
        filter: `message_id=eq.${messageId}`,
      },
      (payload) => {
        if (payload.errors) return
        onDelete?.(payload)
      }
    )
    .subscribe()
}

export function subscribeToChannelReactions(
  channelId: string,
  onInsert: (payload: any) => void,
  onDelete?: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`chat-channel-reactions-${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_message_reactions',
      },
      (payload) => {
        if (payload.errors) return
        const msgId = payload.new?.message_id
        if (!msgId) return
        onInsert(payload)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_message_reactions',
      },
      (payload) => {
        if (payload.errors) return
        onDelete?.(payload)
      }
    )
    .subscribe()
}

export function createTypingBroadcastChannel(workspaceId: string) {
  return supabase.channel(`chat-typing-${workspaceId}`, {
    config: { broadcast: { self: true } },
  })
}

export function createPresenceChannel(workspaceId: string) {
  return supabase.channel(`chat-presence-${workspaceId}`, {
    config: {
      presence: { key: '' },
    },
  })
}