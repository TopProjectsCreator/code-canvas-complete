-- Threads: Reddit-like discussion feature
-- Adds karma to profiles, creates threads, comments, votes tables, and storage bucket
-- Fully idempotent — safe to run multiple times

-- Add karma column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS karma integer NOT NULL DEFAULT 0;

-- Threads table
CREATE TABLE IF NOT EXISTS threads (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id   uuid REFERENCES profiles(user_id) NOT NULL,
  title       text NOT NULL,
  content     text NOT NULL DEFAULT '',
  vote_score  integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  category    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Comments table (self-referencing for nested replies)
CREATE TABLE IF NOT EXISTS comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id   uuid REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
  parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES profiles(user_id) NOT NULL,
  content     text NOT NULL,
  vote_score  integer NOT NULL DEFAULT 0,
  depth       integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Votes table (one user can vote once per thread or comment)
CREATE TABLE IF NOT EXISTS votes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles(user_id) NOT NULL,
  thread_id   uuid REFERENCES threads(id) ON DELETE CASCADE,
  comment_id  uuid REFERENCES comments(id) ON DELETE CASCADE,
  value       smallint NOT NULL CHECK (value IN (1, -1)),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, thread_id),
  UNIQUE (user_id, comment_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_vote_score ON threads(vote_score DESC);
CREATE INDEX IF NOT EXISTS idx_comments_thread_id ON comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_thread ON votes(user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_comment ON votes(user_id, comment_id);

-- Row Level Security (safe to run multiple times)
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Threads policies
DO $$ BEGIN DROP POLICY IF EXISTS "Threads are publicly viewable" ON threads; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create threads" ON threads; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Authors can update their own threads" ON threads; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Authors can delete their own threads" ON threads; END $$;

CREATE POLICY "Threads are publicly viewable"
  ON threads FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create threads"
  ON threads FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND author_id = auth.uid());

CREATE POLICY "Authors can update their own threads"
  ON threads FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can delete their own threads"
  ON threads FOR DELETE
  USING (author_id = auth.uid());

-- Comments policies
DO $$ BEGIN DROP POLICY IF EXISTS "Comments are publicly viewable" ON comments; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Authors can update their own comments" ON comments; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Authors can delete their own comments" ON comments; END $$;

CREATE POLICY "Comments are publicly viewable"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND author_id = auth.uid());

CREATE POLICY "Authors can update their own comments"
  ON comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can delete their own comments"
  ON comments FOR DELETE
  USING (author_id = auth.uid());

-- Votes policies
DO $$ BEGIN DROP POLICY IF EXISTS "Anyone can view votes" ON votes; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Authenticated users can vote" ON votes; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can update their own votes" ON votes; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can delete their own votes" ON votes; END $$;

CREATE POLICY "Anyone can view votes"
  ON votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON votes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users can update their own votes"
  ON votes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own votes"
  ON votes FOR DELETE
  USING (user_id = auth.uid());

-- Create storage bucket for media uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('threads-media', 'threads-media', true)
ON CONFLICT (id) DO NOTHING;

-- Function: update thread vote_score
CREATE OR REPLACE FUNCTION update_thread_vote_score()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE threads SET vote_score = vote_score + NEW.value WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE threads SET vote_score = vote_score - OLD.value + NEW.value WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE threads SET vote_score = vote_score - OLD.value WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update comment vote_score
CREATE OR REPLACE FUNCTION update_comment_vote_score()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET vote_score = vote_score + NEW.value WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE comments SET vote_score = vote_score - OLD.value + NEW.value WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET vote_score = vote_score - OLD.value WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update comment_count on threads
CREATE OR REPLACE FUNCTION update_thread_comment_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE threads SET comment_count = comment_count + 1 WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE threads SET comment_count = comment_count - 1 WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update author karma from votes
CREATE OR REPLACE FUNCTION update_author_karma_from_vote()
RETURNS trigger AS $$
DECLARE
  author_id_val uuid;
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    SELECT author_id INTO author_id_val FROM threads WHERE id = COALESCE(NEW.thread_id, OLD.thread_id);
  ELSIF NEW.comment_id IS NOT NULL THEN
    SELECT author_id INTO author_id_val FROM comments WHERE id = COALESCE(NEW.comment_id, OLD.comment_id);
  END IF;

  IF author_id_val IS NOT NULL THEN
    UPDATE profiles SET karma = (
      SELECT COALESCE(SUM(v.value), 0)
      FROM votes v
      LEFT JOIN threads t ON v.thread_id = t.id
      LEFT JOIN comments c ON v.comment_id = c.id
      WHERE t.author_id = author_id_val OR c.author_id = author_id_val
    ) WHERE user_id = author_id_val;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for thread vote score
DROP TRIGGER IF EXISTS trigger_insert_update_thread_vote ON votes;
CREATE TRIGGER trigger_insert_update_thread_vote
  AFTER INSERT OR UPDATE ON votes
  FOR EACH ROW
  WHEN (NEW.thread_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_vote_score();

DROP TRIGGER IF EXISTS trigger_delete_thread_vote ON votes;
CREATE TRIGGER trigger_delete_thread_vote
  AFTER DELETE ON votes
  FOR EACH ROW
  WHEN (OLD.thread_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_vote_score();

-- Triggers for comment vote score
DROP TRIGGER IF EXISTS trigger_insert_update_comment_vote ON votes;
CREATE TRIGGER trigger_insert_update_comment_vote
  AFTER INSERT OR UPDATE ON votes
  FOR EACH ROW
  WHEN (NEW.comment_id IS NOT NULL)
  EXECUTE FUNCTION update_comment_vote_score();

DROP TRIGGER IF EXISTS trigger_delete_comment_vote ON votes;
CREATE TRIGGER trigger_delete_comment_vote
  AFTER DELETE ON votes
  FOR EACH ROW
  WHEN (OLD.comment_id IS NOT NULL)
  EXECUTE FUNCTION update_comment_vote_score();

-- Trigger for thread comment count
DROP TRIGGER IF EXISTS trigger_update_thread_comment_count ON comments;
CREATE TRIGGER trigger_update_thread_comment_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_comment_count();

-- Trigger for author karma
DROP TRIGGER IF EXISTS trigger_update_author_karma ON votes;
CREATE TRIGGER trigger_update_author_karma
  AFTER INSERT OR UPDATE OR DELETE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION update_author_karma_from_vote();
