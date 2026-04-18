-- Step 4-2（初回のみ実行）
-- 手順: Supabase ダッシュボード → SQL Editor → 本ファイルの全文を貼り付け → Run
-- 仕様の原文: docs/operations/AO_Frontend_Ver2_Implementation_Spec.md（Step 4-2）
-- 再実行: 既存オブジェクトがあるとエラーになるため、初回のみ。やり直す場合は Table Editor / SQL で手動削除が必要。

-- pgvector 拡張の有効化
create extension if not exists vector;

-- threads：議事スレッド
create table if not exists threads (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  project_id   text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- messages：メッセージ（正規化済み text + 生レスポンス raw_response の両方を保存）
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid references threads(id) on delete cascade,
  role            text not null,         -- 'user' | 'assistant'
  text            text not null,         -- パース・正規化済みテキスト（RAG・表示対象）
  persona         text,                  -- 'フナン' | 'モンケウール' 等（1行＝1ペルソナ発言）
  provider        text,                  -- 'openrouter'（全ペルソナ共通）
  model_id        text,                  -- 実使用モデルID（例: anthropic/claude-sonnet-4.5）
  content_type    text default 'text',   -- 'text' | 'code' | 'artifact' | 'image'
  artifact_url    text,                  -- 将来用（Supabase Storage URL）
  raw_response    jsonb,                 -- プロバイダの生レスポンス全体（1応答につき1件目のみ保存）
  tool_results    jsonb,                 -- Tavily検索結果等
  token_count     int,
  created_at      timestamptz default now()
);

-- embeddings：RAGベクトルインデックス
create table if not exists embeddings (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references messages(id) on delete cascade,
  source_type  text not null,   -- 'message' | 'profile'
  chunk_text   text not null,
  embedding    vector(1536),    -- text-embedding-3-small（1536次元固定）
  created_at   timestamptz default now()
);

create index if not exists embeddings_embedding_hnsw_idx
  on embeddings using hnsw (embedding vector_cosine_ops);

-- profile_entries：殿下個人知識DB
create table if not exists profile_entries (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  content     text not null,
  priority    int default 5,    -- 1（高）〜10（低）。注入上限超過時に優先度順でカット
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- match_embeddings RPC（RAG検索用）
create or replace function match_embeddings(
  query_embedding vector(1536),
  match_count     int default 5,
  match_threshold float default 0.7
)
returns table (
  id          uuid,
  source_id   uuid,
  source_type text,
  chunk_text  text,
  similarity  float
)
language sql stable
as $$
  select
    id,
    source_id,
    source_type,
    chunk_text,
    1 - (embedding <=> query_embedding) as similarity
  from embeddings
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
