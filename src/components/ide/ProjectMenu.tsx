import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Pencil, LayoutTemplate, Check, X, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { LanguageTemplate } from '@/data/templateRegistry';
import { TEMPLATES } from '@/data/templateRegistry';
import { cn } from '@/lib/utils';

interface ProjectMenuProps {
  projectName: string;
  hasUnsavedChanges?: boolean;
  onRename: (newName: string) => void;
  onChangeTemplate: (template: LanguageTemplate) => void;
}

// Derive from registry — skip 'blank' since it doesn't make sense as a "change to" option
const templateOptions = TEMPLATES.filter((t) => t.id !== 'blank').map((t) => ({ id: t.id, name: t.name }));

export const ProjectMenu = ({ projectName, onRename, onChangeTemplate }: ProjectMenuProps) => {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showRenameDialog) {
      setNewName(projectName);
      setTimeout(() => {
        inputRef.current?.select();
      }, 50);
    }
  }, [showRenameDialog, projectName]);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed && trimmed !== projectName) {
      onRename(trimmed);
    }
    setShowRenameDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent transition-colors group">
            <span className="text-sm font-medium text-foreground">{projectName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            Rename project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Change template
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                {templateOptions.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => onChangeTemplate(t.id)}>
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>Enter a new name for your canvas</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="flex gap-2 pt-2">
            <Input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              className="flex-1"
              maxLength={50}
              autoFocus
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
