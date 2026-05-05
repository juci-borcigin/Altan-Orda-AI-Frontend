-- 書庫取り込み: スレッドの出所・Do/Feel/Think/Chat 分類（AO ゲルの project_id とは別軸）
-- 手順: Supabase SQL Editor で 002 適用済みのプロジェクトで実行

alter table threads add column if not exists source_facet text;
alter table threads add column if not exists source_provider text;
alter table threads add column if not exists source_native_id text;

comment on column threads.source_facet is '取り込み分類: do | feel | think | chat（未分類・一般）';
comment on column threads.source_provider is '取り込み元: claude | gemini | chatgpt 等';
comment on column threads.source_native_id is 'エクスポート側の会話 ID（文字列）';
