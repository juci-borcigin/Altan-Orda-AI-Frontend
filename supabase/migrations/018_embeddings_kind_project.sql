-- embeddings: Kind + 論（project_id）フィルタ、match_embeddings RPC 拡張

alter table public.embeddings
  add column if not exists kind text not null default 'thread'
    check (kind in ('thread', 'profile', 'spec', 'code'));

alter table public.embeddings
  add column if not exists project_id text;

comment on column public.embeddings.kind is
  'RAG 種別: thread=議事チャンク, profile=殿下プロファイル, spec/code=将来用';
comment on column public.embeddings.project_id is
  'ao 論 ID（plan/chat/debate 等）。threads.project_id を正規化して保存';

create index if not exists embeddings_project_kind_idx
  on public.embeddings (project_id, kind)
  where project_id is not null;

-- 既存行: messages → threads から project_id を埋める（クライアント論 ID はそのまま保存）
update public.embeddings e
set
  kind = coalesce(nullif(e.kind, ''), 'thread'),
  project_id = t.project_id
from public.messages m
join public.threads t on t.id = m.thread_id
where e.source_id = m.id
  and e.project_id is null
  and t.project_id is not null;

-- 旧 RPC シグネチャ互換のため drop して再作成
drop function if exists public.match_embeddings(vector, int, float);

create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.7,
  filter_project_id text default null,
  filter_kind text default null
)
returns table (
  id uuid,
  source_id uuid,
  source_type text,
  chunk_text text,
  similarity float,
  kind text,
  project_id text
)
language sql stable
as $$
  select
    e.id,
    e.source_id,
    e.source_type,
    e.chunk_text,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.kind,
    e.project_id
  from public.embeddings e
  where e.embedding is not null
    and (filter_project_id is null or e.project_id = filter_project_id)
    and (filter_kind is null or e.kind = filter_kind)
    and 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

comment on function public.match_embeddings(vector, int, float, text, text) is
  'RAG: cosine similarity search with optional project_id and kind filters';
