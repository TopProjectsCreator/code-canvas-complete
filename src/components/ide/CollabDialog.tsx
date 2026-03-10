import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollaboration, CollabRole, Collaborator, CodeComment, CodeReview, PresenceState } from '@/hooks/useCollaboration';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Users, UserPlus, MessageSquare, GitPullRequest, Trash2, Check, X,
  Clock, CheckCircle2, XCircle, AlertCircle, Send, Loader2, Eye,
  Pencil, Shield, Crown, Circle
} from 'lucide-react';

interface CollabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | undefined;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3" />,
  admin: <Shield className="w-3 h-3" />,
  editor: <Pencil className="w-3 h-3" />,
  viewer: <Eye className="w-3 h-3" />,
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-primary/15 text-primary border-primary/30',
  admin: 'bg-destructive/15 text-destructive border-destructive/30',
  editor: 'bg-info/15 text-info border-info/30',
  viewer: 'bg-muted text-muted-foreground border-border',
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending', color: 'bg-warning/15 text-warning' },
  approved: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Approved', color: 'bg-success/15 text-success' },
  changes_requested: { icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Changes Requested', color: 'bg-destructive/15 text-destructive' },
  closed: { icon: <XCircle className="w-3.5 h-3.5" />, label: 'Closed', color: 'bg-muted text-muted-foreground' },
};

export const CollabDialog = ({ open, onOpenChange, projectId }: CollabDialogProps) => {
  const hasProject = !!projectId;
  const { user } = useAuth();
  const collab = useCollaboration(projectId);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Collaboration
          </DialogTitle>
          <DialogDescription>
            Manage collaborators, comments, and code reviews
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="team" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="team" className="gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" /> Team
              {collab.presence.length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-success/20 text-success text-[10px] flex items-center justify-center">
                  {collab.presence.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="invite" className="gap-1.5 text-xs">
              <UserPlus className="w-3.5 h-3.5" /> Invite
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-1.5 text-xs">
              <MessageSquare className="w-3.5 h-3.5" /> Comments
              {collab.comments.filter(c => !c.resolved).length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center">
                  {collab.comments.filter(c => !c.resolved).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5 text-xs">
              <GitPullRequest className="w-3.5 h-3.5" /> Reviews
              {collab.reviews.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-warning/20 text-warning text-[10px] flex items-center justify-center">
                  {collab.reviews.filter(r => r.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4 pr-1">
            <TabsContent value="team" className="mt-0">
              <TeamTab collab={collab} userId={user.id} />
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

// ─── Team Tab ───
function TeamTab({ collab, userId }: { collab: ReturnType<typeof useCollaboration>; userId: string }) {
  return (
    <div className="space-y-4">
      {/* Online now */}
      {collab.presence.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Online Now</h4>
          <div className="flex flex-wrap gap-2">
            {collab.presence.map(p => (
              <div key={p.userId} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/50">
                <div className="relative">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={p.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px]" style={{ backgroundColor: p.color }}>
                      {p.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Circle className="w-2 h-2 fill-success text-success absolute -bottom-0.5 -right-0.5" />
                </div>
                <span className="text-xs font-medium">{p.displayName}</span>
                {p.currentFile && (
                  <span className="text-[10px] text-muted-foreground font-mono">{p.currentFile}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collaborators list */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Collaborators</h4>
        {collab.collaborators.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No collaborators yet</p>
            <p className="text-xs mt-1">Invite team members to start collaborating</p>
          </div>
        ) : (
          <div className="space-y-2">
            {collab.collaborators.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={c.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-muted">
                    {(c.profile?.display_name || c.invited_email || '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {c.profile?.display_name || c.invited_email || 'Unknown'}
                  </p>
                  {!c.accepted && <p className="text-xs text-warning">Pending invitation</p>}
                </div>
                <Badge variant="outline" className={cn("gap-1 text-[10px]", ROLE_COLORS[c.role])}>
                  {ROLE_ICONS[c.role]} {c.role}
                </Badge>
                {collab.myRole === 'owner' && (
                  <button
                    onClick={() => collab.removeCollaborator(c.id)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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

// ─── Invite Tab ───
function InviteTab({ collab, hasProject = true }: { collab: ReturnType<typeof useCollaboration>; hasProject?: boolean }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollabRole>('editor');
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    const ok = await collab.inviteCollaborator(email.trim(), role);
    setSending(false);
    if (ok) { setEmail(''); setRole('editor'); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-1">Invite a collaborator</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Enter their email address and choose their access level
        </p>
      </div>

      <div className="space-y-3">
        <Input
          type="email"
          placeholder="collaborator@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleInvite()}
        />

        <Select value={role} onValueChange={v => setRole(v as CollabRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5" /> Viewer — can view files
              </div>
            </SelectItem>
            <SelectItem value="editor">
              <div className="flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5" /> Editor — can edit files
              </div>
            </SelectItem>
            <SelectItem value="admin">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> Admin — can manage project
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleInvite} disabled={!email.trim() || sending} className="w-full gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Send Invitation
        </Button>
      </div>

      {/* Role descriptions */}
      <div className="mt-6 space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Access Levels</h4>
        {[
          { role: 'viewer', icon: <Eye className="w-4 h-4" />, desc: 'Can view files and leave comments' },
          { role: 'editor', icon: <Pencil className="w-4 h-4" />, desc: 'Can edit files, comment, and request reviews' },
          { role: 'admin', icon: <Shield className="w-4 h-4" />, desc: 'Full access including managing collaborators' },
        ].map(r => (
          <div key={r.role} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            <div className="mt-0.5 text-muted-foreground">{r.icon}</div>
            <div>
              <p className="text-sm font-medium capitalize">{r.role}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Comments Tab ───
function CommentsTab({ collab, userId }: { collab: ReturnType<typeof useCollaboration>; userId: string }) {
  const [newComment, setNewComment] = useState('');
  const [filePath, setFilePath] = useState('');
  const [lineNum, setLineNum] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!newComment.trim() || !filePath.trim() || !lineNum.trim()) return;
    setPosting(true);
    const ok = await collab.addComment(filePath.trim(), parseInt(lineNum) || 1, newComment.trim());
    setPosting(false);
    if (ok) { setNewComment(''); }
  };

  const unresolvedComments = collab.comments.filter(c => !c.resolved && !c.parent_id);
  const resolvedComments = collab.comments.filter(c => c.resolved && !c.parent_id);

  return (
    <div className="space-y-4">
      {/* New comment form */}
      <div className="p-4 rounded-lg border border-border bg-card/50 space-y-3">
        <h4 className="text-sm font-medium">Add a Comment</h4>
        <div className="flex gap-2">
          <Input placeholder="File path" value={filePath} onChange={e => setFilePath(e.target.value)} className="flex-1" />
          <Input placeholder="Line #" type="number" value={lineNum} onChange={e => setLineNum(e.target.value)} className="w-20" />
        </div>
        <div className="flex gap-2">
          <Textarea placeholder="Write your comment..." value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} className="flex-1" />
          <Button size="icon" onClick={handlePost} disabled={!newComment.trim() || !filePath.trim() || posting} className="shrink-0 self-end">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Open comments */}
      {unresolvedComments.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Open ({unresolvedComments.length})
          </h4>
          <div className="space-y-2">
            {unresolvedComments.map(c => (
              <CommentCard key={c.id} comment={c} collab={collab} userId={userId} />
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolvedComments.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Resolved ({resolvedComments.length})
          </h4>
          <div className="space-y-2 opacity-60">
            {resolvedComments.map(c => (
              <CommentCard key={c.id} comment={c} collab={collab} userId={userId} />
            ))}
          </div>
        </div>
      )}

      {collab.comments.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No comments yet</p>
          <p className="text-xs mt-1">Add inline comments to discuss code changes</p>
        </div>
      )}
    </div>
  );
}

function CommentCard({ comment, collab, userId }: { comment: CodeComment; collab: ReturnType<typeof useCollaboration>; userId: string }) {
  const replies = collab.comments.filter(c => c.parent_id === comment.id);

  return (
    <div className="p-3 rounded-lg border border-border bg-card/50">
      <div className="flex items-start gap-2">
        <Avatar className="w-6 h-6 mt-0.5">
          <AvatarImage src={comment.profile?.avatar_url || undefined} />
          <AvatarFallback className="text-[10px] bg-muted">
            {(comment.profile?.display_name || '?').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{comment.profile?.display_name || 'User'}</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {comment.file_path}:{comment.line_number}
            </span>
          </div>
          <p className="text-sm mt-1">{comment.content}</p>
          {replies.length > 0 && (
            <div className="mt-2 pl-3 border-l-2 border-border space-y-2">
              {replies.map(r => (
                <div key={r.id} className="text-xs">
                  <span className="font-medium">{r.profile?.display_name || 'User'}: </span>
                  {r.content}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {!comment.resolved && (
            <button onClick={() => collab.resolveComment(comment.id, true)} className="p-1 rounded hover:bg-success/10 text-muted-foreground hover:text-success" title="Resolve">
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          {comment.user_id === userId && (
            <button onClick={() => collab.deleteComment(comment.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reviews Tab ───
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
    if (ok) { setTitle(''); setDescription(''); setReviewerId(''); }
  };

  const pendingReviews = collab.reviews.filter(r => r.status === 'pending');
  const otherReviews = collab.reviews.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-4">
      {/* Request review form */}
      {collab.collaborators.length > 0 && (
        <div className="p-4 rounded-lg border border-border bg-card/50 space-y-3">
          <h4 className="text-sm font-medium">Request a Review</h4>
          <Input placeholder="Review title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          <Select value={reviewerId} onValueChange={setReviewerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select reviewer" />
            </SelectTrigger>
            <SelectContent>
              {collab.collaborators.filter(c => c.accepted).map(c => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  {c.profile?.display_name || c.invited_email || 'User'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleRequest} disabled={!title.trim() || !reviewerId || submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
            Request Review
          </Button>
        </div>
      )}

      {/* Pending reviews */}
      {pendingReviews.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Pending</h4>
          <div className="space-y-2">
            {pendingReviews.map(r => (
              <ReviewCard key={r.id} review={r} collab={collab} userId={userId} />
            ))}
          </div>
        </div>
      )}

      {otherReviews.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Completed</h4>
          <div className="space-y-2">
            {otherReviews.map(r => (
              <ReviewCard key={r.id} review={r} collab={collab} userId={userId} />
            ))}
          </div>
        </div>
      )}

      {collab.reviews.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <GitPullRequest className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No reviews yet</p>
          <p className="text-xs mt-1">
            {collab.collaborators.length === 0
              ? 'Invite collaborators first to request reviews'
              : 'Request a code review from your team'}
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review, collab, userId }: { review: CodeReview; collab: ReturnType<typeof useCollaboration>; userId: string }) {
  const status = STATUS_CONFIG[review.status];
  const isReviewer = review.reviewer_id === userId;

  return (
    <div className="p-3 rounded-lg border border-border bg-card/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{review.title}</p>
            <Badge variant="outline" className={cn("gap-1 text-[10px] shrink-0", status.color)}>
              {status.icon} {status.label}
            </Badge>
          </div>
          {review.description && <p className="text-xs text-muted-foreground mt-1">{review.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>By {review.requester_profile?.display_name || 'User'}</span>
            <span>→</span>
            <span>{review.reviewer_profile?.display_name || 'User'}</span>
          </div>
        </div>

        {/* Reviewer actions */}
        {isReviewer && review.status === 'pending' && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-success hover:text-success" onClick={() => collab.updateReviewStatus(review.id, 'approved')}>
              <Check className="w-3 h-3" /> Approve
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-warning hover:text-warning" onClick={() => collab.updateReviewStatus(review.id, 'changes_requested')}>
              <AlertCircle className="w-3 h-3" /> Request Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Presence Avatars (for Header) ───
export function PresenceAvatars({ presence }: { presence: PresenceState[] }) {
  if (presence.length === 0) return null;

  return (
    <div className="flex items-center -space-x-1.5">
      {presence.slice(0, 5).map(p => (
        <div key={p.userId} className="relative" title={`${p.displayName}${p.currentFile ? ` — ${p.currentFile}` : ''}`}>
          <Avatar className="w-6 h-6 border-2 border-background">
            <AvatarImage src={p.avatarUrl || undefined} />
            <AvatarFallback className="text-[9px] font-bold text-white" style={{ backgroundColor: p.color }}>
              {p.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Circle className="w-2 h-2 fill-success text-success absolute -bottom-0.5 -right-0.5" />
        </div>
      ))}
      {presence.length > 5 && (
        <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
          <span className="text-[9px] font-medium text-muted-foreground">+{presence.length - 5}</span>
        </div>
      )}
    </div>
  );
}
