-- Fix vote karma trigger to handle DELETE (NEW is null)
CREATE OR REPLACE FUNCTION public.update_author_karma_from_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_id_val uuid;
  v_thread_id uuid;
  v_comment_id uuid;
BEGIN
  v_thread_id := COALESCE(NEW.thread_id, OLD.thread_id);
  v_comment_id := COALESCE(NEW.comment_id, OLD.comment_id);

  IF v_thread_id IS NOT NULL THEN
    SELECT author_id INTO author_id_val FROM threads WHERE id = v_thread_id;
  ELSIF v_comment_id IS NOT NULL THEN
    SELECT author_id INTO author_id_val FROM comments WHERE id = v_comment_id;
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
$$;

-- Storage RLS policies for threads-media bucket (public read, auth write in own folder)
DO $$ BEGIN
  CREATE POLICY "threads-media public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'threads-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "threads-media authenticated insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'threads-media'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "threads-media authenticated update own"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'threads-media'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "threads-media authenticated delete own"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'threads-media'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;