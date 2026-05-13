import { NextResponse } from "next/server";
import { aoUsageSummaryFallbackAggregates } from "@/lib/ao-usage-summary-fallback";
import { vendorPrefixFromModelId } from "@/lib/ao-usage-estimate";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Agg = { promptTokens: number; completionTokens: number; estimatedUsd: number; totalTokens: number };

type RpcAgg = { promptTokens?: unknown; completionTokens?: unknown; estimatedUsd?: unknown };

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toAgg(row: RpcAgg | null | undefined): Agg | undefined {
  if (!row || typeof row !== "object") return undefined;
  const pt = Math.max(0, Math.floor(num(row.promptTokens)));
  const ct = Math.max(0, Math.floor(num(row.completionTokens)));
  const estimatedUsd = num(row.estimatedUsd);
  return {
    promptTokens: pt,
    completionTokens: ct,
    estimatedUsd,
    totalTokens: pt + ct,
  };
}

/** POST /api/chat で記録された assistant 行（prompt_tokens あり）の集計。DB 側 RPC で行転送なし。 */
export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase が未設定です。" }, { status: 503 });
  }

  const { data, error } = await supa.rpc("ao_usage_summary_aggregate");

  if (error) {
    console.warn("[usage/summary] rpc failed:", error.message);
    try {
      const fb = await aoUsageSummaryFallbackAggregates(supa);
      return NextResponse.json(fb);
    } catch (fbErr) {
      const fbMsg = fbErr instanceof Error ? fbErr.message : String(fbErr);
      console.error("[usage/summary] fallback failed:", fbMsg);
      return NextResponse.json(
        {
          error: error.message,
          fallbackError: fbMsg,
          hint:
            "まず supabase/migrations/011_ao_usage_summary_aggregate.sql を適用し、ダッシュボードでスキーマ再読込（または NOTIFY pgrst, 'reload schema'）を試してください。フォールバックも失敗した場合は PostgREST の集計構文・messages の RLS／権限を確認してください。",
        },
        { status: 500 },
      );
    }
  }

  const root = (data ?? null) as Record<string, unknown> | null;
  if (!root || typeof root !== "object") {
    return NextResponse.json({ error: "Invalid RPC response" }, { status: 500 });
  }

  const counts = root.counts as { assistantTurnRows?: unknown } | undefined;
  const assistantTurnRows = Math.max(0, Math.floor(num(counts?.assistantTurnRows)));

  const today = toAgg(root.today as RpcAgg);
  const month = toAgg(root.month as RpcAgg);
  const all = toAgg(root.all as RpcAgg);

  const byModelRaw = root.byModel;
  const byModel: Record<string, { promptTokens: number; completionTokens: number; estimatedUsd: number }> = {};
  if (byModelRaw && typeof byModelRaw === "object" && !Array.isArray(byModelRaw)) {
    for (const [k, v] of Object.entries(byModelRaw)) {
      const a = toAgg(v as RpcAgg);
      if (!a) continue;
      byModel[k] = {
        promptTokens: a.promptTokens,
        completionTokens: a.completionTokens,
        estimatedUsd: a.estimatedUsd,
      };
    }
  }

  const byVendor: Record<string, { promptTokens: number; completionTokens: number; estimatedUsd: number }> = {};
  for (const [modelId, v] of Object.entries(byModel)) {
    const vend = vendorPrefixFromModelId(modelId);
    if (!byVendor[vend]) {
      byVendor[vend] = { promptTokens: 0, completionTokens: 0, estimatedUsd: 0 };
    }
    byVendor[vend].promptTokens += v.promptTokens;
    byVendor[vend].completionTokens += v.completionTokens;
    byVendor[vend].estimatedUsd += v.estimatedUsd;
  }

  return NextResponse.json({
    counts: { assistantTurnRows },
    windowDays: Math.floor(num(root.windowDays)) || 30,
    today,
    month,
    all,
    byVendor,
    byModel,
  });
}
