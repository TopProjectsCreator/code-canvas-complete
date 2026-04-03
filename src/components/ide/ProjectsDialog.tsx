import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  Plus,
  Search,
  Tags,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
}

type SortMode = 'updated' | 'folder' | 'template';

type ProjectLabelsMap = Record<string, string[]>;

const LABEL_STORAGE_KEY = 'projectLabelsMap';

const normalizeFolderName = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 1 ? parts[0] : 'Root';
};

const collectProjectFolders = (project: Project) => {
  const folderNames = new Set<string>();

  const walk = (nodes: Project['files'], currentTopLevelFolder: string | null = null) => {
    nodes.forEach((node) => {
      if (node.type === 'folder') {
        const topLevelFolder = currentTopLevelFolder ?? node.name;
        folderNames.add(topLevelFolder);
        if (node.children) {
          walk(node.children, topLevelFolder);
        }
        return;
      }

      if (currentTopLevelFolder) {
        folderNames.add(currentTopLevelFolder);
      } else {
        folderNames.add(normalizeFolderName(node.name));
      }
    });
  };

  walk(project.files || []);
  return Array.from(folderNames).sort((a, b) => a.localeCompare(b));
};

export const ProjectsDialog = ({
  open,
  onOpenChange,
  onSelectProject,
  onNewProject,
}: ProjectsDialogProps) => {
  const { projects, loading, fetchProjects, deleteProject } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [projectLabels, setProjectLabels] = useState<ProjectLabelsMap>({});
  const [pendingLabels, setPendingLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open, fetchProjects]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(LABEL_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as ProjectLabelsMap;
      setProjectLabels(parsed);
    } catch {
      setProjectLabels({});
    }
  }, []);

  const persistLabels = (next: ProjectLabelsMap) => {
    setProjectLabels(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const handleDelete = async (e: MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteProject(projectId);
    }
  };

  const handleAddLabel = (projectId: string) => {
    const value = (pendingLabels[projectId] || '').trim();
    if (!value) return;

    const existing = projectLabels[projectId] || [];
    if (existing.includes(value)) return;

    const next = {
      ...projectLabels,
      [projectId]: [...existing, value],
    };

    persistLabels(next);
    setPendingLabels((prev) => ({ ...prev, [projectId]: '' }));
  };

  const handleRemoveLabel = (e: MouseEvent, projectId: string, label: string) => {
    e.stopPropagation();
    const existing = projectLabels[projectId] || [];
    const nextLabels = existing.filter((current) => current !== label);
    const next: ProjectLabelsMap = { ...projectLabels };

    if (nextLabels.length === 0) {
      delete next[projectId];
    } else {
      next[projectId] = nextLabels;
    }

    persistLabels(next);
  };

  const sortedAndFilteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = projects.filter((project) => {
      if (!normalizedQuery) return true;

      const labels = projectLabels[project.id] || [];
      const folders = collectProjectFolders(project);
      return (
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.language.toLowerCase().includes(normalizedQuery) ||
        folders.some((folder) => folder.toLowerCase().includes(normalizedQuery)) ||
        labels.some((label) => label.toLowerCase().includes(normalizedQuery))
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'folder') {
        const folderDiff = collectProjectFolders(b).length - collectProjectFolders(a).length;
        if (folderDiff !== 0) return folderDiff;
      }

      if (sortMode === 'template') {
        const templateDiff = a.language.localeCompare(b.language);
        if (templateDiff !== 0) return templateDiff;
      }

      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [projects, projectLabels, searchQuery, sortMode]);

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

        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, template, folder, or label"
              className="pl-8"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={sortMode} onValueChange={(value: SortMode) => setSortMode(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sort projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Sort: Recently updated</SelectItem>
                <SelectItem value="folder">Sort: Folder count</SelectItem>
                <SelectItem value="template">Sort: Template (language)</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => { onNewProject(); onOpenChange(false); }} className="gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
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
          ) : sortedAndFilteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">No matching projects</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Try a different search or remove some filters
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAndFilteredProjects.map((project) => {
                const labels = projectLabels[project.id] || [];
                const folders = collectProjectFolders(project);

                return (
                  <div
                    key={project.id}
                    onClick={() => { onSelectProject(project); onOpenChange(false); }}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border border-border',
                      'hover:bg-accent cursor-pointer transition-colors group'
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
                        <span>{folders.length} folder{folders.length === 1 ? '' : 's'}</span>
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

                      {labels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {labels.map((label) => (
                            <Badge key={`${project.id}-${label}`} variant="secondary" className="gap-1">
                              <Tags className="w-3 h-3" />
                              {label}
                              <button
                                type="button"
                                onClick={(e) => handleRemoveLabel(e, project.id, label)}
                                className="hover:text-foreground/90"
                                aria-label={`Remove label ${label}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={pendingLabels[project.id] || ''}
                          onChange={(e) =>
                            setPendingLabels((prev) => ({
                              ...prev,
                              [project.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddLabel(project.id);
                            }
                          }}
                          placeholder="Add label"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleAddLabel(project.id)}
                        >
                          Add
                        </Button>
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
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
