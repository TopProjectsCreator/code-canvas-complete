import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FileNode } from '@/types/ide';
import { useToast } from '@/hooks/use-toast';

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
  created_at: string;
  updated_at: string;
}

export const useProjects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Parse files from JSONB
      const parsedProjects = (data || []).map(p => ({
        ...p,
        files: Array.isArray(p.files) ? (p.files as unknown as FileNode[]) : [],
      }));
      
      setProjects(parsedProjects);
    } catch (error: any) {
      toast({
        title: 'Error loading projects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

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
        const { data, error } = await supabase
          .from('projects')
          .update({
            name,
            files: JSON.parse(JSON.stringify(files)),
            language,
            description: description || null,
            is_public: isPublic ?? false,
          })
          .eq('id', projectId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        const updated = { ...data, files: files };
        setCurrentProject(updated);
        setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
        
        toast({
          title: 'Project saved!',
          description: `"${name}" has been updated.`,
        });
        
        return updated;
      } else {
        // Create new project
        const { data, error } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name,
            files: JSON.parse(JSON.stringify(files)),
            language,
            description: description || null,
            is_public: isPublic ?? false,
          })
          .select()
          .single();

        if (error) throw error;

        const newProject = { ...data, files: files };
        setCurrentProject(newProject);
        setProjects(prev => [newProject, ...prev]);
        
        toast({
          title: 'Project created!',
          description: `"${name}" has been saved to your account.`,
        });
        
        return newProject;
      }
    } catch (error: any) {
      toast({
        title: 'Error saving project',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const loadProject = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      const project = { 
        ...data, 
        files: Array.isArray(data.files) ? (data.files as unknown as FileNode[]) : [] 
      };
      setCurrentProject(project);
      
      return project;
    } catch (error: any) {
      toast({
        title: 'Error loading project',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
      
      toast({
        title: 'Project deleted',
        description: 'The project has been removed.',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error deleting project',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, currentProject, toast]);

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
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: `${project.name} (fork)`,
          files: JSON.parse(JSON.stringify(project.files)),
          language: project.language,
          description: project.description,
          is_public: false,
          forked_from: project.id,
        })
        .select()
        .single();

      if (error) throw error;

      const forkedProject = { ...data, files: project.files };
      setProjects(prev => [forkedProject, ...prev]);
      
      toast({
        title: 'Project forked!',
        description: `You now have your own copy of "${project.name}".`,
      });
      
      return forkedProject;
    } catch (error: any) {
      toast({
        title: 'Error forking project',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

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
      const { data: existing } = await supabase
        .from('project_stars')
        .select('id')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .single();

      if (existing) {
        // Unstar
        await supabase
          .from('project_stars')
          .delete()
          .eq('id', existing.id);
        
        toast({ title: 'Removed star' });
      } else {
        // Star
        await supabase
          .from('project_stars')
          .insert({ user_id: user.id, project_id: projectId });
        
        toast({ title: 'Starred!' });
      }
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast]);

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
