-- Public avatars bucket previously allowed anyone to LIST all files via a broad SELECT policy.
-- Replace it with an owner-scoped SELECT policy. Public GET via direct URLs still works (public bucket).
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Users can list their own avatar files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);