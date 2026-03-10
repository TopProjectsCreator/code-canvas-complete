ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS publish_slug TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS projects_publish_slug_key ON public.projects (publish_slug) WHERE publish_slug IS NOT NULL;
