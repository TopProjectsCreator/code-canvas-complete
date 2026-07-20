import { supabase } from '@/integrations/supabase/client';
import { sanitizeRichText } from '@/lib/richText';

const THREADS_BUCKET = 'threads-media';

export type AuthorInfo = {
  display_name: string | null;
  avatar_url: string | null;
  karma: number;
};

export type ThreadRow = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  vote_score: number;
  comment_count: number;
  category: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: AuthorInfo | null;
  user_vote?: number | null;
};

export type CommentRow = {
  id: string;
  thread_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  vote_score: number;
  depth: number;
  created_at: string;
  updated_at: string;
  author?: AuthorInfo | null;
  user_vote?: number | null;
  replies?: CommentRow[];
};

export type SortMode = 'hot' | 'new' | 'top';

function computeHotness(voteScore: number, created_at: string): number {
  const created = new Date(created_at).getTime();
  const now = Date.now();
  const hoursSinceCreation = (now - created) / (1000 * 60 * 60);
  return hoursSinceCreation > 0 ? voteScore / Math.pow(hoursSinceCreation + 2, 1.5) : voteScore;
}

async function fetchAuthors(authorIds: string[]): Promise<Map<string, AuthorInfo>> {
  if (authorIds.length === 0) return new Map();
  const { data } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, karma')
    .in('user_id', authorIds);

  const map = new Map<string, AuthorInfo>();
  for (const row of (data || [])) {
    map.set(row.user_id, {
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      karma: row.karma ?? 0,
    });
  }
  return map;
}

export async function fetchThreadsList(sort: SortMode, userId?: string | null): Promise<ThreadRow[]> {
  let query = supabase
    .from('threads')
    .select('*');

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'top') {
    query = query.order('vote_score', { ascending: false });
  }

  const { data, error } = await query;

  if (error) throw error;

  let threads = (data || []) as ThreadRow[];

  if (sort === 'hot') {
    threads.sort((a, b) => computeHotness(b.vote_score, b.created_at) - computeHotness(a.vote_score, a.created_at));
  }

  // Pinned threads always first (stable relative to sort mode)
  threads.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const authorIds = [...new Set(threads.map(t => t.author_id))];
  const authorMap = await fetchAuthors(authorIds);

  threads = threads.map(t => ({
    ...t,
    author: authorMap.get(t.author_id) || null,
  }));

  if (userId) {
    const threadIds = threads.map(t => t.id);
    if (threadIds.length > 0) {
      const { data: votes } = await supabase
        .from('votes')
        .select('thread_id, value')
        .eq('user_id', userId)
        .in('thread_id', threadIds);

      const voteMap = new Map((votes || []).map(v => [v.thread_id, v.value]));
      threads = threads.map(t => ({ ...t, user_vote: voteMap.get(t.id) ?? null }));
    }
  }

  return threads;
}

export async function fetchThread(id: string, userId?: string | null): Promise<{ thread: ThreadRow; comments: CommentRow[] }> {
  const { data: threadData, error: threadError } = await supabase
    .from('threads')
    .select('*')
    .eq('id', id)
    .single();

  if (threadError) throw threadError;

  const thread = threadData as ThreadRow;

  const authorMap = await fetchAuthors([thread.author_id]);
  thread.author = authorMap.get(thread.author_id) || null;

  if (userId) {
    const { data: vote } = await supabase
      .from('votes')
      .select('value')
      .eq('user_id', userId)
      .eq('thread_id', id)
      .maybeSingle();
    thread.user_vote = vote?.value ?? null;
  }

  const { data: commentsData, error: commentsError } = await supabase
    .from('comments')
    .select('*')
    .eq('thread_id', id)
    .order('created_at', { ascending: true });

  if (commentsError) throw commentsError;

  let comments = (commentsData || []) as CommentRow[];

  const commentAuthorIds = [...new Set(comments.map(c => c.author_id))];
  const commentAuthorMap = await fetchAuthors(commentAuthorIds);
  comments = comments.map(c => ({
    ...c,
    author: commentAuthorMap.get(c.author_id) || null,
  }));

  if (userId) {
    const commentIds = comments.map(c => c.id);
    if (commentIds.length > 0) {
      const { data: votes } = await supabase
        .from('votes')
        .select('comment_id, value')
        .eq('user_id', userId)
        .in('comment_id', commentIds);

      const voteMap = new Map((votes || []).map(v => [v.comment_id, v.value]));
      comments = comments.map(c => ({ ...c, user_vote: voteMap.get(c.id) ?? null }));
    }
  }

  const commentMap = new Map<string, CommentRow[]>();
  const topLevel: CommentRow[] = [];

  for (const comment of comments) {
    if (!comment.parent_id) {
      topLevel.push(comment);
    } else {
      const existing = commentMap.get(comment.parent_id) || [];
      existing.push(comment);
      commentMap.set(comment.parent_id, existing);
    }
  }

  const buildTree = (items: CommentRow[]): CommentRow[] => {
    return items.map(item => ({
      ...item,
      replies: buildTree(commentMap.get(item.id) || []),
    }));
  };

  return { thread, comments: buildTree(topLevel) };
}

export async function createThread(
  authorId: string,
  title: string,
  content: string,
  category?: string | null,
): Promise<string> {
  const safeContent = sanitizeRichText(content);
  const { data, error } = await supabase
    .from('threads')
    .insert({
      author_id: authorId,
      title: title.trim(),
      content: safeContent,
      category: category || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function createComment(
  authorId: string,
  threadId: string,
  content: string,
  parentId?: string | null,
  depth?: number,
): Promise<void> {
  const safeContent = sanitizeRichText(content);
  const { error } = await supabase
    .from('comments')
    .insert({
      author_id: authorId,
      thread_id: threadId,
      content: safeContent,
      parent_id: parentId || null,
      depth: depth ?? 0,
    });

  if (error) throw error;
}

export async function vote(
  userId: string,
  targetType: 'thread' | 'comment',
  targetId: string,
  value: number,
): Promise<void> {
  const column = targetType === 'thread' ? 'thread_id' : 'comment_id';
  const { data: existing } = await supabase
    .from('votes')
    .select('id, value')
    .eq('user_id', userId)
    .eq(column, targetId)
    .maybeSingle();

  if (existing) {
    if (existing.value === value) {
      await supabase.from('votes').delete().eq('id', existing.id);
    } else {
      await supabase.from('votes').update({ value }).eq('id', existing.id);
    }
  } else {
    const insertData: Record<string, any> = {
      user_id: userId,
      value,
    };
    insertData[column] = targetId;
    await supabase.from('votes').insert(insertData);
  }
}

export async function updateThread(
  id: string,
  title: string,
  content: string,
  category?: string | null,
): Promise<void> {
  const safeContent = sanitizeRichText(content);
  const { error } = await supabase
    .from('threads')
    .update({
      title: title.trim(),
      content: safeContent,
      category: category || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteThread(id: string): Promise<void> {
  const { error } = await supabase
    .from('threads')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateComment(
  id: string,
  content: string,
): Promise<void> {
  const safeContent = sanitizeRichText(content);
  const { error } = await supabase
    .from('comments')
    .update({
      content: safeContent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function uploadMedia(
  file: File,
  userId: string,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'blob';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(THREADS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(THREADS_BUCKET)
    .getPublicUrl(path);

  return publicUrl;
}
