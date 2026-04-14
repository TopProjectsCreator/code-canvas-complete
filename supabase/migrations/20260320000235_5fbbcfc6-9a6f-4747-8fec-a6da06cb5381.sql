
-- prompt_history: stores user AI prompt history per project
CREATE TABLE public.prompt_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  response text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prompt_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own prompt history" ON public.prompt_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- context_pins: pinned context items for AI chat
CREATE TABLE public.context_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  content text NOT NULL,
  pin_type text NOT NULL DEFAULT 'snippet',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.context_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own context pins" ON public.context_pins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai_review_suggestions: AI-generated code review suggestions
CREATE TABLE public.ai_review_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  line_start integer,
  line_end integer,
  suggestion text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_review_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review suggestions" ON public.ai_review_suggestions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- session_recordings: replay session data
CREATE TABLE public.session_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  replay_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners can manage recordings" ON public.session_recordings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = session_recordings.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = session_recordings.project_id AND projects.user_id = auth.uid()));

-- env_secrets: encrypted env secrets per project
CREATE TABLE public.env_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,
  encrypted_value text NOT NULL,
  scope text NOT NULL DEFAULT 'shared',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key, scope)
);
ALTER TABLE public.env_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners can manage env secrets" ON public.env_secrets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = env_secrets.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = env_secrets.project_id AND projects.user_id = auth.uid()));

-- deployment_pipelines: CI/CD pipeline configs per project
CREATE TABLE public.deployment_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'idle',
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deployment_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own pipelines" ON public.deployment_pipelines FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- project_bookmarks: user bookmarks for projects
CREATE TABLE public.project_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);
ALTER TABLE public.project_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bookmarks" ON public.project_bookmarks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookmarks visible to owner" ON public.project_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
