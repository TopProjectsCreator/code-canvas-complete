import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Search, MessageCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { ProfileBrief } from '@/lib/chat/chatTypes'
import type { ChatChannel } from '@/lib/chat/chatTypes'

interface StartDMDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onCreateDM: (userId: string) => Promise<{ data?: ChatChannel; error?: string }>
  onSelectChannel: (channel: ChatChannel) => void
}

export function StartDMDialog({ open, onOpenChange, onCreateDM, onSelectChannel }: StartDMDialogProps) {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ProfileBrief[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q)
    setError(null)
    if (q.length < 2) {
      setResults([])
      return
    }

    setSearching(true)

    const { data, error: searchError } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, avatar_url')
      .ilike('display_name', `%${q}%`)
      .limit(20)

    if (!searchError && data) {
      setResults((data as ProfileBrief[]).filter(p => p.user_id !== user?.id))
    }
    setSearching(false)
  }, [user?.id])

  const handleSelect = async (userId: string) => {
    setCreating(userId)
    setError(null)
    const result = await onCreateDM(userId)
    setCreating(null)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.data) {
      onSelectChannel(result.data)
      setSearch('')
      setResults([])
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSearch(''); setResults([]); setError(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
          <DialogDescription>Search for a person to start a conversation with</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
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
            <button
              key={profile.user_id}
              className="flex items-center gap-2 w-full py-2 px-2 rounded-md hover:bg-accent/50 text-left cursor-pointer"
              onClick={() => handleSelect(profile.user_id)}
              disabled={creating !== null}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{(profile.display_name ?? '?')[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{profile.display_name ?? 'Unknown'}</p>
              </div>
              {creating === profile.user_id ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
