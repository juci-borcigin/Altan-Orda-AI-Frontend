-- コアテーブルを ao_* 名前空間へ統一
-- threads / messages / embeddings → ao_threads / ao_messages / ao_embeddings
-- ao_prompt_sections → ao_prompts

alter table if exists public.threads rename to ao_threads;
alter table if exists public.messages rename to ao_messages;
alter table if exists public.embeddings rename to ao_embeddings;
alter table if exists public.ao_prompt_sections rename to ao_prompts;

-- インデックス名（存在する場合のみ）
do $$
begin
  if exists (select 1 from pg_class where relname = 'embeddings_embedding_hnsw_idx') then
    alter index public.embeddings_embedding_hnsw_idx rename to ao_embeddings_embedding_hnsw_idx;
  end if;
  if exists (select 1 from pg_class where relname = 'embeddings_project_kind_idx') then
    alter index public.embeddings_project_kind_idx rename to ao_embeddings_project_kind_idx;
  end if;
  if exists (select 1 from pg_class where relname = 'ao_prompt_sections_updated_at_idx') then
    alter index public.ao_prompt_sections_updated_at_idx rename to ao_prompts_updated_at_idx;
  end if;
end $$;

comment on table public.ao_threads is 'AO 議事スレッド（旧 threads）';
comment on table public.ao_messages is 'AO メッセージ（旧 messages）';
comment on table public.ao_embeddings is 'RAG ベクトルインデックス（旧 embeddings）';
comment on table public.ao_prompts is 'システムプロンプト断片（旧 ao_prompt_sections）';

-- match_embeddings: 参照テーブルを ao_embeddings に
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
set search_path = public
as $$
  select
    e.id,
    e.source_id,
    e.source_type,
    e.chunk_text,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.kind,
    e.project_id
  from public.ao_embeddings e
  where e.embedding is not null
    and (filter_project_id is null or e.project_id = filter_project_id)
    and (filter_kind is null or e.kind = filter_kind)
    and 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

comment on function public.match_embeddings(vector, int, float, text, text) is
  'RAG: cosine similarity on ao_embeddings';

-- 使用量集計 RPC
create or replace function public.ao_usage_summary_aggregate()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      coalesce(nullif(trim(model_id::text), ''), '(model 不明)') as model_key,
      coalesce(prompt_tokens, 0)::bigint as pt,
      coalesce(completion_tokens, 0)::bigint as ct,
      coalesce(usd_estimate, 0)::numeric as usd,
      created_at
    from public.ao_messages
    where role = 'assistant' and prompt_tokens is not null
  ),
  day0 as (
    select (date_trunc('day', timezone('utc', now())) at time zone 'UTC') as t0
  ),
  mon0 as (
    select (date_trunc('month', timezone('utc', now())) at time zone 'UTC') as t0
  ),
  sums as (
    select
      (select count(*)::bigint from base) as row_all,
      (select coalesce(sum(pt), 0)::bigint from base, day0 where base.created_at >= day0.t0) as pt_day,
      (select coalesce(sum(ct), 0)::bigint from base, day0 where base.created_at >= day0.t0) as ct_day,
      (select coalesce(sum(usd), 0)::numeric from base, day0 where base.created_at >= day0.t0) as usd_day,
      (select coalesce(sum(pt), 0)::bigint from base, mon0 where base.created_at >= mon0.t0) as pt_mon,
      (select coalesce(sum(ct), 0)::bigint from base, mon0 where base.created_at >= mon0.t0) as ct_mon,
      (select coalesce(sum(usd), 0)::numeric from base, mon0 where base.created_at >= mon0.t0) as usd_mon,
      (select coalesce(sum(pt), 0)::bigint from base) as pt_all,
      (select coalesce(sum(ct), 0)::bigint from base) as ct_all,
      (select coalesce(sum(usd), 0)::numeric from base) as usd_all
    from day0, mon0
  ),
  by_model as (
    select coalesce(
      jsonb_object_agg(
        model_key,
        jsonb_build_object(
          'promptTokens', pt,
          'completionTokens', ct,
          'estimatedUsd', usd
        )
      ),
      '{}'::jsonb
    ) as j
    from (
      select
        model_key,
        sum(pt)::bigint as pt,
        sum(ct)::bigint as ct,
        sum(usd)::numeric as usd
      from base
      where created_at >= now() - interval '30 days'
      group by model_key
    ) s
  )
  select jsonb_build_object(
    'counts', jsonb_build_object('assistantTurnRows', s.row_all),
    'windowDays', 30,
    'today', jsonb_build_object(
      'promptTokens', s.pt_day,
      'completionTokens', s.ct_day,
      'estimatedUsd', s.usd_day
    ),
    'month', jsonb_build_object(
      'promptTokens', s.pt_mon,
      'completionTokens', s.ct_mon,
      'estimatedUsd', s.usd_mon
    ),
    'all', jsonb_build_object(
      'promptTokens', s.pt_all,
      'completionTokens', s.ct_all,
      'estimatedUsd', s.usd_all
    ),
    'byModel', bm.j
  )
  from sums s, by_model bm;
$$;

notify pgrst, 'reload schema';
