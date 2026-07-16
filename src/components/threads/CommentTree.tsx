import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { VoteButtons } from './VoteButtons';
import { MediaRenderer } from './MediaRenderer';
import { ThreadEditor } from './ThreadEditor';
import type { CommentRow } from '@/hooks/useThreads';

interface CommentTreeProps {
  comments: CommentRow[];
  currentUserId: string | null | undefined;
  onVote: (targetType: 'thread' | 'comment', targetId: string, value: number) => void;
  onReply: (parentId: string, content: string, depth: number) => Promise<void>;
  onEdit?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onUploadMedia?: (file: File) => Promise<string>;
}

export function CommentTree({ comments, currentUserId, onVote, onReply, onEdit, onDelete, onUploadMedia }: CommentTreeProps) {
  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onVote={onVote}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onUploadMedia={onUploadMedia}
        />
      ))}
      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Be the first!</p>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: CommentRow;
  currentUserId: string | null | undefined;
  onVote: (targetType: 'thread' | 'comment', targetId: string, value: number) => void;
  onReply: (parentId: string, content: string, depth: number) => Promise<void>;
  onEdit?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onUploadMedia?: (file: File) => Promise<string>;
}

function CommentItem({ comment, currentUserId, onVote, onReply, onEdit, onDelete, onUploadMedia }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [saving, setSaving] = useState(false);

  const isAuthor = currentUserId === comment.author_id;

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !currentUserId) return;
    setReplying(true);
    try {
      await onReply(comment.id, replyContent, comment.depth + 1);
      setReplyContent('');
      setShowReply(false);
    } finally {
      setReplying(false);
    }
  };

  const handleStartEdit = () => {
    setEditContent(comment.content);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !onEdit) return;
    setSaving(true);
    try {
      await onEdit(comment.id, editContent);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const displayName = comment.author?.display_name || 'anonymous';
  const initials = displayName.slice(0, 2).toUpperCase();
  const timeAgo = getTimeAgo(comment.created_at);

  return (
    <div className={cn('relative', comment.depth > 0 && 'ml-6 border-l-2 border-border/40 pl-4')}>
      <div className="flex gap-2 group">
        <div className="flex flex-col items-center gap-0.5 pt-1">
          <VoteButtons
            score={comment.vote_score}
            userVote={comment.user_vote}
            onVote={(value) => onVote('comment', comment.id, value)}
            size="sm"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Avatar className="h-5 w-5">
              <AvatarImage src={comment.author?.avatar_url || undefined} />
              <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
            </Avatar>
            <Link to={`/profile/${comment.author_id}`} className="font-medium text-foreground hover:text-primary transition-colors">
              {displayName}
            </Link>
            <span>{timeAgo}</span>
            <span className="text-[10px] text-muted-foreground/60">{comment.author?.karma ?? 0} karma</span>
          </div>

          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ChevronRight className="h-3 w-3" />
              Show comment
            </button>
          ) : editing ? (
            <div className="space-y-2">
              <ThreadEditor
                value={editContent}
                onChange={setEditContent}
                minHeightClassName="min-h-[80px]"
                onUploadMedia={onUploadMedia}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={!editContent.trim() || saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <MediaRenderer content={comment.content} className="text-sm" />

              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => setCollapsed(true)}
                  className="text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                {currentUserId && (
                  <button
                    onClick={() => setShowReply(!showReply)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Reply
                  </button>
                )}
                {isAuthor && onEdit && (
                  <button
                    onClick={handleStartEdit}
                    className="text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
                {isAuthor && onDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDelete(comment.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {showReply && (
                <div className="mt-2 space-y-2">
                  <ThreadEditor
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder="Write a reply..."
                    minHeightClassName="min-h-[80px]"
                    onUploadMedia={onUploadMedia}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setShowReply(false); setReplyContent(''); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSubmitReply} disabled={!replyContent.trim() || replying}>
                      {replying ? 'Posting...' : 'Reply'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!collapsed && comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          <CommentTree
            comments={comment.replies}
            currentUserId={currentUserId}
            onVote={onVote}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onUploadMedia={onUploadMedia}
          />
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
