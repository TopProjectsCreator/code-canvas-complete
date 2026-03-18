import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
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

export interface UserSuggestion {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface RemoteFileUpdate {
  fileId: string;
  filePath: string;
  content: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

const PRESENCE_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1'];

export function useCollaboration(projectId: string | undefined) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [comments, setComments] = useState<CodeComment[]>([]);
  const [reviews, setReviews] = useState<CodeReview[]>([]);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [loading, setLoading] = useState(false);
  const [myRole, setMyRole] = useState<CollabRole | 'owner' | null>(null);
  const [inviteSuggestions, setInviteSuggestions] = useState<UserSuggestion[]>([]);
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [remoteFileUpdate, setRemoteFileUpdate] = useState<RemoteFileUpdate | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const workspaceChannelRef = useRef<RealtimeChannel | null>(null);
  const sessionIdRef = useRef(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`);

  const enrichProfiles = useCallback(async <T extends { user_id: string }>(rows: T[]) => {
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    if (userIds.length === 0) return rows as Array<T & { profile?: { display_name: string | null; avatar_url: string | null } }>;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map((entry) => [entry.user_id, entry]) || []);
    return rows.map((row) => ({ ...row, profile: profileMap.get(row.user_id) || undefined }));
  }, []);

  const fetchCollaborators = useCallback(async () => {
    if (!projectId || !user) return;
    const { data } = await supabase.from('project_collaborators').select('*').eq('project_id', projectId);
    if (!data) return;

    const enriched = await enrichProfiles(data);
    setCollaborators(enriched.map((entry) => ({ ...entry, role: entry.role as CollabRole })));
  }, [enrichProfiles, projectId, user]);

  const fetchComments = useCallback(async () => {
    if (!projectId || !user) return;
    const { data } = await supabase
      .from('code_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (!data) return;
    const enriched = await enrichProfiles(data);
    setComments(enriched);
  }, [enrichProfiles, projectId, user]);

  const fetchReviews = useCallback(async () => {
    if (!projectId || !user) return;
    const { data } = await supabase
      .from('code_reviews')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!data) return;

    const userIds = [...new Set(data.flatMap((row) => [row.requester_id, row.reviewer_id]))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map((entry) => [entry.user_id, entry]) || []);
    setReviews(
      data.map((row) => ({
        ...row,
        status: row.status as CodeReview['status'],
        file_paths: row.file_paths || [],
        requester_profile: profileMap.get(row.requester_id) || undefined,
        reviewer_profile: profileMap.get(row.reviewer_id) || undefined,
      })),
    );
  }, [projectId, user]);

  useEffect(() => {
    if (!projectId || !user) {
      setMyRole(null);
      return;
    }

    const checkRole = async () => {
      const { data: project } = await supabase.from('projects').select('user_id').eq('id', projectId).single();
      if (project?.user_id === user.id) {
        setMyRole('owner');
        return;
      }
      const collab = collaborators.find((entry) => entry.user_id === user.id && entry.accepted);
      setMyRole(collab?.role || null);
    };

    void checkRole();
  }, [collaborators, projectId, user]);

  useEffect(() => {
    if (!projectId || !user) return;
    setLoading(true);
    Promise.all([fetchCollaborators(), fetchComments(), fetchReviews()]).finally(() => setLoading(false));
  }, [fetchCollaborators, fetchComments, fetchReviews, projectId, user]);

  useEffect(() => {
    if (!projectId || !user || !profile) return;

    const colorIndex = user.id.charCodeAt(0) % PRESENCE_COLORS.length;
    const channel = supabase.channel(`presence:${projectId}`, {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const peers: PresenceState[] = [];
        for (const entries of Object.values(state)) {
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

    return () => {
      if (presenceChannelRef.current?.topic === channel.topic) {
        presenceChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [projectId, profile, user]);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase.channel(`comments:${projectId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'code_comments', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (payload.new && (payload.new as { user_id?: string }).user_id !== user?.id) {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const settings = JSON.parse(localStorage.getItem('ide-notification-settings') || '{}');
            if (settings.desktopEnabled) {
              const inserted = payload.new as { id: string; file_path: string; line_number: number };
              new Notification('New code comment', {
                body: `Comment on ${inserted.file_path}:${inserted.line_number}`,
                icon: '/favicon.ico',
                tag: `comment-${inserted.id}`,
              });
            }
          }
        }
        void fetchComments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'code_comments', filter: `project_id=eq.${projectId}` }, () => {
        void fetchComments();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchComments, projectId, user]);

  useEffect(() => {
    if (!projectId || !user) return;

    const channel = supabase.channel(`workspace:${projectId}`, {
      config: { broadcast: { self: false } },
    });
    workspaceChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'file-update' }, ({ payload }) => {
        const message = payload as RemoteFileUpdate & { sessionId?: string };
        if (!message || message.updatedBy === user.id || message.sessionId === sessionIdRef.current) return;
        setRemoteFileUpdate({
          fileId: message.fileId,
          filePath: message.filePath,
          content: message.content,
          updatedBy: message.updatedBy,
          updatedByName: message.updatedByName,
          updatedAt: message.updatedAt,
        });
      })
      .subscribe();

    return () => {
      if (workspaceChannelRef.current?.topic === channel.topic) {
        workspaceChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [projectId, user]);

  const updatePresence = useCallback(async (updates: Partial<PresenceState>) => {
    if (!projectId || !user) return;
    const channel = presenceChannelRef.current;
    if (!channel) return;

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
  }, [projectId, profile, user]);

  const searchInviteCandidates = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setInviteSuggestions([]);
      return [];
    }

    setInviteSearchLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .or(`display_name.ilike.%${trimmed}%,user_id.eq.${trimmed}`)
      .limit(6);
    setInviteSearchLoading(false);

    if (error) {
      toast({ title: 'Could not load suggestions', description: error.message, variant: 'destructive' });
      return [];
    }

    const suggestions = (data || [])
      .filter((entry) => entry.user_id !== user?.id)
      .map((entry) => ({
        userId: entry.user_id,
        displayName: entry.display_name || 'Unnamed user',
        avatarUrl: entry.avatar_url,
      }));

    setInviteSuggestions(suggestions);
    return suggestions;
  }, [toast, user]);

  const inviteCollaborator = useCallback(async (email: string, role: CollabRole) => {
    if (!projectId) {
      toast({ title: 'Save project first', description: 'You need to save your project before inviting collaborators.', variant: 'destructive' });
      return false;
    }
    if (!user) return false;

    const { error } = await supabase.from('project_collaborators').insert({
      project_id: projectId,
      user_id: user.id,
      invited_by: user.id,
      role,
      invited_email: email,
      accepted: false,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already invited', description: `${email} has already been invited to this project.`, variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      return false;
    }

    toast({ title: 'Invitation sent', description: `Invited ${email} as ${role}` });
    void fetchCollaborators();
    return true;
  }, [fetchCollaborators, projectId, toast, user]);

  const inviteCollaboratorByUser = useCallback(async (candidate: UserSuggestion, role: CollabRole) => {
    if (!projectId || !user) return false;

    const { error } = await supabase.from('project_collaborators').insert({
      project_id: projectId,
      user_id: candidate.userId,
      invited_by: user.id,
      role,
      invited_email: null,
      accepted: true,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already added', description: `${candidate.displayName} already has access.`, variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      return false;
    }

    toast({ title: 'Collaborator added', description: `${candidate.displayName} can jump in right away.` });
    setInviteSuggestions([]);
    void fetchCollaborators();
    return true;
  }, [fetchCollaborators, projectId, toast, user]);

  const removeCollaborator = useCallback(async (collabId: string) => {
    const { error } = await supabase.from('project_collaborators').delete().eq('id', collabId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Collaborator removed' });
    void fetchCollaborators();
    return true;
  }, [fetchCollaborators, toast]);

  const updateCollaboratorRole = useCallback(async (collabId: string, role: CollabRole) => {
    const { error } = await supabase.from('project_collaborators').update({ role }).eq('id', collabId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    void fetchCollaborators();
    return true;
  }, [fetchCollaborators, toast]);

  const addComment = useCallback(async (filePath: string, lineNumber: number, content: string, parentId?: string) => {
    if (!projectId || !user) return false;
    const { error } = await supabase.from('code_comments').insert({
      project_id: projectId,
      user_id: user.id,
      file_path: filePath,
      line_number: lineNumber,
      content,
      parent_id: parentId || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  }, [projectId, toast, user]);

  const resolveComment = useCallback(async (commentId: string, resolved: boolean) => {
    const { error } = await supabase.from('code_comments').update({ resolved }).eq('id', commentId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    void fetchComments();
    return true;
  }, [fetchComments, toast]);

  const deleteComment = useCallback(async (commentId: string) => {
    const { error } = await supabase.from('code_comments').delete().eq('id', commentId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  }, [toast]);

  const requestReview = useCallback(async (reviewerId: string, title: string, description?: string, filePaths?: string[]) => {
    if (!projectId || !user) return false;
    const { error } = await supabase.from('code_reviews').insert({
      project_id: projectId,
      requester_id: user.id,
      reviewer_id: reviewerId,
      title,
      description: description || null,
      file_paths: filePaths || [],
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Review requested' });
    void fetchReviews();
    return true;
  }, [fetchReviews, projectId, toast, user]);

  const updateReviewStatus = useCallback(async (reviewId: string, status: CodeReview['status']) => {
    const { error } = await supabase.from('code_reviews').update({ status }).eq('id', reviewId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    void fetchReviews();
    return true;
  }, [fetchReviews, toast]);

  const broadcastFileChange = useCallback(async (update: Omit<RemoteFileUpdate, 'updatedBy' | 'updatedByName' | 'updatedAt'>) => {
    if (!user || !workspaceChannelRef.current) return;
    await workspaceChannelRef.current.send({
      type: 'broadcast',
      event: 'file-update',
      payload: {
        ...update,
        sessionId: sessionIdRef.current,
        updatedBy: user.id,
        updatedByName: profile?.display_name || user.email?.split('@')[0] || 'User',
        updatedAt: new Date().toISOString(),
      },
    });
  }, [profile, user]);

  return {
    collaborators,
    comments,
    reviews,
    presence,
    loading,
    myRole,
    inviteSuggestions,
    inviteSearchLoading,
    remoteFileUpdate,
    inviteCollaborator,
    inviteCollaboratorByUser,
    removeCollaborator,
    updateCollaboratorRole,
    addComment,
    resolveComment,
    deleteComment,
    requestReview,
    updateReviewStatus,
    updatePresence,
    fetchCollaborators,
    fetchComments,
    fetchReviews,
    searchInviteCandidates,
    broadcastFileChange,
  };
}
