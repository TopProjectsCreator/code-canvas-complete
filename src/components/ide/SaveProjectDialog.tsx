import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { FileNode } from '@/types/ide';
import { useProjects, Project } from '@/hooks/useProjects';

interface SaveProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: FileNode[];
  language: string;
  currentProject: Project | null;
  onSaved: (project: Project) => void;
}

export const SaveProjectDialog = ({
  open,
  onOpenChange,
  files,
  language,
  currentProject,
  onSaved,
}: SaveProjectDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const { saveProject, loading } = useProjects();

  useEffect(() => {
    if (open && currentProject) {
      setName(currentProject.name);
      setDescription(currentProject.description || '');
      setIsPublic(currentProject.is_public);
    } else if (open) {
      setName('my-repl');
      setDescription('');
      setIsPublic(false);
    }
  }, [open, currentProject]);

  const handleSave = async () => {
    if (!name.trim()) return;

    const result = await saveProject(
      name.trim(),
      files,
      language,
      description.trim() || undefined,
      isPublic,
      currentProject?.id
    );

    if (result) {
      onSaved(result);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            {currentProject ? 'Update Project' : 'Save Project'}
          </DialogTitle>
          <DialogDescription>
            {currentProject 
              ? 'Update your project settings and save changes'
              : 'Save your repl to your account'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-project"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your project"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="public">Public</Label>
              <p className="text-xs text-muted-foreground">
                Allow others to view and fork this project
              </p>
            </div>
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {currentProject ? 'Update' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
