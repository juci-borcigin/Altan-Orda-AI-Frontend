-- =============================================================================
-- あとで実行する SQL。supabase/migrations ではない。今は適用しない。
-- =============================================================================
--
-- 議事ベクトルを Qdrant juci_conversations へ移し、RAG_BACKEND=qdrant で
-- 検索結果を確認したあとにだけ実行する。本文（chunk_text）は残す。
-- wiki の embedding は残す（kind=wiki はまだ Supabase 検索）。
--
-- このファイルを適用しても、アプリが ao_embeddings.embedding へ INSERT し続けると
-- 容量は戻る。適用前に Vercel の EMBEDDINGS_SUPABASE_VECTOR を 0 にする
-- （EMBEDDINGS_DUAL_WRITE は 1 のまま。Qdrant への書き込みは続ける）。
-- Praxia が match_embeddings で議事を検索しているあいだは実行しない。
--
-- ロールバックは取れない。実行前にバックアップを取る。
-- RAG_BACKEND=supabase に戻しても、ここを実行したあとの議事ヒットは 0 になる。
--
-- 事前確認（ベクトル本体は転送しない）:
--
--   select
--     count(*) filter (where embedding is not null) as with_vector,
--     count(*) filter (where kind = 'thread' or source_type = 'message') as conversation_rows,
--     count(*) filter (where kind = 'wiki') as wiki_rows,
--     pg_size_pretty(pg_total_relation_size('public.ao_embeddings')) as total_size
--   from public.ao_embeddings;
--
-- Qdrant の点数（会話コレクション）が、孤児を除いた conversation_rows と
-- 一致してから実行する。

drop index if exists public.ao_embeddings_embedding_hnsw_idx;

update public.ao_embeddings
set embedding = null
where kind = 'thread'
   or source_type = 'message';

-- 残る非 NULL（wiki など）だけを索引する。NULL は HNSW に入らない。
create index if not exists ao_embeddings_embedding_hnsw_idx
  on public.ao_embeddings
  using hnsw (embedding vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- VACUUM FULL はトランザクションの外で実行する。
-- Supabase SQL Editor は文をトランザクションで包むため、ここでは失敗する。
-- psql で:
--
--   psql "$SUPABASE_DB_URL" -c "VACUUM FULL public.ao_embeddings;"
--
-- VACUUM FULL は public.ao_embeddings を排他ロックする。
-- 通常の VACUUM ではファイルサイズが OS に返らないことがある。
-- 容量確認:
--
--   select pg_size_pretty(pg_total_relation_size('public.ao_embeddings'));
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- さらにあと（wiki も Supabase ベクトルをやめたときだけ）。今は実行しない。
-- match_embeddings は embedding 列を参照しているので、列を消す前に関数を落とす。
-- 5 引数と 6 引数のオーバーロードが両方残っている。
--
--   drop function if exists public.match_embeddings(vector, int, float, text, text, uuid);
--   drop function if exists public.match_embeddings(vector, int, float, text, text);
--   drop function if exists public.match_embeddings(vector, int, float);
--   alter table public.ao_embeddings drop column if exists embedding;
--   -- その後、トランザクションの外で:
--   --   VACUUM FULL public.ao_embeddings;
--
-- テーブルごと落とすのは chunk_text を捨てることになる。検索本文は Supabase に残す
-- 方針なので、テーブル DROP はしない。
-- -----------------------------------------------------------------------------
