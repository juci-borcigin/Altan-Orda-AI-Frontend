-- LLM へ送った全文・モデル応答全文（JSONL 等）を assistant 行の先頭チャンクに保存
alter table public.messages add column if not exists raw_prompt_sent text;
alter table public.messages add column if not exists raw_prompt_received text;

comment on column public.messages.raw_prompt_sent is 'OpenRouter へ送った messages ペイロード全文（JSON等）。assistant 先頭行のみ';
comment on column public.messages.raw_prompt_received is 'モデル応答の本文（parse前）。assistant 先頭行のみ';
