import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextComposer } from './RichTextComposer';
import { useCollaboration, CollabRole, CodeComment, CodeReview, PresenceState } from '@/hooks/useCollaboration';
import { useAuth } from '@/contexts/AuthContext';
import { richTextToPlainText, sanitizeRichText } from '@/lib/richText';
import { cn } from '@/lib/utils';
import {
  Users, UserPlus, MessageSquare, GitPullRequest, Trash2, Check,
  Clock, CheckCircle2, XCircle, AlertCircle, Send, Loader2, Eye,
  Pencil, Shield, Crown, Circle, Search, AtSign,
} from 'lucide-react';

interface CollabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | undefined;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  editor: <Pencil className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-primary/15 text-primary border-primary/30',
  admin: 'bg-destructive/15 text-destructive border-destructive/30',
  editor: 'bg-info/15 text-info border-info/30',
  viewer: 'bg-muted text-muted-foreground border-border',
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Pending', color: 'bg-warning/15 text-warning' },
  approved: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Approved', color: 'bg-success/15 text-success' },
  changes_requested: { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Changes Requested', color: 'bg-destructive/15 text-destructive' },
  closed: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Closed', color: 'bg-muted text-muted-foreground' },
};

export const CollabDialog = ({ open, onOpenChange, projectId }: CollabDialogProps) => {
  const hasProject = !!projectId;
  const { user } = useAuth();
  const collab = useCollaboration(projectId);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Collaboration
          </DialogTitle>
          <DialogDescription>
            Team access, comment history, and reviews. Inline comments now live in the editor itself.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="team" className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="team" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Team
              {collab.presence.length > 0 && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-success/20 text-[10px] text-success">{collab.presence.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="invite" className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Invite
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Comments
              {collab.comments.filter((comment) => !comment.resolved).length > 0 && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">{collab.comments.filter((comment) => !comment.resolved).length}</span>}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5 text-xs">
              <GitPullRequest className="h-3.5 w-3.5" /> Reviews
              {collab.reviews.filter((review) => review.status === 'pending').length > 0 && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning/20 text-[10px] text-warning">{collab.reviews.filter((review) => review.status === 'pending').length}</span>}
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 flex-1 overflow-auto pr-1">
            <TabsContent value="team" className="mt-0">
              <TeamTab collab={collab} />
            </TabsContent>
            <TabsContent value="invite" className="mt-0">
              <InviteTab collab={collab} hasProject={hasProject} />
            </TabsContent>
            <TabsContent value="comments" className="mt-0">
              <CommentsTab collab={collab} userId={user.id} />
            </TabsContent>
            <TabsContent value="reviews" className="mt-0">
              <ReviewsTab collab={collab} userId={user.id} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

function TeamTab({ collab }: { collab: ReturnType<typeof useCollaboration> }) {
  return (
    <div className="space-y-4">
      {collab.presence.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Online now</h4>
          <div className="flex flex-wrap gap-2">
            {collab.presence.map((entry) => (
              <div key={entry.userId} className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1.5">
                <div className="relative">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={entry.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px]" style={{ backgroundColor: entry.color }}>{entry.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <Circle className="absolute -bottom-0.5 -right-0.5 h-2 w-2 fill-success text-success" />
                </div>
                <span className="text-xs font-medium">{entry.displayName}</span>
                {entry.currentFile && <span className="font-mono text-[10px] text-muted-foreground">{entry.currentFile}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Collaborators</h4>
        {collab.collaborators.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">No collaborators yet</p>
            <p className="mt-1 text-xs">Invite teammates to start commenting inline and editing live.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {collab.collaborators.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={entry.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted text-xs">{(entry.profile?.display_name || entry.invited_email || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.profile?.display_name || entry.invited_email || 'Unknown'}</p>
                  {!entry.accepted && <p className="text-xs text-warning">Pending invitation</p>}
                </div>
                <Badge variant="outline" className={cn('gap-1 text-[10px]', ROLE_COLORS[entry.role])}>{ROLE_ICONS[entry.role]} {entry.role}</Badge>
                {collab.myRole === 'owner' && (
                  <button type="button" onClick={() => collab.removeCollaborator(entry.id)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InviteTab({ collab, hasProject = true }: { collab: ReturnType<typeof useCollaboration>; hasProject?: boolean }) {
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState<CollabRole>('editor');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (identifier.includes('@')) return;
      void collab.searchInviteCandidates(identifier);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [collab, identifier]);

  const handleInviteEmail = async () => {
    if (!identifier.trim()) return;
    setSending(true);
    const ok = await collab.inviteCollaborator(identifier.trim(), role);
    setSending(false);
    if (ok) setIdentifier('');
  };

  const usernameSuggestions = useMemo(
    () => collab.inviteSuggestions.filter((candidate) => !collab.collaborators.some((existing) => existing.user_id === candidate.userId)),
    [collab.collaborators, collab.inviteSuggestions],
  );

  return (
    <div className="space-y-4">
      {!hasProject && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Save your project first before inviting collaborators.</span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="mb-4">
          <h4 className="text-sm font-medium">Invite by username</h4>
          <p className="text-xs text-muted-foreground">Start typing a teammate name to get suggestions, then add them instantly.</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Search display name or paste email" className="pl-9" />
          </div>

          <Select value={role} onValueChange={(value) => setRole(value as CollabRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer"><div className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Viewer — can view files</div></SelectItem>
              <SelectItem value="editor"><div className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Editor — can edit files</div></SelectItem>
              <SelectItem value="admin"><div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Admin — can manage project</div></SelectItem>
            </SelectContent>
          </Select>

          {!identifier.includes('@') && (
            <div className="rounded-lg border border-border/60 bg-background/70 p-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <AtSign className="h-3.5 w-3.5" /> Suggested teammates
              </div>
              {collab.inviteSearchLoading ? (
                <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking for usernames…</div>
              ) : usernameSuggestions.length > 0 ? (
                <div className="space-y-2">
                  {usernameSuggestions.map((candidate) => (
                    <button
                      key={candidate.userId}
                      type="button"
                      disabled={!hasProject || sending}
                      onClick={async () => {
                        setSending(true);
                        const ok = await collab.inviteCollaboratorByUser(candidate, role);
                        setSending(false);
                        if (ok) setIdentifier('');
                      }}
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={candidate.avatarUrl || undefined} />
                        <AvatarFallback>{candidate.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{candidate.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{candidate.userId}</p>
                      </div>
                      <Badge variant="outline">Add</Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-3 text-xs text-muted-foreground">No username suggestions yet. Type more, or invite with email below.</p>
              )}
            </div>
          )}

          <Button onClick={handleInviteEmail} disabled={!identifier.trim() || sending || !hasProject || !identifier.includes('@')} className="w-full gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Send email invite
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentsTab({ collab, userId }: { collab: ReturnType<typeof useCollaboration>; userId: string }) {
  const [newComment, setNewComment] = useState('');
  const [filePath, setFilePath] = useState('');
  const [lineNum, setLineNum] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    const safeComment = sanitizeRichText(newComment);
    if (!richTextToPlainText(safeComment) || !filePath.trim() || !lineNum.trim()) return;
    setPosting(true);
    const ok = await collab.addComment(filePath.trim(), parseInt(lineNum, 10) || 1, safeComment);
    setPosting(false);
    if (ok) setNewComment('');
  };

  const unresolvedComments = collab.comments.filter((comment) => !comment.resolved && !comment.parent_id);
  const resolvedComments = collab.comments.filter((comment) => comment.resolved && !comment.parent_id);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
        <h4 className="text-sm font-medium">Legacy comment form</h4>
        <p className="text-xs text-muted-foreground">Inline comments are now the default in the editor. Use this only if you already know the file and line.</p>
        <div className="flex gap-2">
          <Input placeholder="File path" value={filePath} onChange={(event) => setFilePath(event.target.value)} className="flex-1" />
          <Input placeholder="Line #" type="number" value={lineNum} onChange={(event) => setLineNum(event.target.value)} className="w-20" />
        </div>
        <RichTextComposer value={newComment} onChange={setNewComment} placeholder="Write your comment…" minHeightClassName="min-h-[88px]" />
        <div className="flex justify-end">
          <Button size="sm" onClick={handlePost} disabled={!filePath.trim() || !richTextToPlainText(newComment) || posting} className="gap-2">
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Add comment
          </Button>
        </div>
      </div>

      {unresolvedComments.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Open ({unresolvedComments.length})</h4>
          <div className="space-y-2">
            {unresolvedComments.map((comment) => <CommentCard key={comment.id} comment={comment} collab={collab} userId={userId} />)}
          </div>
        </div>
      )}

      {resolvedComments.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Resolved ({resolvedComments.length})</h4>
          <div className="space-y-2 opacity-70">
            {resolvedComments.map((comment) => <CommentCard key={comment.id} comment={comment} collab={collab} userId={userId} />)}
          </div>
        </div>
      )}

      {collab.comments.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">No comments yet</p>
          <p className="mt-1 text-xs">Highlight a line in the editor to start an inline thread.</p>
        </div>
      )}
    </div>
  );
}

function CommentCard({ comment, collab, userId }: { comment: CodeComment; collab: ReturnType<typeof useCollaboration>; userId: string }) {
  const replies = collab.comments.filter((entry) => entry.parent_id === comment.id);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = async () => {
    const safeReply = sanitizeRichText(reply);
    if (!richTextToPlainText(safeReply)) return;
    setSending(true);
    const ok = await collab.addComment(comment.file_path, comment.line_number, safeReply, comment.id);
    setSending(false);
    if (ok) setReply('');
  };

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-start gap-2">
        <Avatar className="mt-0.5 h-6 w-6">
          <AvatarImage src={comment.profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-[10px]">{(comment.profile?.display_name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{comment.profile?.display_name || 'User'}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{comment.file_path}:{comment.line_number}</span>
          </div>
          <div className="prose prose-sm mt-2 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeRichText(comment.content) }} />

          {replies.length > 0 && (
            <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
              {replies.map((replyItem) => (
                <div key={replyItem.id} className="rounded-md bg-muted/40 p-2 text-xs">
                  <span className="font-medium">{replyItem.profile?.display_name || 'User'}: </span>
                  <span dangerouslySetInnerHTML={{ __html: sanitizeRichText(replyItem.content) }} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-2">
            <RichTextComposer value={reply} onChange={setReply} placeholder="Follow up…" minHeightClassName="min-h-[72px]" />
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={handleReply} disabled={!richTextToPlainText(reply) || sending} className="gap-1.5">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Reply
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {!comment.resolved && (
            <button type="button" onClick={() => collab.resolveComment(comment.id, true)} className="rounded p-1 text-muted-foreground hover:bg-success/10 hover:text-success" title="Resolve">
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          {comment.user_id === userId && (
            <button type="button" onClick={() => collab.deleteComment(comment.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewsTab({ collab, userId }: { collab: ReturnType<typeof useCollaboration>; userId: string }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!title.trim() || !reviewerId) return;
    setSubmitting(true);
    const ok = await collab.requestReview(reviewerId, title.trim(), description.trim() || undefined);
    setSubmitting(false);
    if (ok) {
      setTitle('');
      setDescription('');
      setReviewerId('');
    }
  };

  const pendingReviews = collab.reviews.filter((review) => review.status === 'pending');
  const otherReviews = collab.reviews.filter((review) => review.status !== 'pending');

  return (
    <div className="space-y-4">
      {collab.collaborators.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
          <h4 className="text-sm font-medium">Request a review</h4>
          <Input placeholder="Review title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input placeholder="Short summary" value={description} onChange={(event) => setDescription(event.target.value)} />
          <Select value={reviewerId} onValueChange={setReviewerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select reviewer" />
            </SelectTrigger>
            <SelectContent>
              {collab.collaborators.filter((entry) => entry.accepted).map((entry) => (
                <SelectItem key={entry.user_id} value={entry.user_id}>{entry.profile?.display_name || entry.invited_email || 'User'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleRequest} disabled={!title.trim() || !reviewerId || submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitPullRequest className="h-4 w-4" />}
            Request review
          </Button>
        </div>
      )}

      {pendingReviews.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending</h4>
          <div className="space-y-2">
            {pendingReviews.map((review) => <ReviewCard key={review.id} review={review} collab={collab} userId={userId} />)}
          </div>
        </div>
      )}

      {otherReviews.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Completed</h4>
          <div className="space-y-2">
            {otherReviews.map((review) => <ReviewCard key={review.id} review={review} collab={collab} userId={userId} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review, collab, userId }: { review: CodeReview; collab: ReturnType<typeof useCollaboration>; userId: string }) {
  const status = STATUS_CONFIG[review.status];
  const isReviewer = review.reviewer_id === userId;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{review.title}</p>
            <Badge variant="outline" className={cn('shrink-0 gap-1 text-[10px]', status.color)}>{status.icon} {status.label}</Badge>
          </div>
          {review.description && <p className="mt-1 text-xs text-muted-foreground">{review.description}</p>}
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>By {review.requester_profile?.display_name || 'User'}</span>
            <span>→</span>
            <span>{review.reviewer_profile?.display_name || 'User'}</span>
          </div>
        </div>

        {isReviewer && review.status === 'pending' && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-success hover:text-success" onClick={() => collab.updateReviewStatus(review.id, 'approved')}>
              <Check className="h-3 w-3" /> Approve
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-warning hover:text-warning" onClick={() => collab.updateReviewStatus(review.id, 'changes_requested')}>
              <AlertCircle className="h-3 w-3" /> Request changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PresenceAvatars({ presence }: { presence: PresenceState[] }) {
  if (presence.length === 0) return null;

  return (
    <div className="flex items-center -space-x-1.5">
      {presence.slice(0, 5).map((entry) => (
        <div key={entry.userId} className="relative" title={`${entry.displayName}${entry.currentFile ? ` — ${entry.currentFile}` : ''}`}>
          <Avatar className="h-6 w-6 border-2 border-background">
            <AvatarImage src={entry.avatarUrl || undefined} />
            <AvatarFallback className="text-[9px] font-bold text-white" style={{ backgroundColor: entry.color }}>{entry.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Circle className="absolute -bottom-0.5 -right-0.5 h-2 w-2 fill-success text-success" />
        </div>
      ))}
      {presence.length > 5 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted">
          <span className="text-[9px] font-medium text-muted-foreground">+{presence.length - 5}</span>
        </div>
      )}
    </div>
  );
}
