import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type CollabRole = 'viewer' | 'editor' | 'admin';

export interface Collaborator {
  id: string;
  project_id: string;
  user_id: string;
  invited_by: string;
  role: CollabRole;
  invited_email: string | null;
  accepted: boolean;
  created_at: string;
  updated_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

export interface CodeComment {
  id: string;
  project_id: string;
  user_id: string;
  file_path: string;
  line_number: number;
  content: string;
  resolved: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

export interface CodeReview {
  id: string;
  project_id: string;
  requester_id: string;
  reviewer_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'changes_requested' | 'closed';
  file_paths: string[];
  created_at: string;
  updated_at: string;
  requester_profile?: { display_name: string | null; avatar_url: string | null };
  reviewer_profile?: { display_name: string | null; avatar_url: string | null };
}

export interface PresenceState {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  currentFile: string | null;
  cursorLine: number | null;
  cursorCol: number | null;
  lastSeen: string;
}

const PRESENCE_COLORS = [
  '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1'
];

export function useCollaboration(projectId: string | undefined) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [comments, setComments] = useState<CodeComment[]>([]);
  const [reviews, setReviews] = useState<CodeReview[]>([]);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [loading, setLoading] = useState(false);
  const [myRole, setMyRole] = useState<CollabRole | 'owner' | null>(null);

  // Fetch collaborators
  const fetchCollaborators = useCallback(async () => {
    if (!projectId || !user) return;
    const { data } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', projectId);
    
    if (data) {
      // Fetch profiles for collaborators
      const userIds = data.map(c => c.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const enriched = data.map(c => ({
        ...c,
        role: c.role as CollabRole,
        profile: profileMap.get(c.user_id) || undefined,
      }));
      setCollaborators(enriched);
    }
  }, [projectId, user]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!projectId || !user) return;
    const { data } = await supabase
      .from('code_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setComments(data.map(c => ({ ...c, profile: profileMap.get(c.user_id) || undefined })));
    }
  }, [projectId, user]);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    if (!projectId || !user) return;
    const { data } = await supabase
      .from('code_reviews')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (data) {
      const userIds = [...new Set(data.flatMap(r => [r.requester_id, r.reviewer_id]))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setReviews(data.map(r => ({
        ...r,
        status: r.status as CodeReview['status'],
        file_paths: r.file_paths || [],
        requester_profile: profileMap.get(r.requester_id) || undefined,
        reviewer_profile: profileMap.get(r.reviewer_id) || undefined,
      })));
    }
  }, [projectId, user]);

  // Determine my role
  useEffect(() => {
    if (!projectId || !user) { setMyRole(null); return; }
    
    const checkRole = async () => {
      const { data: proj } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single();
      
      if (proj?.user_id === user.id) {
        setMyRole('owner');
      } else {
        const collab = collaborators.find(c => c.user_id === user.id && c.accepted);
        setMyRole(collab?.role || null);
      }
    };
    checkRole();
  }, [projectId, user, collaborators]);

  // Initial fetch
  useEffect(() => {
    if (!projectId || !user) return;
    setLoading(true);
    Promise.all([fetchCollaborators(), fetchComments(), fetchReviews()]).finally(() => setLoading(false));
  }, [fetchCollaborators, fetchComments, fetchReviews, projectId, user]);

  // Realtime presence
  useEffect(() => {
    if (!projectId || !user || !profile) return;

    const colorIndex = user.id.charCodeAt(0) % PRESENCE_COLORS.length;
    const channel = supabase.channel(`presence:${projectId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const peers: PresenceState[] = [];
        for (const [, entries] of Object.entries(state)) {
          for (const entry of entries as PresenceState[]) {
            if (entry.userId !== user.id) peers.push(entry);
          }
        }
        setPresence(peers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            displayName: profile.display_name || user.email?.split('@')[0] || 'User',
            avatarUrl: profile.avatar_url,
            color: PRESENCE_COLORS[colorIndex],
            currentFile: null,
            cursorLine: null,
            cursorCol: null,
            lastSeen: new Date().toISOString(),
          });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [projectId, user, profile]);

  // Realtime comments subscription
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`comments:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'code_comments', filter: `project_id=eq.${projectId}` }, () => {
        fetchComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchComments]);

  // Update presence
  const updatePresence = useCallback(async (updates: Partial<PresenceState>) => {
    if (!projectId || !user) return;
    const channel = supabase.channel(`presence:${projectId}`);
    // Track is idempotent, updates the existing state
    const colorIndex = user.id.charCodeAt(0) % PRESENCE_COLORS.length;
    await channel.track({
      userId: user.id,
      displayName: profile?.display_name || user.email?.split('@')[0] || 'User',
      avatarUrl: profile?.avatar_url || null,
      color: PRESENCE_COLORS[colorIndex],
      currentFile: null,
      cursorLine: null,
      cursorCol: null,
      lastSeen: new Date().toISOString(),
      ...updates,
    });
  }, [projectId, user, profile]);

  // Invite collaborator
  const inviteCollaborator = async (email: string, role: CollabRole) => {
    if (!projectId || !user) return false;

    // Find user by email via profiles (we search by display_name or check auth)
    // For simplicity, look up user via their email in auth metadata
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('user_id, display_name');

    // We need to search by email - but profiles don't store email
    // We'll store invited_email and the user accepts when they log in
    const { error } = await supabase.from('project_collaborators').insert({
      project_id: projectId,
      user_id: user.id, // Placeholder - will be updated when user accepts
      invited_by: user.id,
      role,
      invited_email: email,
      accepted: false,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Invitation sent', description: `Invited ${email} as ${role}` });
    fetchCollaborators();
    return true;
  };

  // Remove collaborator
  const removeCollaborator = async (collabId: string) => {
    const { error } = await supabase.from('project_collaborators').delete().eq('id', collabId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Collaborator removed' });
    fetchCollaborators();
    return true;
  };

  // Update collaborator role
  const updateCollaboratorRole = async (collabId: string, role: CollabRole) => {
    const { error } = await supabase.from('project_collaborators').update({ role }).eq('id', collabId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    fetchCollaborators();
    return true;
  };

  // Add comment
  const addComment = async (filePath: string, lineNumber: number, content: string, parentId?: string) => {
    if (!projectId || !user) return false;
    const { error } = await supabase.from('code_comments').insert({
      project_id: projectId,
      user_id: user.id,
      file_path: filePath,
      line_number: lineNumber,
      content,
      parent_id: parentId || null,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    return true;
  };

  // Resolve comment
  const resolveComment = async (commentId: string, resolved: boolean) => {
    const { error } = await supabase.from('code_comments').update({ resolved }).eq('id', commentId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    fetchComments();
    return true;
  };

  // Delete comment
  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from('code_comments').delete().eq('id', commentId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    return true;
  };

  // Request review
  const requestReview = async (reviewerId: string, title: string, description?: string, filePaths?: string[]) => {
    if (!projectId || !user) return false;
    const { error } = await supabase.from('code_reviews').insert({
      project_id: projectId,
      requester_id: user.id,
      reviewer_id: reviewerId,
      title,
      description: description || null,
      file_paths: filePaths || [],
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Review requested' });
    fetchReviews();
    return true;
  };

  // Update review status
  const updateReviewStatus = async (reviewId: string, status: CodeReview['status']) => {
    const { error } = await supabase.from('code_reviews').update({ status }).eq('id', reviewId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    fetchReviews();
    return true;
  };

  return {
    collaborators, comments, reviews, presence, loading, myRole,
    inviteCollaborator, removeCollaborator, updateCollaboratorRole,
    addComment, resolveComment, deleteComment,
    requestReview, updateReviewStatus,
    updatePresence, fetchCollaborators, fetchComments, fetchReviews,
  };
}
