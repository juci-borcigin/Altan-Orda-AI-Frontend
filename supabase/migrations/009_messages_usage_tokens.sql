-- LLM 使用量（1応答あたりの集計は「助手チャンクの先頭行」のみに保存し二重計上を避ける）

alter table public.messages add column if not exists prompt_tokens integer;
alter table public.messages add column if not exists completion_tokens integer;
alter table public.messages add column if not exists usd_estimate numeric(14, 6);

comment on column public.messages.prompt_tokens is 'Assistant turn: aggregated prompt tokens (first chunk row only)';
comment on column public.messages.completion_tokens is 'Assistant turn: aggregated completion tokens (first chunk row only)';
comment on column public.messages.usd_estimate is 'Rough USD estimate from env rates; nullable';
