import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  useThreadCategories,
  createCategory,
  renameCategory,
  deleteCategory,
} from '@/hooks/useThreadCategories';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageCategoriesDialog({ open, onOpenChange }: Props) {
  const { categories, refresh } = useThreadCategories();
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createCategory(newName, (categories.at(-1)?.sort_order ?? 0) + 10);
      setNewName('');
      await refresh();
    } catch (err: any) {
      toast({ title: 'Failed to add', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    const name = drafts[id]?.trim();
    if (!name) return;
    try {
      await renameCategory(id, name);
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
      await refresh();
    } catch (err: any) {
      toast({ title: 'Rename failed', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete category "${name}"? Existing threads keep their label but it won't appear in the picker.`)) return;
    try {
      await deleteCategory(id);
      await refresh();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage thread categories</DialogTitle>
          <DialogDescription>Add, rename, or remove categories available when posting threads.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const draft = drafts[cat.id];
            const dirty = draft !== undefined && draft.trim() !== cat.name;
            return (
              <div key={cat.id} className="flex items-center gap-2">
                <Input
                  value={draft ?? cat.name}
                  onChange={(e) => setDrafts((d) => ({ ...d, [cat.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!dirty}
                  onClick={() => handleRename(cat.id)}
                >
                  Save
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(cat.id, cat.name)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t pt-3">
          <Input
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <Button onClick={handleAdd} disabled={!newName.trim() || busy}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
