-- 議事・メッセージ（および messages を参照する embeddings）を一括削除し、
-- import-logs.mjs からの再取り込みをやり直す用。
-- Supabase SQL Editor で実行。元に戻せないので、実行前にバックアップを推奨。
--
-- 依存: embeddings.source_id → messages(id)、messages.thread_id → threads(id)

begin;

truncate table public.embeddings restart identity cascade;
truncate table public.messages restart identity cascade;
truncate table public.threads restart identity cascade;

commit;
