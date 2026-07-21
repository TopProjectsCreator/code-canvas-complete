-- Storage policies for the threads-media bucket
-- The bucket was created but no RLS policies were added to storage.objects,
-- so authenticated uploads failed with "new row violates row-level security policy".

-- Public read access (bucket is public)
DROP POLICY IF EXISTS "Thread media is publicly readable" ON storage.objects;
CREATE POLICY "Thread media is publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'threads-media');

-- Authenticated users can upload media
DROP POLICY IF EXISTS "Authenticated users can upload thread media" ON storage.objects;
CREATE POLICY "Authenticated users can upload thread media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'threads-media');

-- Uploaders can update their own media
DROP POLICY IF EXISTS "Users can update their own thread media" ON storage.objects;
CREATE POLICY "Users can update their own thread media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'threads-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'threads-media' AND owner = auth.uid());

-- Uploaders can delete their own media
DROP POLICY IF EXISTS "Users can delete their own thread media" ON storage.objects;
CREATE POLICY "Users can delete their own thread media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'threads-media' AND owner = auth.uid());
