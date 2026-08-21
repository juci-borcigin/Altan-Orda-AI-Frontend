-- 講習メーカー（独立モジュール）

create table if not exists public.ao_courses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null default 'default',
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'outline_draft', 'outline_approved', 'generating', 'ready', 'failed')),
  generation_mode text not null default 'pipeline_batch'
    check (generation_mode in ('progressive', 'pipeline_batch')),
  params jsonb not null default '{}'::jsonb,
  course_master jsonb,
  last_opened_session_no int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ao_course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.ao_courses(id) on delete cascade,
  session_no int not null check (session_no >= 1),
  markdown_body text,
  word_count int,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'ready', 'failed')),
  verification jsonb,
  generation_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, session_no)
);

create table if not exists public.ao_course_visuals (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.ao_courses(id) on delete cascade,
  session_no int not null check (session_no >= 1),
  slot_id text not null,
  visual_type text,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'ready', 'failed', 'skipped')),
  artifact_url text,
  prompt text,
  image_model_id text,
  image_model_tier text check (image_model_tier in ('mini', 'medium')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, session_no, slot_id)
);

create table if not exists public.ao_course_sources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.ao_courses(id) on delete cascade,
  source_type text not null check (source_type in ('upload', 'wikipedia', 'url')),
  external_id text,
  title text not null,
  locked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ao_courses_owner_idx on public.ao_courses (owner_user_id, updated_at desc);
create index if not exists ao_course_sessions_course_idx on public.ao_course_sessions (course_id, session_no);
create index if not exists ao_course_visuals_course_idx on public.ao_course_visuals (course_id, session_no);
create index if not exists ao_course_sources_course_idx on public.ao_course_sources (course_id);
