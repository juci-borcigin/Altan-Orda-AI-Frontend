-- 議事ごとの履歴要約キャッシュ・明示参照（ピン）用 Supabase 正本
alter table public.ao_threads
  add column if not exists history_compression jsonb,
  add column if not exists pinned_thread_ids jsonb not null default '[]'::jsonb;

comment on column public.ao_threads.history_compression is
  '履歴要約キャッシュ { "from_message_id": uuid, "summary": text }。端末間同期用。';
comment on column public.ao_threads.pinned_thread_ids is
  '明示参照する他議事の ao_threads.id (uuid) 配列。';
