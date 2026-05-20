-- 論・僚友マスタ（SP 本文 + ランタイム）。seed 後は本表が正。

create table if not exists public.ao_projects (
  project_id text primary key
    check (char_length(project_id) > 0 and char_length(project_id) <= 32),
  section_key text not null,
  label_ja text not null default '',
  summary text not null default '',
  notes text not null default '',
  main_persona_key text not null default '',
  process text not null default '',
  tone text not null default '',
  rag_enabled boolean not null default true,
  rag_when text not null default 'every_user'
    check (rag_when in ('first_user', 'every_user')),
  rag_match_count int not null default 5
    check (rag_match_count >= 0 and rag_match_count <= 32),
  rag_match_threshold real not null default 0.5
    check (rag_match_threshold >= 0 and rag_match_threshold <= 1),
  rag_max_chars int not null default 4000
    check (rag_max_chars >= 0),
  history_max_messages int not null default 20
    check (history_max_messages >= 0),
  profile_inject boolean not null default false,
  web_search_enabled boolean not null default true,
  web_search_min_rounds int not null default 0
    check (web_search_min_rounds >= 0 and web_search_min_rounds <= 8),
  web_search_max_rounds int not null default 2
    check (web_search_max_rounds >= 0 and web_search_max_rounds <= 8),
  web_search_max_per_round int not null default 4
    check (web_search_max_per_round >= 0 and web_search_max_per_round <= 32),
  web_search_tavily_max_results int not null default 5
    check (web_search_tavily_max_results >= 0 and web_search_tavily_max_results <= 20),
  web_search_result_max_chars int not null default 12000
    check (web_search_result_max_chars >= 0),
  web_search_snippet_max_chars int not null default 450
    check (web_search_snippet_max_chars >= 0),
  max_completion_tokens int
    check (max_completion_tokens is null or (max_completion_tokens >= 256 and max_completion_tokens <= 8192)),
  updated_at timestamptz not null default now()
);

comment on table public.ao_projects is
  'Per-project prompt body (process/tone) and runtime params; authoritative after seed';

create table if not exists public.ao_personas (
  persona_key text primary key
    check (char_length(persona_key) > 0 and char_length(persona_key) <= 64),
  name text not null default '',
  title text not null default '',
  alias text not null default '',
  default_project_id text not null default '',
  summary text not null default '',
  fact text not null default '',
  thinking text not null default '',
  role text not null default '',
  tone text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.ao_personas is
  'Persona definitions for SP assembly and AO settings UI';

alter table public.ao_projects enable row level security;
alter table public.ao_personas enable row level security;
