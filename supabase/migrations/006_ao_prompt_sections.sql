-- AO システムプロンプト断片（`web/src/lib/ao-prompts.ts` の `AO_PROMPT_SECTION_KEYS` と 1:1）
-- 初回データ: web で `npm run seed:prompts`（SUPABASE_* が必要）

create table if not exists public.ao_prompt_sections (
  section_key text primary key
    check (char_length(section_key) > 0 and char_length(section_key) <= 128),
  body text not null,
  updated_at timestamptz not null default now()
);

comment on table public.ao_prompt_sections is
  'System prompt sections for /api/chat; keys match AoPromptSectionKey in ao-prompts.ts';

create index if not exists ao_prompt_sections_updated_at_idx
  on public.ao_prompt_sections (updated_at desc);

alter table public.ao_prompt_sections enable row level security;
-- service_role は RLS を迂回。anon/authenticated 用ポリシーは未作成（サーバー専用）。
