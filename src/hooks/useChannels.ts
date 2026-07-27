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
  }, [user, workspaceId])

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChannels().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
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

  const createDMChannel = useCallback(async (targetUserId: string) => {
    if (!user || !workspaceId) return { error: 'Not authenticated or no workspace' }

    const { data: existingMembers } = await supabase
      .from('chat_channel_members')
      .select('channel_id')
      .eq('user_id', user.id)

    const myChannelIds = (existingMembers ?? []).map(r => r.channel_id)

    if (myChannelIds.length > 0) {
      const { data: dmCandidates } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('is_dm', true)
        .in('id', myChannelIds)

      const dmIds = (dmCandidates ?? []).map(c => c.id)

      if (dmIds.length > 0) {
        const { data: targetMembers } = await supabase
          .from('chat_channel_members')
          .select('channel_id')
          .eq('user_id', targetUserId)
          .in('channel_id', dmIds)

        const shared = (targetMembers ?? []).map(m => m.channel_id)
        if (shared.length > 0) {
          const { data: existing } = await supabase
            .from('chat_channels')
            .select('*')
            .eq('id', shared[0])
            .single()

          if (existing) {
            setDmChannels(prev => prev.some(c => c.id === existing.id) ? prev : [...prev, existing])
            return { data: existing }
          }
        }
      }
    }

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', targetUserId)
      .single()

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single()

    const name = `${myProfile?.display_name ?? 'User'}, ${targetProfile?.display_name ?? 'User'}`

    const { data: channel, error } = await supabase
      .from('chat_channels')
      .insert({
        workspace_id: workspaceId,
        name,
        is_dm: true,
        is_private: true,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    const { error: memberError } = await supabase
      .from('chat_channel_members')
      .insert([
        { channel_id: channel.id, user_id: user.id, role: 'admin' },
        { channel_id: channel.id, user_id: targetUserId },
      ])

    if (memberError) {
      await supabase.from('chat_channels').delete().eq('id', channel.id)
      return { error: memberError.message }
    }

    setDmChannels(prev => [...prev, channel])
    return { data: channel }
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
    createDMChannel,
    joinChannel,
    leaveChannel,
    updateChannel,
    deleteChannel,
    refetch: fetchChannels,
  }
}
