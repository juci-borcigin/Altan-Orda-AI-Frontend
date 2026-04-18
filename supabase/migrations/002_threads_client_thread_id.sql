-- Step 4-4: クライアントの議事 ID（th_*）と Supabase の threads.id（uuid）を対応付ける
-- 手順: SQL Editor で実行（001 適用済みのプロジェクトのみ）

alter table threads add column if not exists client_thread_id text;
create unique index if not exists threads_client_thread_id_uidx
  on threads (client_thread_id)
  where client_thread_id is not null;
