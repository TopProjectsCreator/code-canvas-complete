import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FileNode } from '@/types/ide';
import { useToast } from '@/hooks/use-toast';
import { createDataProvider } from '@/integrations/data/provider';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  files: FileNode[];
  language: string;
  is_public: boolean;
  forked_from: string | null;
  stars_count: number;
  publish_slug: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useProjects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const dataProvider = useMemo(() => createDataProvider(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const loadedProjects = await dataProvider.listProjects(user.id);
      setProjects(loadedProjects as Project[]);
    } catch (error: unknown) {
      toast({
        title: 'Error loading projects',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, dataProvider]);

  const saveProject = useCallback(async (
    name: string,
    files: FileNode[],
    language: string,
    description?: string,
    isPublic?: boolean,
    projectId?: string
  ) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save your project.',
        variant: 'destructive',
      });
      return null;
    }

    setLoading(true);
    try {
      if (projectId) {
        // Update existing project
        const updated = await dataProvider.updateProject({
          id: projectId,
          user_id: user.id,
          name,
          files,
          language,
          description: description || null,
          is_public: isPublic ?? false,
        });
        setCurrentProject(updated);
        setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
        
        toast({
          title: 'Project saved!',
          description: `"${name}" has been updated.`,
        });
        
        return updated;
      } else {
        // Create new project
        const newProject = await dataProvider.createProject({
          user_id: user.id,
          name,
          files,
          language,
          description: description || null,
          is_public: isPublic ?? false,
        });
        setCurrentProject(newProject);
        setProjects(prev => [newProject, ...prev]);
        
        toast({
          title: 'Project created!',
          description: `"${name}" has been saved to your account.`,
        });
        
        return newProject;
      }
    } catch (error: unknown) {
      toast({
        title: 'Error saving project',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, toast, dataProvider]);

  const loadProject = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const project = await dataProvider.getProjectById(projectId) as Project;
      setCurrentProject(project);
      
      return project;
    } catch (error: unknown) {
      toast({
        title: 'Error loading project',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, dataProvider]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      await dataProvider.deleteProject(projectId, user.id);

      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
      
      toast({
        title: 'Project deleted',
        description: 'The project has been removed.',
      });
      
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Error deleting project',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, currentProject, toast, dataProvider]);

  const forkProject = useCallback(async (project: Project) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to fork this project.',
        variant: 'destructive',
      });
      return null;
    }

    setLoading(true);
    try {
      const forkedProject = await dataProvider.createProject({
        user_id: user.id,
        name: `${project.name} (fork)`,
        files: project.files,
        language: project.language,
        description: project.description,
        is_public: false,
        forked_from: project.id,
      });
      setProjects(prev => [forkedProject, ...prev]);
      
      toast({
        title: 'Project forked!',
        description: `You now have your own copy of "${project.name}".`,
      });
      
      return forkedProject;
    } catch (error: unknown) {
      toast({
        title: 'Error forking project',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, toast, dataProvider]);

  const toggleStar = useCallback(async (projectId: string) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to star projects.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      // Check if already starred
      const existing = await dataProvider.getExistingStar(projectId, user.id);

      if (existing) {
        // Unstar
        await dataProvider.deleteStarById(existing.id);
        
        toast({ title: 'Removed star' });
      } else {
        // Star
        await dataProvider.createStar(projectId, user.id);
        
        toast({ title: 'Starred!' });
      }
      
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, dataProvider]);

  return {
    projects,
    currentProject,
    loading,
    fetchProjects,
    saveProject,
    loadProject,
    deleteProject,
    forkProject,
    toggleStar,
    setCurrentProject,
  };
};
