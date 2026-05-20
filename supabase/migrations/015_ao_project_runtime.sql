-- 論ごとの実行パラメータ（RAG / 履歴 / Web検索 / max_tokens 等）。令旨本文は ao_prompt_sections。

create table if not exists public.ao_project_runtime (
  project_id text primary key
    check (char_length(project_id) > 0 and char_length(project_id) <= 32),
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

comment on table public.ao_project_runtime is
  'Per-project runtime toggles for RAG, history trim, web search, completion budget; not system prompt prose';

alter table public.ao_project_runtime enable row level security;

-- 既定値（web/src/lib/phase5/project-runtime.ts と同期）
insert into public.ao_project_runtime (
  project_id,
  rag_enabled,
  rag_when,
  rag_match_count,
  rag_match_threshold,
  rag_max_chars,
  history_max_messages,
  profile_inject,
  web_search_enabled,
  web_search_max_rounds,
  web_search_max_per_round,
  web_search_tavily_max_results,
  web_search_result_max_chars,
  web_search_snippet_max_chars,
  max_completion_tokens
) values
  ('debate', true, 'every_user', 5, 0.5, 4000, 12, false, true, 2, 4, 5, 12000, 450, null),
  ('chat', true, 'every_user', 5, 0.5, 4000, 12, false, true, 2, 4, 5, 12000, 450, 3072),
  ('plan', true, 'every_user', 5, 0.5, 4000, 20, false, true, 2, 4, 5, 12000, 450, null),
  ('work', true, 'every_user', 5, 0.5, 4000, 20, false, true, 2, 4, 5, 12000, 450, null),
  ('mental', true, 'every_user', 5, 0.5, 4000, 20, true, false, 2, 4, 5, 12000, 450, null),
  ('notebook', true, 'every_user', 5, 0.5, 4000, 20, false, true, 2, 4, 5, 12000, 450, null),
  ('foreign', true, 'every_user', 5, 0.5, 4000, 20, false, false, 2, 4, 5, 12000, 450, null)
on conflict (project_id) do update set
  rag_enabled = excluded.rag_enabled,
  rag_when = excluded.rag_when,
  rag_match_count = excluded.rag_match_count,
  rag_match_threshold = excluded.rag_match_threshold,
  rag_max_chars = excluded.rag_max_chars,
  history_max_messages = excluded.history_max_messages,
  profile_inject = excluded.profile_inject,
  web_search_enabled = excluded.web_search_enabled,
  web_search_max_rounds = excluded.web_search_max_rounds,
  web_search_max_per_round = excluded.web_search_max_per_round,
  web_search_tavily_max_results = excluded.web_search_tavily_max_results,
  web_search_result_max_chars = excluded.web_search_result_max_chars,
  web_search_snippet_max_chars = excluded.web_search_snippet_max_chars,
  max_completion_tokens = excluded.max_completion_tokens,
  updated_at = now();
