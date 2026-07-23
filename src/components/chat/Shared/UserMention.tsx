// @ts-nocheck
import { useEffect, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { ProfileBrief } from '@/lib/chat/chatTypes'

interface UserMentionProps {
  suggestions: ProfileBrief[]
  onSelect: (user: ProfileBrief) => void
  activeIndex: number
  onClose: () => void
}

export function UserMentionList({ suggestions, onSelect, activeIndex, onClose }: UserMentionProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (suggestions.length === 0) return null

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-border bg-popover shadow-lg overflow-hidden z-50"
    >
      {suggestions.map((user, i) => (
        <button
          key={user.user_id}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer ${
            i === activeIndex ? 'bg-accent' : ''
          }`}
          onClick={() => onSelect(user)}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {(user.display_name ?? '?')[0]}
            </AvatarFallback>
          </Avatar>
          <span>{user.display_name ?? 'Unknown'}</span>
        </button>
      ))}
    </div>
  )
}