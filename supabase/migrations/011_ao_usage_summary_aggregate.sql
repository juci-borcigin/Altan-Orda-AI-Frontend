-- 使用量オーバーレイ用: assistant 行をアプリへ列転送せず集計のみ返す（Egress 削減）

CREATE OR REPLACE FUNCTION public.ao_usage_summary_aggregate()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      coalesce(nullif(trim(model_id::text), ''), '(model 不明)') AS model_key,
      coalesce(prompt_tokens, 0)::bigint AS pt,
      coalesce(completion_tokens, 0)::bigint AS ct,
      coalesce(usd_estimate, 0)::numeric AS usd,
      created_at
    FROM messages
    WHERE role = 'assistant' AND prompt_tokens IS NOT NULL
  ),
  day0 AS (
    SELECT (date_trunc('day', timezone('utc', now())) AT TIME ZONE 'UTC') AS t0
  ),
  mon0 AS (
    SELECT (date_trunc('month', timezone('utc', now())) AT TIME ZONE 'UTC') AS t0
  ),
  sums AS (
    SELECT
      (SELECT count(*)::bigint FROM base) AS row_all,
      (SELECT coalesce(sum(pt), 0)::bigint FROM base, day0 WHERE base.created_at >= day0.t0) AS pt_day,
      (SELECT coalesce(sum(ct), 0)::bigint FROM base, day0 WHERE base.created_at >= day0.t0) AS ct_day,
      (SELECT coalesce(sum(usd), 0)::numeric FROM base, day0 WHERE base.created_at >= day0.t0) AS usd_day,
      (SELECT coalesce(sum(pt), 0)::bigint FROM base, mon0 WHERE base.created_at >= mon0.t0) AS pt_mon,
      (SELECT coalesce(sum(ct), 0)::bigint FROM base, mon0 WHERE base.created_at >= mon0.t0) AS ct_mon,
      (SELECT coalesce(sum(usd), 0)::numeric FROM base, mon0 WHERE base.created_at >= mon0.t0) AS usd_mon,
      (SELECT coalesce(sum(pt), 0)::bigint FROM base) AS pt_all,
      (SELECT coalesce(sum(ct), 0)::bigint FROM base) AS ct_all,
      (SELECT coalesce(sum(usd), 0)::numeric FROM base) AS usd_all
    FROM day0, mon0
  ),
  by_model AS (
    SELECT coalesce(
      jsonb_object_agg(
        model_key,
        jsonb_build_object(
          'promptTokens', pt,
          'completionTokens', ct,
          'estimatedUsd', usd
        )
      ),
      '{}'::jsonb
    ) AS j
    FROM (
      SELECT
        model_key,
        sum(pt)::bigint AS pt,
        sum(ct)::bigint AS ct,
        sum(usd)::numeric AS usd
      FROM base
      WHERE created_at >= now() - interval '30 days'
      GROUP BY model_key
    ) s
  )
  SELECT jsonb_build_object(
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
  FROM sums s, by_model bm;
$$;

REVOKE ALL ON FUNCTION public.ao_usage_summary_aggregate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ao_usage_summary_aggregate() TO service_role;
GRANT EXECUTE ON FUNCTION public.ao_usage_summary_aggregate() TO postgres;

COMMENT ON FUNCTION public.ao_usage_summary_aggregate() IS 'Usage overlay: aggregate assistant token/usd counts; byModel is last 30 days only';
