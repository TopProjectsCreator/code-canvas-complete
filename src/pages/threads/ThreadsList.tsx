import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Flame, Clock, TrendingUp, MoreHorizontal, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Seo } from '@/components/Seo';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { VoteButtons } from '@/components/threads/VoteButtons';
import { richTextToPlainText } from '@/lib/richText';
import { fetchThreadsList, vote, deleteThread, type SortMode, type ThreadRow } from '@/hooks/useThreads';

export default function ThreadsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = (searchParams.get('sort') as SortMode) || 'hot';
  const [sort, setSort] = useState<SortMode>(sortParam);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSearchParams({ sort }, { replace: true });
  }, [sort, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchThreadsList(sort, user?.id)
      .then((data) => {
        if (!cancelled) setThreads(data);
      })
      .catch((err) => {
        if (!cancelled) toast({ title: 'Failed to load threads', description: err?.message || String(err), variant: 'destructive' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sort, user?.id, toast]);

  const handleVote = async (targetId: string, value: number) => {
    if (!user) {
      toast({ title: 'Sign in to vote', description: 'You need an account to vote on threads' });
      return;
    }
    try {
      await vote(user.id, 'thread', targetId, value);
      const data = await fetchThreadsList(sort, user?.id);
      setThreads(data);
    } catch (err: any) {
      toast({ title: 'Vote failed', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  const handleDelete = async (threadId: string) => {
    try {
      await deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      toast({ title: 'Thread deleted' });
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  return (
    <div>
      <Seo title="Threads — Community" description="Browse community threads" path="/threads" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Threads</h1>
        <Button asChild>
          <Link to="/threads/new">
            <Plus className="h-4 w-4 mr-2" />
            New Thread
          </Link>
        </Button>
      </div>

      <Tabs value={sort} onValueChange={(v) => setSort(v as SortMode)} className="mb-6">
        <TabsList>
          <TabsTrigger value="hot" className="flex items-center gap-1.5">
            <Flame className="h-4 w-4" /> Hot
          </TabsTrigger>
          <TabsTrigger value="new" className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> New
          </TabsTrigger>
          <TabsTrigger value="top" className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> Top
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">No threads yet</h2>
          <p className="text-sm text-muted-foreground mb-4">Be the first to start a discussion!</p>
          <Button asChild>
            <Link to="/threads/new">Create a thread</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => {
            const displayName = thread.author?.display_name || 'anonymous';
            const preview = richTextToPlainText(thread.content).slice(0, 150);
            const timeAgo = getTimeAgo(thread.created_at);

            return (
              <Card key={thread.id} className="p-3 hover:bg-accent/50 transition-colors">
                <div className="flex gap-3">
                  <VoteButtons
                    score={thread.vote_score}
                    userVote={thread.user_vote}
                    onVote={(value) => handleVote(thread.id, value)}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <Link to={`/threads/${thread.id}`} className="block">
                      <h3 className="font-medium text-foreground leading-snug hover:text-primary transition-colors">
                        {thread.title}
                      </h3>
                    </Link>
                    {preview && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{preview}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={thread.author?.avatar_url || undefined} />
                          <AvatarFallback className="text-[7px]">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <Link to={`/profile/${thread.author_id}`} className="hover:text-foreground transition-colors">
                          {displayName}
                        </Link>
                      </span>
                      <span>{timeAgo}</span>
                      {thread.category && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                          {thread.category}
                        </span>
                      )}
                      <Link to={`/threads/${thread.id}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        <MessageSquare className="h-3 w-3" />
                        {thread.comment_count}
                      </Link>
                      {user?.id === thread.author_id && (
                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuItem onSelect={() => navigate(`/threads/${thread.id}?edit=1`)}>
                                Edit
                              </DropdownMenuItem>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete thread?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. The thread and all its comments will be permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(thread.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
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
