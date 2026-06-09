
-- prompt_history: stores user AI prompt history per project
CREATE TABLE IF NOT EXISTS public.prompt_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  response text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Migrate from v1 schema: replace response_summary+metadata with response+model
ALTER TABLE public.prompt_history ADD COLUMN IF NOT EXISTS response text;
ALTER TABLE public.prompt_history ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.prompt_history DROP COLUMN IF EXISTS response_summary;
ALTER TABLE public.prompt_history DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.prompt_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own prompt history" ON public.prompt_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- context_pins: pinned context items for AI chat
CREATE TABLE IF NOT EXISTS public.context_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  content text NOT NULL,
  pin_type text NOT NULL DEFAULT 'snippet',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Migrate from v1 schema: replace file_path+symbol_name+note with label+content+pin_type
ALTER TABLE public.context_pins ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.context_pins ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.context_pins ADD COLUMN IF NOT EXISTS pin_type text NOT NULL DEFAULT 'snippet';
ALTER TABLE public.context_pins DROP COLUMN IF EXISTS file_path;
ALTER TABLE public.context_pins DROP COLUMN IF EXISTS symbol_name;
ALTER TABLE public.context_pins DROP COLUMN IF EXISTS note;
ALTER TABLE public.context_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own context pins" ON public.context_pins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai_review_suggestions: AI-generated code review suggestions
CREATE TABLE IF NOT EXISTS public.ai_review_suggestions (
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
-- Migrate from v1 schema: replace created_by+line_number+title+reason+suggested_patch with user_id+line_start+line_end+suggestion+severity+updated_at
ALTER TABLE public.ai_review_suggestions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ai_review_suggestions ADD COLUMN IF NOT EXISTS line_start integer;
ALTER TABLE public.ai_review_suggestions ADD COLUMN IF NOT EXISTS line_end integer;
ALTER TABLE public.ai_review_suggestions ADD COLUMN IF NOT EXISTS suggestion text;
ALTER TABLE public.ai_review_suggestions ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
ALTER TABLE public.ai_review_suggestions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.ai_review_suggestions DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.ai_review_suggestions DROP COLUMN IF EXISTS line_number;
ALTER TABLE public.ai_review_suggestions DROP COLUMN IF EXISTS title;
ALTER TABLE public.ai_review_suggestions DROP COLUMN IF EXISTS reason;
ALTER TABLE public.ai_review_suggestions DROP COLUMN IF EXISTS suggested_patch;
ALTER TABLE public.ai_review_suggestions DROP CONSTRAINT IF EXISTS ai_review_suggestions_status_check;
ALTER TABLE public.ai_review_suggestions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.ai_review_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review suggestions" ON public.ai_review_suggestions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- session_recordings: replay session data
CREATE TABLE IF NOT EXISTS public.session_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  replay_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
-- Migrate from v1 schema: replace started_by+started_at with created_at
ALTER TABLE public.session_recordings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.session_recordings DROP COLUMN IF EXISTS started_by;
ALTER TABLE public.session_recordings DROP COLUMN IF EXISTS started_at;
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners can manage recordings" ON public.session_recordings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = session_recordings.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = session_recordings.project_id AND projects.user_id = auth.uid()));

-- env_secrets: encrypted env secrets per project
CREATE TABLE IF NOT EXISTS public.env_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,
  encrypted_value text NOT NULL,
  scope text NOT NULL DEFAULT 'shared',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key, scope)
);
-- Migrate from v1 schema: drop created_by and old scope check
ALTER TABLE public.env_secrets DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.env_secrets DROP CONSTRAINT IF EXISTS env_secrets_scope_check;
ALTER TABLE public.env_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners can manage env secrets" ON public.env_secrets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = env_secrets.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = env_secrets.project_id AND projects.user_id = auth.uid()));

-- deployment_pipelines: CI/CD pipeline configs per project
CREATE TABLE IF NOT EXISTS public.deployment_pipelines (
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
-- Migrate from v1 schema: replace created_by+environment+graph with user_id+steps+status+last_run_at+updated_at
ALTER TABLE public.deployment_pipelines ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.deployment_pipelines ADD COLUMN IF NOT EXISTS steps jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.deployment_pipelines ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle';
ALTER TABLE public.deployment_pipelines ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
ALTER TABLE public.deployment_pipelines ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.deployment_pipelines DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.deployment_pipelines DROP COLUMN IF EXISTS environment;
ALTER TABLE public.deployment_pipelines DROP COLUMN IF EXISTS graph;
ALTER TABLE public.deployment_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own pipelines" ON public.deployment_pipelines FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- project_bookmarks: user bookmarks for projects
CREATE TABLE IF NOT EXISTS public.project_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);
-- Migrate from v1 schema: drop file_path+line_number+name+note; add UNIQUE constraint
ALTER TABLE public.project_bookmarks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_bookmarks DROP COLUMN IF EXISTS file_path;
ALTER TABLE public.project_bookmarks DROP COLUMN IF EXISTS line_number;
ALTER TABLE public.project_bookmarks DROP COLUMN IF EXISTS name;
ALTER TABLE public.project_bookmarks DROP COLUMN IF EXISTS note;
ALTER TABLE public.project_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bookmarks" ON public.project_bookmarks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookmarks visible to owner" ON public.project_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
