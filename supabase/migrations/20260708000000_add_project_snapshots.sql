CREATE TABLE public.project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'snapshot',
  label TEXT NOT NULL,
  detail TEXT,
  files JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_snapshots_project_id ON public.project_snapshots(project_id);
CREATE INDEX idx_project_snapshots_created_at ON public.project_snapshots(created_at DESC);

ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own project snapshots"
ON public.project_snapshots FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project snapshots"
ON public.project_snapshots FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project snapshots"
ON public.project_snapshots FOR DELETE
USING (auth.uid() = user_id);
