-- Phase 6 ①: ao_embeddings の kind / source_type 固定、wiki・book 正本テーブル
-- 既存 message 行は thread + message のまま。source_id FK を外し book/wiki を載せられるようにする。

-- ---------------------------------------------------------------------------
-- ao_embeddings: FK 解除・列追加・CHECK 更新
-- ---------------------------------------------------------------------------

do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'ao_embeddings'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) like '%source_id%'
  loop
    execute format('alter table public.ao_embeddings drop constraint %I', cname);
  end loop;
end $$;

alter table public.ao_embeddings
  add column if not exists chunk_index int not null default 0,
  add column if not exists source_citation text,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.ao_embeddings.chunk_index is
  '同一 source (type+id) 内のチャンク順序';
comment on column public.ao_embeddings.source_citation is
  '検索ヒット表示・chunk 前置用の短い出典ラベル（例: [Wiki: ジュチ・ウルス §1]）';

-- 旧 kind CHECK を置き換え
alter table public.ao_embeddings drop constraint if exists embeddings_kind_check;
alter table public.ao_embeddings drop constraint if exists ao_embeddings_kind_check;

update public.ao_embeddings
set kind = 'thread'
where kind is null or kind not in ('thread', 'wiki', 'book');

alter table public.ao_embeddings
  add constraint ao_embeddings_kind_check
  check (kind in ('thread', 'wiki', 'book'));

comment on column public.ao_embeddings.kind is
  'RAG コーパス: thread=議事, wiki=LLM Wiki, book=学究論ソース（旧 profile/spec/code は廃止）';

-- source_type CHECK
update public.ao_embeddings
set source_type = 'message'
where source_type is null
   or source_type not in ('message', 'wiki_page', 'book_file');

alter table public.ao_embeddings drop constraint if exists ao_embeddings_source_type_check;

alter table public.ao_embeddings
  add constraint ao_embeddings_source_type_check
  check (source_type in ('message', 'wiki_page', 'book_file'));

comment on column public.ao_embeddings.source_type is
  '正本の型: message | wiki_page | book_file（削除・再 embed の単位）';

-- kind と source_type の整合（アプリでも担保）
alter table public.ao_embeddings drop constraint if exists ao_embeddings_kind_source_type_check;

alter table public.ao_embeddings
  add constraint ao_embeddings_kind_source_type_check
  check (
    (source_type = 'message' and kind = 'thread')
    or (source_type = 'wiki_page' and kind = 'wiki')
    or (source_type = 'book_file' and kind = 'book')
  );

create index if not exists ao_embeddings_source_type_id_idx
  on public.ao_embeddings (source_type, source_id);

create index if not exists ao_embeddings_kind_project_idx
  on public.ao_embeddings (kind, project_id)
  where project_id is not null;

-- ---------------------------------------------------------------------------
-- ao_wiki_pages: LLM Wiki 正本
-- ---------------------------------------------------------------------------

create table if not exists public.ao_wiki_pages (
  id uuid primary key default gen_random_uuid(),
  theme_slug text not null,
  title text not null default '',
  body_md text not null default '',
  provenance jsonb not null default '{}'::jsonb,
  project_id text not null default 'notebook',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (theme_slug)
);

comment on table public.ao_wiki_pages is
  'LLM Wiki ページ正本。embed: kind=wiki, source_type=wiki_page';

create index if not exists ao_wiki_pages_project_idx
  on public.ao_wiki_pages (project_id);

-- ---------------------------------------------------------------------------
-- ao_book_sources: 学究論・外部ファイル正本（GDrive 等）
-- ---------------------------------------------------------------------------

create table if not exists public.ao_book_sources (
  id uuid primary key default gen_random_uuid(),
  project_id text not null default 'notebook',
  -- 取込経路: gdrive_file | url | paste | upload
  ingest_kind text not null default 'gdrive_file'
    check (ingest_kind in ('gdrive_file', 'url', 'paste', 'upload')),
  drive_file_id text,
  -- GDrive 上のファイル名など（書誌タイトルと別）
  display_name text not null default '',
  mime_type text,
  -- 書誌: 作品タイトル（論文名・書名。未入力時は display_name を UI で流用可）
  work_title text not null default '',
  authors text not null default '',
  published_year int check (published_year is null or published_year between 0 and 3000),
  publisher text not null default '',
  isbn text not null default '',
  source_url text not null default '',
  language text not null default '',
  extracted_text text not null default '',
  content_hash text,
  -- 書誌の追加項目（edition, journal, doi, pages 等）
  metadata jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ao_book_sources is
  '学究論ソース1件1行（Notebook ソース正本）。embed: kind=book, source_type=book_file';
comment on column public.ao_book_sources.display_name is
  'ファイル名・Drive 表示名（技術識別子）';
comment on column public.ao_book_sources.work_title is
  '書誌タイトル（引用・一覧用）';
comment on column public.ao_book_sources.authors is
  '著者（複数は「; 」区切り等、アプリで整形）';
comment on column public.ao_book_sources.metadata is
  '拡張書誌: edition, journal, volume, pages, doi, …';

create unique index if not exists ao_book_sources_project_drive_uidx
  on public.ao_book_sources (project_id, drive_file_id)
  where drive_file_id is not null and drive_file_id <> '';

create index if not exists ao_book_sources_project_idx
  on public.ao_book_sources (project_id);
