import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Pencil, Trash2, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Seo } from '@/components/Seo';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { VoteButtons } from '@/components/threads/VoteButtons';
import { MediaRenderer } from '@/components/threads/MediaRenderer';
import { CommentTree } from '@/components/threads/CommentTree';
import { ThreadEditor } from '@/components/threads/ThreadEditor';
import { fetchThread, vote, createComment, uploadMedia, updateThread, deleteThread, updateComment, deleteComment, type ThreadRow, type CommentRow } from '@/hooks/useThreads';
import { useThreadCategories } from '@/hooks/useThreadCategories';
import { useReadThreads } from '@/hooks/useReadThreads';

export default function ThreadDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const { categories } = useThreadCategories();
  const { markRead } = useReadThreads();

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetchThread(id, user?.id)
      .then((data) => {
        setThread(data.thread);
        setComments(data.comments);
        setEditTitle(data.thread.title);
        setEditContent(data.thread.content);
        setEditCategory(data.thread.category || '');
        setEditing(searchParams.get('edit') === '1');
        markRead(data.thread.id, data.thread.updated_at);
      })
      .catch((err) => {
        toast({ title: 'Failed to load thread', description: err?.message || String(err), variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const handleVote = async (targetType: 'thread' | 'comment', targetId: string, value: number) => {
    if (!user) {
      toast({ title: 'Sign in to vote', description: 'You need an account to vote' });
      return;
    }
    try {
      await vote(user.id, targetType, targetId, value);
      load();
    } catch (err: any) {
      toast({ title: 'Vote failed', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  const handleReply = async (parentId: string, content: string, depth: number) => {
    if (!user || !id) return;
    await createComment(user.id, id, content, parentId, depth);
    load();
  };

  const handlePostComment = async () => {
    if (!user || !id || !newComment.trim()) return;
    setPosting(true);
    try {
      await createComment(user.id, id, newComment, null, 0);
      setNewComment('');
      load();
    } catch (err: any) {
      toast({ title: 'Failed to post', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const handleUploadMedia = async (file: File): Promise<string> => {
    if (!user) throw new Error('Must be signed in');
    return uploadMedia(file, user.id);
  };

  const handleStartEdit = () => {
    setEditTitle(thread!.title);
    setEditContent(thread!.content);
    setEditCategory(thread!.category || '');
    setEditing(true);
    setSearchParams({ edit: '1' }, { replace: true });
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setSearchParams({}, { replace: true });
  };

  const handleSaveEdit = async () => {
    if (!id || !editTitle.trim() || !user) return;
    setSaving(true);
    try {
      await updateThread(id, editTitle, editContent, editCategory || null);
      toast({ title: 'Thread updated' });
      setEditing(false);
      setSearchParams({}, { replace: true });
      load();
    } catch (err: any) {
      toast({ title: 'Failed to update', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!id) return;
    try {
      await deleteThread(id);
      toast({ title: 'Thread deleted' });
      navigate('/threads');
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    await updateComment(commentId, content);
    load();
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(commentId);
    load();
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-1/4" />
        <div className="h-32 bg-muted rounded mt-4" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-medium">Thread not found</h2>
        <Button asChild className="mt-4">
          <Link to="/threads">Back to threads</Link>
        </Button>
      </div>
    );
  }

  const displayName = thread.author?.display_name || 'anonymous';
  const timeAgo = getTimeAgo(thread.created_at);

  return (
    <div>
      <Seo title={`${thread.title} — Threads`} description={thread.title} path={`/threads/${id}`} />

      <Link to="/threads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to threads
      </Link>

      <Card className="p-5">
        <div className="flex gap-4">
          <VoteButtons
            score={thread.vote_score}
            userVote={thread.user_vote}
            onVote={(value) => handleVote('thread', thread.id, value)}
          />
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-4">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-bold"
                  placeholder="Title"
                />
                <ThreadEditor
                  value={editContent}
                  onChange={setEditContent}
                  minHeightClassName="min-h-[200px]"
                  onUploadMedia={handleUploadMedia}
                />
                <Select
                  value={editCategory || 'none'}
                  onValueChange={(v) => setEditCategory(v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={handleCancelEdit} disabled={saving}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={!editTitle.trim() || saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-xl font-bold leading-snug mb-2">{thread.title}</h1>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                      <Link to="/threads/whiteboard">
                        <Presentation className="h-4 w-4" />
                        Whiteboard
                      </Link>
                    </Button>
                    {user?.id === thread.author_id && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleStartEdit}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete thread?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={handleDeleteThread}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={thread.author?.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px]">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <Link to={`/profile/${thread.author_id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                      {displayName}
                    </Link>
                  </span>
                  <span>{timeAgo}</span>
                  {thread.category && (
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                      {thread.category}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {thread.comment_count} comments
                  </span>
                </div>

                {thread.content && (
                  <>
                    <Separator className="mb-4" />
                    <MediaRenderer content={thread.content} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-4">
          Comments {thread.comment_count > 0 && `(${thread.comment_count})`}
        </h2>

        <CommentTree
          comments={comments}
          currentUserId={user?.id}
          onVote={handleVote}
          onReply={handleReply}
          onEdit={handleEditComment}
          onDelete={handleDeleteComment}
          onUploadMedia={handleUploadMedia}
        />

        <Separator className="my-6" />

        {user ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Post a comment</h3>
            <ThreadEditor
              value={newComment}
              onChange={setNewComment}
              placeholder="What are your thoughts?"
              minHeightClassName="min-h-[120px]"
              onUploadMedia={handleUploadMedia}
            />
            <div className="flex justify-end">
              <Button onClick={handlePostComment} disabled={!newComment.trim() || posting}>
                {posting ? 'Posting...' : 'Comment'}
              </Button>
            </div>
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">Sign in to join the conversation</p>
            <Button asChild variant="outline">
              <Link to="/landing">Sign in</Link>
            </Button>
          </Card>
        )}
      </div>

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
