-- 論（threads.project_id）ごとの LLM モデル上書き。空行は削除し /api/chat は .env の LLM_MODEL にフォールバック。

create table if not exists public.ao_project_llm (
  project_id text primary key
    check (char_length(project_id) > 0 and char_length(project_id) <= 32),
  model_id text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.ao_project_llm is
  'Optional OpenRouter-style model id per project_id; empty means use env LLM_MODEL';

create index if not exists ao_project_llm_updated_at_idx
  on public.ao_project_llm (updated_at desc);

alter table public.ao_project_llm enable row level security;
