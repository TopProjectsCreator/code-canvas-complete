import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { createPresenceChannel } from '@/lib/chat/chatRealtime'
import type { ChatUserPresence } from '@/lib/chat/chatTypes'

export function usePresence(workspaceId: string | null) {
  const { user } = useAuth()
  const [presenceMap, setPresenceMap] = useState<Record<string, ChatUserPresence>>({})
  const channelRef = useRef<ReturnType<typeof createPresenceChannel> | null>(null)

  useEffect(() => {
    if (!user || !workspaceId) return

    if (channelRef.current) {
      channelRef.current.unsubscribe()
    }

    const channel = createPresenceChannel(workspaceId)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const newMap: Record<string, ChatUserPresence> = {}
        for (const key of Object.keys(state)) {
          const presences = state[key] as any[]
          if (presences.length > 0) {
            const p = presences[0]
            newMap[key] = p as ChatUserPresence
          }
        }
        setPresenceMap(newMap)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setPresenceMap(prev => ({
          ...prev,
          [key]: newPresences[0] as unknown as ChatUserPresence,
        }))
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setPresenceMap(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            workspace_id: workspaceId,
            status: 'online',
            custom_status_text: null,
            custom_status_emoji: null,
            last_seen_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [user, workspaceId])

  const updateStatus = useCallback(async (status: ChatUserPresence['status']) => {
    if (!user || !workspaceId || !channelRef.current) return

    await channelRef.current.track({
      user_id: user.id,
      workspace_id: workspaceId,
      status,
      custom_status_text: null,
      custom_status_emoji: null,
      last_seen_at: new Date().toISOString(),
    })

    await supabase
      .from('chat_user_presence')
      .upsert({
        user_id: user.id,
        workspace_id: workspaceId,
        status,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,workspace_id' })
  }, [user, workspaceId])

  const updateCustomStatus = useCallback(async (
    status: ChatUserPresence['status'],
    customStatusText?: string | null,
    customStatusEmoji?: string | null
  ) => {
    if (!user || !workspaceId || !channelRef.current) return

    await channelRef.current.track({
      user_id: user.id,
      workspace_id: workspaceId,
      status,
      custom_status_text: customStatusText ?? null,
      custom_status_emoji: customStatusEmoji ?? null,
      last_seen_at: new Date().toISOString(),
    })

    await supabase
      .from('chat_user_presence')
      .upsert({
        user_id: user.id,
        workspace_id: workspaceId,
        status,
        custom_status_text: customStatusText ?? null,
        custom_status_emoji: customStatusEmoji ?? null,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,workspace_id' })
  }, [user, workspaceId])

  const isOnline = useCallback((userId: string) => {
    const p = presenceMap[userId]
    if (!p) return false
    return p.status === 'online' || p.status === 'away' || p.status === 'busy'
  }, [presenceMap])

  const getUserPresence = useCallback((userId: string): ChatUserPresence | undefined => {
    return presenceMap[userId]
  }, [presenceMap])

  return {
    presenceMap,
    updateStatus,
    updateCustomStatus,
    isOnline,
    getUserPresence,
  }
}
