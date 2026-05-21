import type { SupabaseClient } from "@supabase/supabase-js";
import { vendorPrefixFromModelId } from "@/lib/ao-usage-estimate";

/** admin クライアントは DB 型定義なしのため、集計に必要な列だけ擬似スキーマで扱う */
type MessagesRow = {
  id: string;
  role: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  usd_estimate: number | null;
  model_id: string | null;
  created_at: string;
};

type UsageSummaryDatabase = {
  public: {
    Tables: {
      ao_messages: { Row: MessagesRow; Insert: never; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type TypedAdmin = SupabaseClient<UsageSummaryDatabase, "public">;

type Agg = { promptTokens: number; completionTokens: number; estimatedUsd: number; totalTokens: number };

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function utcDayStartIso(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())).toISOString();
}

function utcMonthStartIso(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString();
}

function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - 30 * 86400000).toISOString();
}

/** PostgREST 集計行から sum を取り出す（キー名はバージョンで揺れうる） */
function pickSums(row: Record<string, unknown> | null | undefined): { pt: number; ct: number; usd: number } {
  if (!row || typeof row !== "object") return { pt: 0, ct: 0, usd: 0 };

  let pt = 0;
  let ct = 0;
  let usd = 0;

  const sumNest = row.sum;
  if (sumNest && typeof sumNest === "object" && !Array.isArray(sumNest)) {
    const s = sumNest as Record<string, unknown>;
    pt = num(s.prompt_tokens ?? s.promptTokens);
    ct = num(s.completion_tokens ?? s.completionTokens);
    usd = num(s.usd_estimate ?? s.estimatedUsd);
  }

  for (const [k, v] of Object.entries(row)) {
    const lk = k.toLowerCase();
    if (lk === "model_id") continue;
    if (v !== null && typeof v !== "number" && typeof v !== "string") continue;
    if (lk.includes("prompt") && (lk.includes("sum") || lk.includes("sum()"))) pt = num(v);
    if (lk.includes("completion") && (lk.includes("sum") || lk.includes("sum()"))) ct = num(v);
    if (lk.includes("usd") && (lk.includes("sum") || lk.includes("sum()"))) usd = num(v);
  }

  return { pt, ct, usd };
}

/**
 * RPC `ao_usage_summary_aggregate` が未適用／PostgREST に未登録のときの代替。
 * PostgREST の列集計（sum）を使う（Egress は RPC より増えうるが、オーバーレイ用の少数行ではない）。
 */
export async function aoUsageSummaryFallbackAggregates(supa: SupabaseClient): Promise<{
  counts: { assistantTurnRows: number };
  windowDays: number;
  today?: Agg;
  month?: Agg;
  all?: Agg;
  byVendor: Record<string, { promptTokens: number; completionTokens: number; estimatedUsd: number }>;
  byModel: Record<string, { promptTokens: number; completionTokens: number; estimatedUsd: number }>;
}> {
  const db = supa as unknown as TypedAdmin;

  const { count: assistantTurnRows = 0, error: cErr } = await db
    .from("ao_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "assistant")
    .not("prompt_tokens", "is", null);
  if (cErr) throw cErr;

  const sumSel = "prompt_tokens.sum(),completion_tokens.sum(),usd_estimate.sum()";

  const { data: allRows, error: eAll } = await db
    .from("ao_messages")
    .select(sumSel)
    .eq("role", "assistant")
    .not("prompt_tokens", "is", null);
  if (eAll) throw eAll;
  const allAgg = pickSums((allRows?.[0] as Record<string, unknown>) ?? null);

  const day0 = utcDayStartIso();
  const { data: dayRows, error: eDay } = await db
    .from("ao_messages")
    .select(sumSel)
    .eq("role", "assistant")
    .not("prompt_tokens", "is", null)
    .gte("created_at", day0);
  if (eDay) throw eDay;
  const dayAgg = pickSums((dayRows?.[0] as Record<string, unknown>) ?? null);

  const mon0 = utcMonthStartIso();
  const { data: monRows, error: eMon } = await db
    .from("ao_messages")
    .select(sumSel)
    .eq("role", "assistant")
    .not("prompt_tokens", "is", null)
    .gte("created_at", mon0);
  if (eMon) throw eMon;
  const monAgg = pickSums((monRows?.[0] as Record<string, unknown>) ?? null);

  const t30 = thirtyDaysAgoIso();
  const { data: modelRows, error: eMod } = await db
    .from("ao_messages")
    .select(`model_id,${sumSel}`)
    .eq("role", "assistant")
    .not("prompt_tokens", "is", null)
    .gte("created_at", t30);
  if (eMod) throw eMod;

  const byModel: Record<string, { promptTokens: number; completionTokens: number; estimatedUsd: number }> = {};
  for (const raw of modelRows ?? []) {
    const row = raw as Record<string, unknown>;
    const mkRaw = row.model_id;
    const mk = typeof mkRaw === "string" && mkRaw.trim() ? mkRaw.trim() : "(model 不明)";
    const s = pickSums(row);
    byModel[mk] = {
      promptTokens: s.pt,
      completionTokens: s.ct,
      estimatedUsd: s.usd,
    };
  }

  const byVendor: Record<string, { promptTokens: number; completionTokens: number; estimatedUsd: number }> = {};
  for (const [modelId, v] of Object.entries(byModel)) {
    const vend = vendorPrefixFromModelId(modelId);
    if (!byVendor[vend]) byVendor[vend] = { promptTokens: 0, completionTokens: 0, estimatedUsd: 0 };
    byVendor[vend].promptTokens += v.promptTokens;
    byVendor[vend].completionTokens += v.completionTokens;
    byVendor[vend].estimatedUsd += v.estimatedUsd;
  }

  const toAgg = (s: { pt: number; ct: number; usd: number }): Agg => ({
    promptTokens: Math.max(0, Math.floor(s.pt)),
    completionTokens: Math.max(0, Math.floor(s.ct)),
    estimatedUsd: s.usd,
    totalTokens: Math.max(0, Math.floor(s.pt)) + Math.max(0, Math.floor(s.ct)),
  });

  return {
    counts: { assistantTurnRows: Math.max(0, assistantTurnRows ?? 0) },
    windowDays: 30,
    today: toAgg(dayAgg),
    month: toAgg(monAgg),
    all: toAgg(allAgg),
    byVendor,
    byModel,
  };
}
