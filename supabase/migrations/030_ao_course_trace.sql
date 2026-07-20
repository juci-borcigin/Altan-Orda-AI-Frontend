-- 講習メーカー Dev トレース（AO_COURSE_DEV_MODE 時に記録）

create table if not exists public.ao_course_trace_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.ao_courses(id) on delete cascade,
  phase text not null
    check (phase in ('tier1_outline', 'tier2_section', 'tier2_image', 'chat', 'ui_display')),
  step_key text not null,
  model_id text,
  provider text,
  system_prompt text,
  user_prompt text,
  response_text text,
  ui_display_ref text,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  latency_ms int not null default 0,
  cost_usd numeric(12, 6),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ao_course_trace_course_idx
  on public.ao_course_trace_events (course_id, created_at desc);
