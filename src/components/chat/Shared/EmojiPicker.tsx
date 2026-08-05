import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { SmilePlus } from 'lucide-react'

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: [
      { emoji: '😀', name: 'grinning face', keywords: ['happy', 'smile', 'face'] },
      { emoji: '😂', name: 'face with tears of joy', keywords: ['laugh', 'cry', 'funny'] },
      { emoji: '🤣', name: 'rolling on the floor laughing', keywords: ['laugh', 'lol', 'hilarious'] },
      { emoji: '😊', name: 'smiling face with smiling eyes', keywords: ['blush', 'happy', 'shy'] },
      { emoji: '😍', name: 'smiling face with heart-eyes', keywords: ['love', 'heart', 'adore'] },
      { emoji: '🥰', name: 'smiling face with hearts', keywords: ['love', 'heart', 'adore'] },
      { emoji: '😎', name: 'smiling face with sunglasses', keywords: ['cool', 'sunglasses', 'awesome'] },
      { emoji: '🤩', name: 'star-struck', keywords: ['star', 'eyes', 'wow'] },
      { emoji: '😢', name: 'crying face', keywords: ['cry', 'sad', 'tear'] },
      { emoji: '😭', name: 'loudly crying face', keywords: ['cry', 'sad', 'sob'] },
      { emoji: '😤', name: 'face with steam from nose', keywords: ['angry', 'frustrated', 'mad'] },
      { emoji: '😡', name: 'pouting face', keywords: ['angry', 'mad', 'furious'] },
      { emoji: '🥳', name: 'partying face', keywords: ['party', 'celebrate', 'birthday'] },
      { emoji: '🤔', name: 'thinking face', keywords: ['think', 'hmm', 'wonder'] },
      { emoji: '🙄', name: 'face with rolling eyes', keywords: ['eyeroll', 'annoyed', 'whatever'] },
      { emoji: '😴', name: 'sleeping face', keywords: ['sleep', 'zzz', 'tired'] },
      { emoji: '🤗', name: 'hugging face', keywords: ['hug', 'comfort', 'care'] },
      { emoji: '🤭', name: 'face with hand over mouth', keywords: ['oops', 'giggle', 'shy'] },
      { emoji: '🫣', name: 'face with peeking eye', keywords: ['peek', 'shy', 'nervous'] },
      { emoji: '😬', name: 'grimacing face', keywords: ['awkward', 'nervous', 'oops'] },
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      { emoji: '👍', name: 'thumbs up', keywords: ['like', 'approve', 'good'] },
      { emoji: '👎', name: 'thumbs down', keywords: ['dislike', 'bad', 'no'] },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause', 'bravo'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['celebrate', 'hooray', 'praise'] },
      { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebrate', 'congrats'] },
      { emoji: '❤️', name: 'red heart', keywords: ['heart', 'love', 'like'] },
      { emoji: '🔥', name: 'fire', keywords: ['fire', 'hot', 'lit'] },
      { emoji: '💯', name: 'hundred points', keywords: ['hundred', 'perfect', 'score'] },
      { emoji: '✅', name: 'check mark button', keywords: ['check', 'done', 'yes'] },
      { emoji: '❌', name: 'cross mark', keywords: ['no', 'wrong', 'delete'] },
      { emoji: '⭐', name: 'star', keywords: ['star', 'favorite', 'rating'] },
      { emoji: '💪', name: 'flexed biceps', keywords: ['strong', 'muscle', 'workout'] },
      { emoji: '🚀', name: 'rocket', keywords: ['rocket', 'launch', 'fast'] },
      { emoji: '👀', name: 'eyes', keywords: ['eyes', 'look', 'peek'] },
      { emoji: '🙏', name: 'folded hands', keywords: ['pray', 'thanks', 'please'] },
      { emoji: '💜', name: 'purple heart', keywords: ['purple', 'heart', 'love'] },
      { emoji: '💙', name: 'blue heart', keywords: ['blue', 'heart', 'love'] },
      { emoji: '💚', name: 'green heart', keywords: ['green', 'heart', 'love'] },
      { emoji: '💛', name: 'yellow heart', keywords: ['yellow', 'heart', 'love'] },
      { emoji: '🧡', name: 'orange heart', keywords: ['orange', 'heart', 'love'] },
    ],
  },
  {
    name: 'Objects',
    emojis: [
      { emoji: '📁', name: 'file folder', keywords: ['folder', 'file', 'directory'] },
      { emoji: '📂', name: 'open file folder', keywords: ['folder', 'file', 'open'] },
      { emoji: '📄', name: 'page facing up', keywords: ['document', 'paper', 'file'] },
      { emoji: '📝', name: 'memo', keywords: ['write', 'note', 'memo'] },
      { emoji: '📌', name: 'pushpin', keywords: ['pin', 'pushpin', 'tack'] },
      { emoji: '🔗', name: 'link', keywords: ['link', 'chain', 'url'] },
      { emoji: '📎', name: 'paperclip', keywords: ['paperclip', 'attach', 'clip'] },
      { emoji: '🖊️', name: 'pen', keywords: ['pen', 'write', 'ink'] },
      { emoji: '✂️', name: 'scissors', keywords: ['scissors', 'cut', 'trim'] },
      { emoji: '🔒', name: 'locked', keywords: ['lock', 'secure', 'password'] },
      { emoji: '🔓', name: 'unlocked', keywords: ['unlock', 'open', 'access'] },
      { emoji: '💡', name: 'light bulb', keywords: ['idea', 'light', 'bulb'] },
      { emoji: '🔧', name: 'wrench', keywords: ['wrench', 'tool', 'fix'] },
      { emoji: '📦', name: 'package', keywords: ['package', 'box', 'delivery'] },
      { emoji: '🏆', name: 'trophy', keywords: ['trophy', 'winner', 'award'] },
      { emoji: '🎯', name: 'bullseye', keywords: ['target', 'bullseye', 'goal'] },
      { emoji: '🧠', name: 'brain', keywords: ['brain', 'smart', 'think'] },
      { emoji: '⚡', name: 'high voltage', keywords: ['lightning', 'bolt', 'electric'] },
      { emoji: '🛠️', name: 'hammer and wrench', keywords: ['tools', 'fix', 'repair'] },
      { emoji: '📊', name: 'bar chart', keywords: ['chart', 'graph', 'statistics'] },
    ],
  },
  {
    name: 'Common',
    emojis: [
      { emoji: '🎉', name: 'party popper', keywords: ['party', 'celebrate', 'congrats'] },
      { emoji: '👍', name: 'thumbs up', keywords: ['like', 'approve', 'good'] },
      { emoji: '❤️', name: 'red heart', keywords: ['heart', 'love', 'like'] },
      { emoji: '🔥', name: 'fire', keywords: ['fire', 'hot', 'lit'] },
      { emoji: '✅', name: 'check mark button', keywords: ['check', 'done', 'yes'] },
      { emoji: '🙌', name: 'raising hands', keywords: ['celebrate', 'hooray', 'praise'] },
      { emoji: '💯', name: 'hundred points', keywords: ['hundred', 'perfect', 'score'] },
      { emoji: '🎊', name: 'confetti ball', keywords: ['confetti', 'celebrate', 'party'] },
      { emoji: '🚀', name: 'rocket', keywords: ['rocket', 'launch', 'fast'] },
      { emoji: '👏', name: 'clapping hands', keywords: ['clap', 'applause', 'bravo'] },
      { emoji: '💪', name: 'flexed biceps', keywords: ['strong', 'muscle', 'workout'] },
      { emoji: '⭐', name: 'star', keywords: ['star', 'favorite', 'rating'] },
      { emoji: '🥳', name: 'partying face', keywords: ['party', 'celebrate', 'birthday'] },
      { emoji: '✨', name: 'sparkles', keywords: ['sparkle', 'shine', 'magic'] },
      { emoji: '💡', name: 'light bulb', keywords: ['idea', 'light', 'bulb'] },
      { emoji: '🎈', name: 'balloon', keywords: ['balloon', 'party', 'celebrate'] },
      { emoji: '🏅', name: 'sports medal', keywords: ['medal', 'award', 'winner'] },
      { emoji: '💎', name: 'gem stone', keywords: ['gem', 'diamond', 'jewel'] },
      { emoji: '👑', name: 'crown', keywords: ['crown', 'king', 'queen'] },
      { emoji: '🌟', name: 'glowing star', keywords: ['star', 'glow', 'shine'] },
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
        c.emojis.filter(e => 
          e.name.includes(search) || 
          e.keywords.some(k => k.includes(search))
        )
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
              {filtered.map((emojiData) => (
                <button
                  key={emojiData.emoji}
                  className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-accent text-lg cursor-pointer"
                  onClick={() => { onSelect(emojiData.emoji); setOpen(false); setSearch('') }}
                >
                  {emojiData.emoji}
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
                  {cat.emojis.map((emojiData) => (
                    <button
                      key={emojiData.emoji}
                      className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-accent text-lg cursor-pointer"
                      onClick={() => { onSelect(emojiData.emoji); setOpen(false) }}
                    >
                      {emojiData.emoji}
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
