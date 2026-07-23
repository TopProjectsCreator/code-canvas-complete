import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Search, UserPlus } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import type { ProfileBrief } from '@/lib/chat/chatTypes'

interface InvitePeopleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId: string
  workspaceId: string
  onInvite: (userId: string) => Promise<{ error?: string }>
}

export function InvitePeopleDialog({ open, onOpenChange, channelId, workspaceId: _workspaceId, onInvite }: InvitePeopleDialogProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ProfileBrief[]>([])
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q)
    if (q.length < 2) {
      setResults([])
      return
    }

    setSearching(true)

    const { data: existingMembers } = await supabase
      .from('chat_channel_members')
      .select('user_id')
      .eq('channel_id', channelId)

    const existingIds = (existingMembers ?? []).map(m => m.user_id)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, avatar_url')
      .ilike('display_name', `%${q}%`)
      .limit(20)

    if (!error && data) {
      setResults((data as ProfileBrief[]).filter(p => !existingIds.includes(p.user_id)))
    }
    setSearching(false)
  }, [channelId])

  const handleInvite = async (userId: string) => {
    setInviting(userId)
    await onInvite(userId)
    setInviting(null)
    setResults(prev => prev.filter(r => r.user_id !== userId))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite People</DialogTitle>
          <DialogDescription>Search for people to add to this channel</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {searching && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && results.length === 0 && search.length >= 2 && (
            <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
          )}
          {results.map((profile) => (
            <div key={profile.user_id} className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-accent/50">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{(profile.display_name ?? '?')[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{profile.display_name ?? 'Unknown'}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleInvite(profile.user_id)}
                disabled={inviting === profile.user_id}
              >
                {inviting === profile.user_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <UserPlus className="h-3 w-3" />
                )}
                Add
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
