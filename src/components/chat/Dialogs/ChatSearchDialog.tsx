import { useState, useCallback, useEffect, useRef } from 'react'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Hash, MessageCircle, Loader2 } from 'lucide-react'
import { searchMessages, type SearchResult } from '@/lib/chat/chatSearch'
import { formatMessageTime } from '@/lib/chat/chatHelpers'
import { useAuth } from '@/contexts/AuthContext'

interface ChatSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string | null
  onSelectMessage: (result: SearchResult) => void
}

export function ChatSearchDialog({ open, onOpenChange, workspaceId, onSelectMessage }: ChatSearchDialogProps) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)

    if (q.length < 2 || !workspaceId || !user) {
      setResults([])
      return
    }

    setSearching(true)
    timerRef.current = setTimeout(async () => {
      const res = await searchMessages(q, workspaceId, user.id)
      setResults(res)
      setSearching(false)
    }, 300)
  }, [workspaceId, user])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search messages..."
        value={query}
        onValueChange={handleSearch}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : query.length < 2 ? (
            'Type at least 2 characters to search'
          ) : (
            'No messages found'
          )}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Messages">
            {results.map((result) => (
              <CommandItem
                key={result.message.id}
                value={`${result.message.body} ${result.channel.name}`}
                onSelect={() => {
                  onSelectMessage(result)
                  onOpenChange(false)
                }}
                className="flex items-start gap-3 py-2"
              >
                {result.channel.is_dm ? (
                  <MessageCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                ) : (
                  <Hash className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {result.message.profile?.display_name ?? 'Unknown'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      in #{result.channel.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatMessageTime(result.message.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {result.message.body}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
