-- 書庫: NotebookLM 等（source_provider=nblm, source_facet=study）と既存 facet の文書化
-- 学究論のネイティブ議事は project_id=study（従来の notebook 行は一覧互換のため残す）

comment on column public.threads.source_facet is
  '取り込み分類: do | feel | think | chat（Claude / Gemini / ChatGPT 等）| study（NotebookLM 等）。学究論の AO ネイティブ議事では未設定可。';

comment on column public.threads.source_provider is
  '取り込み元: ao | claude | gemini | chatgpt | nblm（NotebookLM）等';

-- 学究論タブの既定モデル上書き用（空は環境 LLM_MODEL にフォールバック）。既存 notebook の設定があれば引き継ぐ。
insert into public.ao_project_llm (project_id, model_id, updated_at)
select 'study', coalesce((select model_id from public.ao_project_llm where project_id = 'notebook'), ''), now()
where not exists (select 1 from public.ao_project_llm where project_id = 'study');
