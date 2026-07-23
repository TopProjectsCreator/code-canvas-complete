// @ts-nocheck
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { ChatWorkspace } from '@/lib/chat/chatTypes'

export function useWorkspaces() {
  const { user } = useAuth()
  const [workspaces, setWorkspaces] = useState<ChatWorkspace[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('chat_workspaces')
      .select('*')
      .or(`created_by.eq.${user.id},team_id.not.isnull`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching workspaces:', error)
      setWorkspaces([])
    } else {
      setWorkspaces(data ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  const createWorkspace = useCallback(async (name: string, description?: string) => {
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('chat_workspaces')
      .insert({ name, description: description ?? null, created_by: user.id })
      .select()
      .single()

    if (error) return { error: error.message }

    setWorkspaces(prev => [data, ...prev])
    return { data }
  }, [user])

  const updateWorkspace = useCallback(async (id: string, updates: Partial<ChatWorkspace>) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('chat_workspaces')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('created_by', user.id)

    if (error) return { error: error.message }

    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w))
    return {}
  }, [user])

  const deleteWorkspace = useCallback(async (id: string) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('chat_workspaces')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id)

    if (error) return { error: error.message }

    setWorkspaces(prev => prev.filter(w => w.id !== id))
    return {}
  }, [user])

  return { workspaces, loading, createWorkspace, updateWorkspace, deleteWorkspace, refetch: fetchWorkspaces }
}