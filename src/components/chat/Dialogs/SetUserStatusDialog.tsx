// @ts-nocheck
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ChatUserPresence } from '@/lib/chat/chatTypes'

const STATUS_OPTIONS: { value: ChatUserPresence['status']; label: string; dot: string }[] = [
  { value: 'online', label: 'Online', dot: 'bg-green-500' },
  { value: 'away', label: 'Away', dot: 'bg-yellow-500' },
  { value: 'busy', label: 'Do Not Disturb', dot: 'bg-red-500' },
  { value: 'offline', label: 'Offline', dot: 'bg-gray-400' },
]

const QUICK_STATUSES = [
  { emoji: '💼', text: 'In a meeting' },
  { emoji: '🏠', text: 'Working remotely' },
  { emoji: '🍕', text: 'On lunch' },
  { emoji: '🚀', text: 'Focusing' },
  { emoji: '😷', text: 'Not feeling well' },
  { emoji: '✈️', text: 'Traveling' },
  { emoji: '💻', text: 'Coding' },
  { emoji: '📞', text: 'On a call' },
]

interface SetUserStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStatus: ChatUserPresence['status']
  currentEmoji: string | null
  currentText: string | null
  onUpdate: (status: ChatUserPresence['status'], customText?: string | null, customEmoji?: string | null) => Promise<void>
}

export function SetUserStatusDialog({
  open, onOpenChange, currentStatus, currentEmoji, currentText, onUpdate
}: SetUserStatusDialogProps) {
  const [status, setStatus] = useState<ChatUserPresence['status']>(currentStatus)
  const [emoji, setEmoji] = useState(currentEmoji ?? '')
  const [text, setText] = useState(currentText ?? '')

  const handleSave = async () => {
    await onUpdate(status, text || null, emoji || null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set your status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Status</Label>
            <div className="space-y-1 mt-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer',
                    status === opt.value ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                  )}
                  onClick={() => setStatus(opt.value)}
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full', opt.dot)} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Custom Status</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="Emoji"
                className="w-16 text-center"
              />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What are you doing?"
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Quick statuses</p>
            <div className="flex flex-wrap gap-1">
              {QUICK_STATUSES.map((qs) => (
                <button
                  key={qs.text}
                  className="px-2 py-1 rounded-md text-xs bg-muted hover:bg-accent cursor-pointer"
                  onClick={() => { setEmoji(qs.emoji); setText(qs.text) }}
                >
                  {qs.emoji} {qs.text}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}