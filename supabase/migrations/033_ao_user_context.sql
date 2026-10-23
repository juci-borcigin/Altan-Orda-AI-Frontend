-- 殿下の人物コンテキスト（ウルス / コルグズが更新する立ち情報）。
-- チャットのシステムプロンプトへ毎ターン全文を足す。RAG（ao_embeddings）には入れない。
-- 本文はこのファイルに書かない。空の1行だけ作り、適用後にウルスが upsert する。
--
-- 既存の ao_prompts.header.profile / header_profile は初回ターンかつ profile_inject の断片で、
-- seed と設定画面が上書きする。立ち情報の置き場所には使わない。
--
-- 書き込み例（本文は 20,000 字以内。ドル引用で Markdown をそのまま渡せる）:
--   insert into public.ao_user_context (context_key, body, updated_at)
--   values ('juchi', $body$
--   （ここへ context 全文）
--   $body$, now())
--   on conflict (context_key) do update
--   set body = excluded.body,
--       updated_at = now();

create table if not exists public.ao_user_context (
  context_key text primary key
    check (context_key = 'juchi'),
  body text not null default '',
  updated_at timestamptz not null default now(),
  constraint ao_user_context_body_len check (char_length(body) <= 20000)
);

comment on table public.ao_user_context is
  'Standing person context for the AO system prompt. One row (juchi). Written outside AO; not a RAG source.';

comment on column public.ao_user_context.context_key is
  'Singleton key. Only juchi is allowed.';

comment on column public.ao_user_context.body is
  'Full person-context text injected on every chat turn. Empty until written. Max 20000 chars.';

insert into public.ao_user_context (context_key, body)
values ('juchi', '')
on conflict (context_key) do nothing;

alter table public.ao_user_context enable row level security;

-- Data API は grant と RLS の両方が要る。anon / authenticated には権限を渡さない。
-- サーバーは service_role（RLS を迂回）。ウルスの SQL（postgres）は所有者として書ける。
revoke all on table public.ao_user_context from public, anon, authenticated;
grant select, insert, update, delete on table public.ao_user_context to service_role;

notify pgrst, 'reload schema';
