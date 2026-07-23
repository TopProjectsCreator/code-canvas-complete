// @ts-nocheck
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, description?: string) => Promise<{ error?: string; data?: any }>
}

export function CreateWorkspaceDialog({ open, onOpenChange, onCreate }: CreateWorkspaceDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) return
    setCreating(true)
    setError('')

    const result = await onCreate(name.trim(), description.trim() || undefined)
    if (result.error) {
      setError(result.error)
    } else {
      setName('')
      setDescription('')
      onOpenChange(false)
    }
    setCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Workspace</DialogTitle>
          <DialogDescription>
            A workspace contains channels and members. Create one for your team or project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Workspace Name</Label>
            <Input
              placeholder="e.g. My Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="What is this workspace about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create Workspace
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}