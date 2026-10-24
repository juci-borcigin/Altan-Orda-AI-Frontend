-- 殿下の人物コンテキスト（ウルス / コルグズが更新する立ち情報）。
-- チャットのシステムプロンプト先頭へ毎ターン全文を足す。RAG（ao_embeddings）には入れない。
-- 本文はこのファイルに書かない。空の1行だけ作り、適用後に関数で書き込む。
--
-- このファイルは未適用の前提で書き直している。古い版を既に当てたデータベースには、
-- そのまま再実行しない。
--
-- RLS は有効にする。ポリシーは作らない（anon / authenticated は行を見られない）。
-- service_role は RLS を迂回するが、付与するのは select だけ。
-- 書き込みは ao_private.ao_set_user_context だけ。security definer は Data API に出る
-- public には置かない。ao_private を Exposed schemas に追加しない。

create table if not exists public.ao_user_context (
  context_key text primary key
    check (context_key = 'juchi'),
  body text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  constraint ao_user_context_body_len check (char_length(body) <= 20000),
  constraint ao_user_context_updated_by_len check (char_length(updated_by) <= 64)
);

comment on table public.ao_user_context is
  'Standing person context. One row (juchi). Not a RAG source. Writes go through ao_private.ao_set_user_context only.';

comment on column public.ao_user_context.body is
  'Full person-context text. Empty until written. Max 20000 chars.';

comment on column public.ao_user_context.updated_by is
  'Who last wrote the row, as passed to ao_set_user_context. Max 64 chars.';

insert into public.ao_user_context (context_key, body, updated_by)
values ('juchi', '', '')
on conflict (context_key) do nothing;

alter table public.ao_user_context enable row level security;
-- ポリシーは意図的に作らない。

revoke all on table public.ao_user_context from public, anon, authenticated, service_role;
grant select on table public.ao_user_context to service_role;

-- 論の主担当（ao_projects.main_persona_key）がこの列を false にすると、その論では差し込まない。既定はオン。
alter table public.ao_personas
  add column if not exists inject_user_context boolean not null default true;

comment on column public.ao_personas.inject_user_context is
  'When this persona is the project main persona, prepend ao_user_context to the system prompt.';

create schema if not exists ao_private;

revoke all on schema ao_private from public;
revoke all on schema ao_private from anon, authenticated, service_role;

create or replace function ao_private.ao_set_user_context(body text, updated_by text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_by text := btrim(coalesce(updated_by, ''));
begin
  if body is null then
    raise exception 'body is required';
  end if;
  if char_length(body) > 20000 then
    raise exception 'body exceeds 20000 characters';
  end if;
  if v_by = '' then
    raise exception 'updated_by is required';
  end if;
  if char_length(v_by) > 64 then
    raise exception 'updated_by exceeds 64 characters';
  end if;

  insert into public.ao_user_context as c (context_key, body, updated_by, updated_at)
  values ('juchi', ao_set_user_context.body, v_by, now())
  on conflict (context_key) do update
  set body = excluded.body,
      updated_by = excluded.updated_by,
      updated_at = now();
end;
$$;

comment on function ao_private.ao_set_user_context(text, text) is
  'Upsert the single juchi person-context row. Only write path. Caller is the function owner (SQL), not the Data API.';

revoke all on function ao_private.ao_set_user_context(text, text) from public;
revoke all on function ao_private.ao_set_user_context(text, text) from anon, authenticated, service_role;

-- 呼び出し例（postgres の SQL。本文は 20,000 字以内）:
--   select ao_private.ao_set_user_context(
--     $body$
--     （ここへ context 全文）
--     $body$,
--     'khorguz'
--   );

notify pgrst, 'reload schema';
