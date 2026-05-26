-- Phase 6: kind コーパス名 book → books（典籍論ソース。Qdrant payload と DB 整合）

update public.ao_embeddings
set kind = 'books'
where kind = 'book';

alter table public.ao_embeddings drop constraint if exists ao_embeddings_kind_check;

alter table public.ao_embeddings
  add constraint ao_embeddings_kind_check
  check (kind in ('thread', 'wiki', 'books'));

alter table public.ao_embeddings drop constraint if exists ao_embeddings_kind_source_type_check;

alter table public.ao_embeddings
  add constraint ao_embeddings_kind_source_type_check
  check (
    (source_type = 'message' and kind = 'thread')
    or (source_type = 'wiki_page' and kind = 'wiki')
    or (source_type = 'book_file' and kind = 'books')
  );

comment on column public.ao_embeddings.kind is
  'RAG コーパス: thread=議事, wiki=LLM Wiki, books=典籍論ソース（embed 本体は Qdrant、行はメタ用途のみ可）';

comment on table public.ao_book_sources is
  '典籍論（Notebook）ソース1件1行。ベクトルは Qdrant kind=books。ingest: source_type=book_file';
