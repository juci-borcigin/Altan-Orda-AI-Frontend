-- Phase 5: glossary, project map, persona alias, speaker allow, persona avatar, SP template hook

create table if not exists public.ao_glossary (
  ao_term text primary key
    check (char_length(ao_term) > 0 and char_length(ao_term) <= 128),
  general_term text not null
    check (char_length(general_term) > 0 and char_length(general_term) <= 256),
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.ao_glossary is
  'AO UI term ↔ general term for user decode (AO→general) and assistant encode (general→AO); not applied to storage';

create index if not exists ao_glossary_sort_idx on public.ao_glossary (sort_order desc, char_length(ao_term) desc);

create table if not exists public.ao_project_map (
  project_id text primary key
    check (char_length(project_id) > 0 and char_length(project_id) <= 32),
  section_key text not null
    check (char_length(section_key) > 0 and char_length(section_key) <= 128),
  topic_label_ja text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.ao_project_map is
  'threads.project_id → ao_prompt_sections project_* key and display label';

create table if not exists public.ao_persona_alias (
  alias text primary key
    check (char_length(alias) > 0 and char_length(alias) <= 64),
  persona_key text not null
    check (char_length(persona_key) > 0 and char_length(persona_key) <= 64),
  canonical_name text not null
    check (char_length(canonical_name) > 0 and char_length(canonical_name) <= 64),
  updated_at timestamptz not null default now()
);

comment on table public.ao_persona_alias is
  'Display/detection alias → persona_key and canonical tag name (e.g. ベキ → クドゥカ)';

create table if not exists public.ao_persona_avatar (
  persona_key text primary key
    check (char_length(persona_key) > 0 and char_length(persona_key) <= 64),
  display_name text not null,
  avatar_path text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.ao_persona_avatar is
  'persona_key → chat avatar asset path';

create table if not exists public.ao_speaker_allow (
  project_id text not null
    check (char_length(project_id) > 0 and char_length(project_id) <= 32),
  persona_key text not null
    check (char_length(persona_key) > 0 and char_length(persona_key) <= 64),
  sort_order int not null default 0,
  primary key (project_id, persona_key)
);

comment on table public.ao_speaker_allow is
  'Allowed persona keys per project for tag parsing / filter';

create table if not exists public.ao_mode_triggers (
  mode_key text primary key
    check (char_length(mode_key) > 0 and char_length(mode_key) <= 64),
  trigger_type text not null
    check (trigger_type in ('keyword', 'pattern')),
  trigger_value text not null,
  section_key text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.ao_mode_triggers is
  'When to attach mode_* prompt sections (section_key → ao_prompt_sections or phase5 body)';

alter table public.ao_glossary enable row level security;
alter table public.ao_project_map enable row level security;
alter table public.ao_persona_alias enable row level security;
alter table public.ao_persona_avatar enable row level security;
alter table public.ao_speaker_allow enable row level security;
alter table public.ao_mode_triggers enable row level security;
