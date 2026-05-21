-- RAG: 当該議事の message チャンクを検索から除外
-- 履歴: トークン閾値で要約（論別）
-- 令旨: global.search（Web 検索方針）

alter table public.ao_projects
  add column if not exists history_compress_token_threshold int not null default 22000
    check (history_compress_token_threshold >= 0);

comment on column public.ao_projects.history_compress_token_threshold is
  '送信履歴の推定トークンがこの値を超えたら古いターンを要約1本に畳む（0=無効）';

create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.7,
  filter_project_id text default null,
  filter_kind text default null,
  exclude_thread_id uuid default null
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
    and (
      exclude_thread_id is null
      or e.source_type is distinct from 'message'
      or not exists (
        select 1
        from public.ao_messages m
        where m.id = e.source_id
          and m.thread_id = exclude_thread_id
      )
    )
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

comment on function public.match_embeddings(vector, int, float, text, text, uuid) is
  'RAG: cosine similarity on ao_embeddings; exclude_thread_id で同一議事の message チャンクを除外';

insert into public.ao_prompts (section_key, body, updated_at)
values (
  'global.search',
  $body$【Web検索（ツール `web_search` 使用時）】
- 検索は殿下の質問に直接必要な事実・数値・定義の確認に限る。背景調査や網羅的サーベイは、殿下が明示したときのみ。
- 1ラウンドあたりの `web_search` 呼び出しは環境・論別設定の上限まで。複数クエリは統合し、同趣旨の乱発・再検索を繰り返さない。
- ユーザー投稿ターン数が `web_search_min_rounds` 未満のときは検索しない（令旨の論別設定に従う）。
- 2ラウンド目以降は、既に得た tool 結果で足りるなら追加検索しない。
- 検索結果は要約して本文に織り込む。検索だけして回答を先延ばしにしない（ツール往復の空転を避ける）。
- `web_search_per_round_limit` や検索失敗が返ったら、クエリを統合して1回に絞るか、分かる範囲で不確実性を明示して答える。
- 引数は query のみ。不要な検索はしない。$body$,
  now()
)
on conflict (section_key) do update set
  body = excluded.body,
  updated_at = excluded.updated_at;

-- system_template: §5 先頭に {{SEARCH}}（既存 DB を上書きしないよう、プレースホルダが無いときのみ追記はアプリ側で吸収）
