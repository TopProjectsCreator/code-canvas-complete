import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import type { ChatWorkspace } from '@/lib/chat/chatTypes'

interface WorkspaceSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: ChatWorkspace | null
  onUpdate: (id: string, updates: Partial<ChatWorkspace>) => Promise<{ error?: string }>
}

export function WorkspaceSettingsDialog({ open, onOpenChange, workspace, onUpdate }: WorkspaceSettingsDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (workspace) {
      setName(workspace.name)
      setDescription(workspace.description ?? '')
    }
  }, [workspace])

  const handleSave = async () => {
    if (!workspace || !name.trim()) return
    setSaving(true)
    setError('')

    const result = await onUpdate(workspace.id, { name: name.trim(), description: description.trim() || null })
    if (result.error) {
      setError(result.error)
    } else {
      onOpenChange(false)
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Workspace Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} rows={3} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
