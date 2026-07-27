import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { SmilePlus } from 'lucide-react'

interface EmojiItem {
  emoji: string
  name: string
  keywords: string[]
}

const EMOJI_CATEGORIES: { name: string; emojis: EmojiItem[] }[] = [
  {
    name: 'Smileys',
    emojis: [
      { emoji: '😀', name: 'grinning face', keywords: ['smile', 'happy'] },
      { emoji: '😂', name: 'face with tears of joy', keywords: ['laugh', 'funny'] },
      { emoji: '🤣', name: 'rolling on the floor laughing', keywords: ['rofl', 'laugh'] },
      { emoji: '😊', name: 'smiling face with smiling eyes', keywords: ['blush', 'shy'] },
      { emoji: '😍', name: 'smiling face with heart-eyes', keywords: ['love', 'crush'] },
      { emoji: '🥰', name: 'smiling face with hearts', keywords: ['love', 'adore'] },
      { emoji: '😎', name: 'smiling face with sunglasses', keywords: ['cool', 'sun'] },
      { emoji: '🤩', name: 'star-struck', keywords: ['star', 'wow'] },
      { emoji: '😢', name: 'crying face', keywords: ['sad', 'cry'] },
      { emoji: '😭', name: 'loudly crying face', keywords: ['sad', 'sob'] },
      { emoji: '😤', name: 'face with steam from nose', keywords: ['angry', 'frustrated'] },
      { emoji: '😡', name: 'pouting face', keywords: ['angry', 'mad'] },
      { emoji: '🥳', name: 'partying face', keywords: ['party', 'celebrate'] },
      { emoji: '🤔', name: 'thinking face', keywords: ['think', 'hmm'] },
      { emoji: '🙄', name: 'face with rolling eyes', keywords: ['eyeroll', 'annoyed'] },
      { emoji: '😴', name: 'sleeping face', keywords: ['sleep', 'zzz'] },
      { emoji: '🤗', name: 'hugging face', keywords: ['hug', 'comfort'] },
      { emoji: '🤭', name: 'face with hand over mouth', keywords: ['oops', 'giggle'] },
      { emoji: '🫣', name: 'face with peeking eye', keywords: ['peek', 'shy'] },
      { emoji: '😬', name: 'grimacing face', keywords: ['awkward', 'nervous'] },
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      { emoji: '👍', name: 'thumbs up', keywords: ['yes', 'ok', 'like'] },
      { emoji: '👎', name: 'thumbs down', keywords: ['no', 'dislike'] },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['hooray', 'celebrate'] },
      { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebrate', 'tada'] },
      { emoji: '❤️', name: 'red heart', keywords: ['love', 'heart', 'like'] },
      { emoji: '🔥', name: 'fire', keywords: ['hot', 'lit', 'flame'] },
      { emoji: '💯', name: 'hundred points', keywords: ['perfect', 'score', '100'] },
      { emoji: '✅', name: 'check mark button', keywords: ['done', 'ok', 'check'] },
      { emoji: '❌', name: 'cross mark', keywords: ['no', 'wrong', 'cancel'] },
      { emoji: '⭐', name: 'star', keywords: ['favorite', 'rating'] },
      { emoji: '💪', name: 'flexed biceps', keywords: ['strong', 'muscle', 'power'] },
      { emoji: '🚀', name: 'rocket', keywords: ['launch', 'space', 'ship'] },
      { emoji: '👀', name: 'eyes', keywords: ['see', 'look', 'watch'] },
      { emoji: '🙏', name: 'folded hands', keywords: ['please', 'thank', 'pray'] },
      { emoji: '💜', name: 'purple heart', keywords: ['love', 'heart'] },
      { emoji: '💙', name: 'blue heart', keywords: ['love', 'heart'] },
      { emoji: '💚', name: 'green heart', keywords: ['love', 'heart'] },
      { emoji: '💛', name: 'yellow heart', keywords: ['love', 'heart'] },
      { emoji: '🧡', name: 'orange heart', keywords: ['love', 'heart'] },
    ],
  },
  {
    name: 'Objects',
    emojis: [
      { emoji: '📁', name: 'file folder', keywords: ['file', 'folder'] },
      { emoji: '📂', name: 'open file folder', keywords: ['file', 'folder', 'open'] },
      { emoji: '📄', name: 'page facing up', keywords: ['page', 'document'] },
      { emoji: '📝', name: 'memo', keywords: ['write', 'note', 'memo'] },
      { emoji: '📌', name: 'pushpin', keywords: ['pin', 'tack'] },
      { emoji: '🔗', name: 'link', keywords: ['chain', 'url', 'link'] },
      { emoji: '📎', name: 'paperclip', keywords: ['clip', 'attach'] },
      { emoji: '🖊️', name: 'pen', keywords: ['write', 'pen'] },
      { emoji: '✂️', name: 'scissors', keywords: ['cut', 'scissors'] },
      { emoji: '🔒', name: 'locked', keywords: ['lock', 'secure', 'private'] },
      { emoji: '🔓', name: 'unlocked', keywords: ['unlock', 'open', 'public'] },
      { emoji: '💡', name: 'light bulb', keywords: ['idea', 'light', 'bulb'] },
      { emoji: '🔧', name: 'wrench', keywords: ['tool', 'fix', 'spanner'] },
      { emoji: '📦', name: 'package', keywords: ['box', 'package', 'delivery'] },
      { emoji: '🏆', name: 'trophy', keywords: ['trophy', 'winner', 'award'] },
      { emoji: '🎯', name: 'direct hit', keywords: ['target', 'dart', 'bullseye'] },
      { emoji: '🧠', name: 'brain', keywords: ['brain', 'smart', 'think'] },
      { emoji: '⚡', name: 'high voltage', keywords: ['lightning', 'thunder', 'electric'] },
      { emoji: '🛠️', name: 'hammer and wrench', keywords: ['tool', 'repair', 'fix'] },
      { emoji: '📊', name: 'bar chart', keywords: ['chart', 'graph', 'stats'] },
    ],
  },
  {
    name: 'Common',
    emojis: [
      { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebrate', 'tada'] },
      { emoji: '👍', name: 'thumbs up', keywords: ['yes', 'ok', 'like'] },
      { emoji: '❤️', name: 'red heart', keywords: ['love', 'heart'] },
      { emoji: '🔥', name: 'fire', keywords: ['hot', 'lit', 'flame'] },
      { emoji: '✅', name: 'check mark button', keywords: ['done', 'ok', 'check'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['hooray', 'celebrate'] },
      { emoji: '💯', name: 'hundred points', keywords: ['perfect', 'score', '100'] },
      { emoji: '🎊', name: 'confetti ball', keywords: ['party', 'confetti'] },
      { emoji: '🚀', name: 'rocket', keywords: ['launch', 'space', 'ship'] },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause'] },
      { emoji: '💪', name: 'flexed biceps', keywords: ['strong', 'muscle', 'power'] },
      { emoji: '⭐', name: 'star', keywords: ['favorite', 'rating'] },
      { emoji: '🥳', name: 'partying face', keywords: ['party', 'celebrate'] },
      { emoji: '✨', name: 'sparkles', keywords: ['sparkle', 'magic', 'shiny'] },
      { emoji: '💡', name: 'light bulb', keywords: ['idea', 'light', 'bulb'] },
      { emoji: '🎈', name: 'balloon', keywords: ['party', 'balloon'] },
      { emoji: '🏅', name: 'sports medal', keywords: ['medal', 'winner', 'award'] },
      { emoji: '💎', name: 'gem stone', keywords: ['diamond', 'gem', 'precious'] },
      { emoji: '👑', name: 'crown', keywords: ['king', 'queen', 'royal'] },
      { emoji: '🌟', name: 'glowing star', keywords: ['star', 'glow', 'shining'] },
    ],
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
        c.emojis.filter(e => {
          const q = search.toLowerCase()
          return (
            e.name.toLowerCase().includes(q) ||
            e.keywords.some(k => k.includes(q))
          )
        })
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
              {filtered.map((item) => (
                <button
                  key={item.emoji}
                  className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-lg cursor-pointer"
                  onClick={() => { onSelect(item.emoji); setOpen(false); setSearch('') }}
                >
                  {item.emoji}
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
                  {cat.emojis.map((item) => (
                    <button
                      key={item.emoji}
                      className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-lg cursor-pointer"
                      onClick={() => { onSelect(item.emoji); setOpen(false) }}
                    >
                      {item.emoji}
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
