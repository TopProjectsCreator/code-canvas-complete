import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { SmilePlus } from 'lucide-react'

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩', '😢', '😭', '😤', '😡', '🥳', '🤔', '🙄', '😴', '🤗', '🤭', '🫣', '😬'],
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🎉', '❤️', '🔥', '💯', '✅', '❌', '⭐', '💪', '🚀', '👀', '🙏', '💜', '💙', '💚', '💛', '🧡'],
  },
  {
    name: 'Objects',
    emojis: ['📁', '📂', '📄', '📝', '📌', '🔗', '📎', '🖊️', '✂️', '🔒', '🔓', '💡', '🔧', '📦', '🏆', '🎯', '🧠', '⚡', '🛠️', '📊'],
  },
  {
    name: 'Common',
    emojis: ['🎉', '👍', '❤️', '🔥', '✅', '🙌', '💯', '🎊', '🚀', '👏', '💪', '⭐', '🥳', '✨', '💡', '🎈', '🏅', '💎', '👑', '🌟'],
  },
]

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  trigger?: React.ReactNode
}

export function EmojiPicker({ onSelect, trigger }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = search
    ? EMOJI_CATEGORIES.flatMap(c =>
        c.emojis.filter(e => e.includes(search))
      ).slice(0, 30)
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <SmilePlus className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-2">
        <div className="mb-2">
          <input
            placeholder="Search emoji..."
            className="w-full h-8 px-2 text-sm rounded-md border border-input bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          {filtered ? (
            <div className="grid grid-cols-8 gap-1">
              {filtered.map((emoji) => (
                <button
                  key={emoji}
                  className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-lg cursor-pointer"
                  onClick={() => { onSelect(emoji); setOpen(false); setSearch('') }}
                >
                  {emoji}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-8 text-xs text-muted-foreground text-center py-4">No emoji found</p>
              )}
            </div>
          ) : (
            EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.name} className="mb-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">{cat.name}</p>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-lg cursor-pointer"
                      onClick={() => { onSelect(emoji); setOpen(false) }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
