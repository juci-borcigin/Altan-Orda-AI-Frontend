-- 典籍正本: extracted_text は載せない方針（hash + 都度アップロード）

alter table public.ao_book_sources
  alter column extracted_text drop not null;

alter table public.ao_book_sources
  alter column extracted_text set default '';

comment on column public.ao_book_sources.extracted_text is
  '非推奨・空推奨。全文は Qdrant payload のみ。再 ingest は content_hash と都度アップロードで';
