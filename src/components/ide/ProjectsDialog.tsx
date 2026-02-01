import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjects, Project } from '@/hooks/useProjects';
import { formatDistanceToNow } from 'date-fns';
import { 
  FolderOpen, 
  Trash2, 
  Star, 
  GitFork, 
  Globe, 
  Lock,
  Loader2,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
}

export const ProjectsDialog = ({ 
  open, 
  onOpenChange, 
  onSelectProject,
  onNewProject 
}: ProjectsDialogProps) => {
  const { projects, loading, fetchProjects, deleteProject } = useProjects();

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open, fetchProjects]);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteProject(projectId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            My Projects
          </DialogTitle>
          <DialogDescription>
            Open a saved project or create a new one
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          <Button onClick={() => { onNewProject(); onOpenChange(false); }} className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">No projects yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Create your first project to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => { onSelectProject(project); onOpenChange(false); }}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border border-border",
                    "hover:bg-accent cursor-pointer transition-colors group"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{project.name}</h4>
                      {project.is_public ? (
                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {project.forked_from && (
                        <GitFork className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="capitalize">{project.language}</span>
                      <span>•</span>
                      <span>
                        Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                      </span>
                      {project.stars_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {project.stars_count}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDelete(e, project.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
