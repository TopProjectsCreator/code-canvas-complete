create extension if not exists pgcrypto;

create table if not exists public.prompt_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  prompt text not null,
  response_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.context_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  file_path text not null,
  symbol_name text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_review_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  file_path text not null,
  line_number integer not null,
  title text not null,
  reason text,
  suggested_patch jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.session_recordings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms integer not null default 0,
  replay_events jsonb not null default '[]'::jsonb
);

create table if not exists public.env_secrets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  key text not null,
  encrypted_value text not null,
  scope text not null default 'shared' check (scope in ('preview', 'shared', 'production')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, key, scope)
);

create table if not exists public.deployment_pipelines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  environment text not null default 'preview',
  graph jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_bookmarks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  line_number integer not null,
  name text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.prompt_history enable row level security;
alter table public.context_pins enable row level security;
alter table public.ai_review_suggestions enable row level security;
alter table public.session_recordings enable row level security;
alter table public.env_secrets enable row level security;
alter table public.deployment_pipelines enable row level security;
alter table public.project_bookmarks enable row level security;

create policy "Users manage their prompt history"
on public.prompt_history
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage their context pins"
on public.context_pins
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Project members view ai review suggestions"
on public.ai_review_suggestions
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and (p.user_id = auth.uid() or p.is_public = true)
  )
);

create policy "Project owners manage ai review suggestions"
on public.ai_review_suggestions
for all
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.user_id = auth.uid()
  )
);

create policy "Project owners manage session recordings"
on public.session_recordings
for all
using (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "Project owners manage env secrets"
on public.env_secrets
for all
using (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "Project owners manage deployment pipelines"
on public.deployment_pipelines
for all
using (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "Users manage project bookmarks"
on public.project_bookmarks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
