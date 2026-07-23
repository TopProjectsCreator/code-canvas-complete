import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { ChatChannel, ChatChannelMember, ProfileBrief } from '@/lib/chat/chatTypes'

export function useChannels(workspaceId: string | null) {
  const { user } = useAuth()
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [dmChannels, setDmChannels] = useState<ChatChannel[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChannels = useCallback(async () => {
    if (!user || !workspaceId) {
      setChannels([])
      setDmChannels([])
      setLoading(false)
      return
    }

    const { data: memberRows } = await supabase
      .from('chat_channel_members')
      .select('channel_id')
      .eq('user_id', user.id)

    const memberChannelIds = (memberRows ?? []).map(r => r.channel_id)

    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('id', memberChannelIds.length > 0 ? memberChannelIds : ['__none__'])
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching channels:', error)
      setChannels([])
      setDmChannels([])
    } else {
      const allChannels = data ?? []
      setChannels(allChannels.filter(c => !c.is_dm))
      setDmChannels(allChannels.filter(c => c.is_dm))
    }
    setLoading(false)
  }, [user, workspaceId])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const fetchMembers = useCallback(async (channelId: string) => {
    const { data, error } = await supabase
      .from('chat_channel_members')
      .select(`
        *,
        profile:user_id(id, user_id, display_name, avatar_url)
      `)
      .eq('channel_id', channelId)

    if (error) {
      console.error('Error fetching members:', error)
      return []
    }

    return (data ?? []) as unknown as (ChatChannelMember & { profile: ProfileBrief })[]
  }, [])

  const createChannel = useCallback(async (
    name: string,
    options?: { topic?: string; description?: string; isPrivate?: boolean }
  ) => {
    if (!user || !workspaceId) return { error: 'Not authenticated or no workspace' }

    const { data, error } = await supabase
      .from('chat_channels')
      .insert({
        workspace_id: workspaceId,
        name: name.toLowerCase().replace(/\s+/g, '-'),
        topic: options?.topic ?? null,
        description: options?.description ?? null,
        is_private: options?.isPrivate ?? false,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    const { error: memberError } = await supabase
      .from('chat_channel_members')
      .insert({ channel_id: data.id, user_id: user.id, role: 'admin' })

    if (memberError) {
      await supabase.from('chat_channels').delete().eq('id', data.id)
      return { error: memberError.message }
    }

    setChannels(prev => [...prev, data])
    return { data }
  }, [user, workspaceId])

  const joinChannel = useCallback(async (channelId: string) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('chat_channel_members')
      .insert({ channel_id: channelId, user_id: user.id })

    if (error) return { error: error.message }
    return {}
  }, [user])

  const leaveChannel = useCallback(async (channelId: string) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('chat_channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', user.id)

    if (error) return { error: error.message }

    setChannels(prev => prev.filter(c => c.id !== channelId))
    setDmChannels(prev => prev.filter(c => c.id !== channelId))
    return {}
  }, [user])

  const updateChannel = useCallback(async (channelId: string, updates: Partial<ChatChannel>) => {
    const { error } = await supabase
      .from('chat_channels')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', channelId)

    if (error) return { error: error.message }
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c))
    setDmChannels(prev => prev.map(c => c.id === channelId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c))
    return {}
  }, [])

  const deleteChannel = useCallback(async (channelId: string) => {
    const { error } = await supabase
      .from('chat_channels')
      .delete()
      .eq('id', channelId)

    if (error) return { error: error.message }

    setChannels(prev => prev.filter(c => c.id !== channelId))
    return {}
  }, [])

  return {
    channels,
    dmChannels,
    loading,
    fetchMembers,
    createChannel,
    joinChannel,
    leaveChannel,
    updateChannel,
    deleteChannel,
    refetch: fetchChannels,
  }
}
