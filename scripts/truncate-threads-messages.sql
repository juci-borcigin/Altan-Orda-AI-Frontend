-- 議事・メッセージ（および ao_messages を参照する ao_embeddings）を一括削除し、
-- import-logs.mjs からの再取り込みをやり直す用。
-- Supabase SQL Editor で実行。元に戻せないので、実行前にバックアップを推奨。
--
-- 依存: ao_embeddings.source_id → ao_messages(id)、ao_messages.thread_id → ao_threads(id)

begin;

truncate table public.ao_embeddings restart identity cascade;
truncate table public.ao_messages restart identity cascade;
truncate table public.ao_threads restart identity cascade;

commit;
