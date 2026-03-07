import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Pencil, LayoutTemplate, Check, X } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LanguageTemplate } from './LanguagePicker';
import { cn } from '@/lib/utils';

interface ProjectMenuProps {
  projectName: string;
  onRename: (newName: string) => void;
  onChangeTemplate: (template: LanguageTemplate) => void;
}

const templateOptions: { id: LanguageTemplate; name: string }[] = [
  { id: 'html', name: 'HTML/CSS/JS' },
  { id: 'react', name: 'React' },
  { id: 'nodejs', name: 'Node.js' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'python', name: 'Python' },
  { id: 'flask', name: 'Flask' },
  { id: 'django', name: 'Django' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' },
  { id: 'c', name: 'C' },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'php', name: 'PHP' },
  { id: 'csharp', name: 'C#' },
  { id: 'bash', name: 'Bash' },
  { id: 'lua', name: 'Lua' },
  { id: 'r', name: 'R' },
  { id: 'haskell', name: 'Haskell' },
  { id: 'zig', name: 'Zig' },
  { id: 'nim', name: 'Nim' },
  { id: 'lisp', name: 'Common Lisp' },
  { id: 'd', name: 'D' },
  { id: 'groovy', name: 'Groovy' },
  { id: 'pascal', name: 'Pascal' },
  { id: 'perl', name: 'Perl' },
  { id: 'arduino', name: 'Arduino' },
  { id: 'scratch', name: 'Scratch' },
];

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
