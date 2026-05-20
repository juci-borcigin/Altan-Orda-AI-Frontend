-- DB 整理: model_id / avatar_path を正本表へ集約、レガシー表・不要 prompt 断片を削除。
-- rule_detail は旧 buildAoSystemPrompt フォールバック用に残す。

-- ao_projects.model_id（旧 ao_project_llm）
alter table public.ao_projects
  add column if not exists model_id text not null default '';

comment on column public.ao_projects.model_id is
  'Per-project LLM model override; empty string = env LLM_MODEL / OPENAI_MODEL';

update public.ao_projects p
set
  model_id = coalesce(nullif(trim(l.model_id), ''), p.model_id),
  updated_at = greatest(p.updated_at, coalesce(l.updated_at, p.updated_at))
from public.ao_project_llm l
where p.project_id = l.project_id
  and l.project_id not in ('study', 'talk');

update public.ao_projects p
set
  model_id = coalesce(nullif(trim(p.model_id), ''), nullif(trim(s.model_id), '')),
  updated_at = now()
from public.ao_project_llm s
where p.project_id = 'notebook'
  and s.project_id = 'study'
  and nullif(trim(s.model_id), '') is not null;

-- ao_personas.avatar_path（旧 ao_persona_avatar）
alter table public.ao_personas
  add column if not exists avatar_path text not null default '';

comment on column public.ao_personas.avatar_path is
  'Chat UI portrait asset path (e.g. /personas/AO_Char_Hunan.png)';

update public.ao_personas p
set
  avatar_path = coalesce(nullif(trim(a.avatar_path), ''), p.avatar_path),
  updated_at = greatest(p.updated_at, coalesce(a.updated_at, p.updated_at))
from public.ao_persona_avatar a
where p.persona_key = a.persona_key;

-- 学究論: 議事 project_id を notebook に統一（source_facet=study は別軸のため触らない）
update public.threads
set project_id = 'notebook'
where project_id = 'study';

-- 不要 ao_prompt_sections（Phase5 正本・rule_detail レガシー以外）
delete from public.ao_prompt_sections
where section_key like 'card\_%' escape '\'
   or section_key like 'lore\_%' escape '\'
   or section_key like 'persona\_%' escape '\'
   or section_key like 'project\_%' escape '\'
   or section_key in (
     'name_override_rule',
     'jsonl_rules',
     'global_glossary',
     'global.system'
   );

drop table if exists public.ao_speaker_allow;
drop table if exists public.ao_persona_avatar;
drop table if exists public.ao_project_runtime;
drop table if exists public.ao_project_map;
drop table if exists public.ao_project_llm;
