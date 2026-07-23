// @ts-nocheck
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Hash, Lock, MessageCircle, Copy, Check } from 'lucide-react'
import type { ChatChannel, ChatChannelMember, ProfileBrief } from '@/lib/chat/chatTypes'
import { useAuth } from '@/contexts/AuthContext'

interface ChannelDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: ChatChannel | null
  members: (ChatChannelMember & { profile?: ProfileBrief })[]
  onUpdate: (channelId: string, updates: Partial<ChatChannel>) => Promise<{ error?: string }>
  onLeave: (channelId: string) => Promise<{ error?: string }>
  onDelete: (channelId: string) => Promise<{ error?: string }>
  isAdmin: boolean
}

export function ChannelDetailsDialog({
  open, onOpenChange, channel, members, onUpdate, onLeave, onDelete, isAdmin
}: ChannelDetailsDialogProps) {
  const { user } = useAuth()
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (channel) {
      setTopic(channel.topic ?? '')
      setDescription(channel.description ?? '')
      setConfirmDelete(false)
    }
  }, [channel])

  const handleSave = async () => {
    if (!channel) return
    setSaving(true)
    await onUpdate(channel.id, {
      topic: topic.trim() || null,
      description: description.trim() || null,
    })
    setSaving(false)
  }

  const handleCopyId = () => {
    if (!channel) return
    navigator.clipboard.writeText(channel.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!channel) return null

  const Icon = channel.is_dm ? MessageCircle : channel.is_private ? Lock : Hash

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {channel.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isAdmin} rows={2} />
          </div>
          {isAdmin && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Save
            </Button>
          )}

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Members ({members.length})</Label>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(m.profile?.display_name ?? '?')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.profile?.display_name ?? 'Unknown'}</p>
                  </div>
                  {m.role === 'admin' && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">admin</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleCopyId}>
              {copied ? <Check className="h-3.5 w-3.5 mr-2" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
              Copy Channel ID
            </Button>
            {!channel.is_dm && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-destructive"
                onClick={async () => {
                  await onLeave(channel.id)
                  onOpenChange(false)
                }}
              >
                Leave Channel
              </Button>
            )}
            {isAdmin && !channel.is_dm && (
              <>
                {confirmDelete ? (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <Button variant="destructive" size="sm" onClick={async () => {
                        await onDelete(channel.id)
                        onOpenChange(false)
                      }}>
                        Delete Channel
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete Channel
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}