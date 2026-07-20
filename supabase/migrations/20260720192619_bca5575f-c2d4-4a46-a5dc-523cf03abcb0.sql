ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS threads_pinned_idx ON public.threads(pinned) WHERE pinned = true;

DROP POLICY IF EXISTS "Admins can update any thread" ON public.threads;
CREATE POLICY "Admins can update any thread"
  ON public.threads
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));