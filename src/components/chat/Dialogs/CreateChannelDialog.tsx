import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface CreateChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, options: { topic?: string; description?: string; isPrivate?: boolean }) => Promise<{ error?: string }>
}

export function CreateChannelDialog({ open, onOpenChange, onCreate }: CreateChannelDialogProps) {
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) return
    setCreating(true)
    setError('')

    const result = await onCreate(name.trim(), {
      topic: topic.trim() || undefined,
      description: description.trim() || undefined,
      isPrivate,
    })

    if (result.error) {
      setError(result.error)
      setCreating(false)
    } else {
      setName('')
      setTopic('')
      setDescription('')
      setIsPrivate(false)
      onOpenChange(false)
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. They are best organized around a topic.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              placeholder="e.g. project-updates"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
              disabled={creating}
            />
          </div>
          <div>
            <Label htmlFor="channel-topic">Topic (optional)</Label>
            <Input
              id="channel-topic"
              placeholder="What is this channel about?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={creating}
            />
          </div>
          <div>
            <Label htmlFor="channel-description">Description (optional)</Label>
            <Textarea
              id="channel-description"
              placeholder="A longer description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="channel-private">Make private</Label>
              <p className="text-xs text-muted-foreground">Only invited people can see this channel</p>
            </div>
            <Switch
              id="channel-private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={creating}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create Channel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
