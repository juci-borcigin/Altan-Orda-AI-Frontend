import { NextResponse } from "next/server";
import { vendorPrefixFromModelId } from "@/lib/ao-usage-estimate";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  usd_estimate: string | number | null;
  model_id: string | null;
  created_at: string;
};

function sumBucket(rows: Row[], startMs: number): {
  promptTokens: number;
  completionTokens: number;
  estimatedUsd: number;
} {
  let promptTokens = 0;
  let completionTokens = 0;
  let estimatedUsd = 0;
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (Number.isNaN(t) || t < startMs) continue;
    promptTokens += typeof r.prompt_tokens === "number" ? r.prompt_tokens : 0;
    completionTokens += typeof r.completion_tokens === "number" ? r.completion_tokens : 0;
    const u = r.usd_estimate;
    if (u != null) estimatedUsd += typeof u === "number" ? u : Number(u) || 0;
  }
  return { promptTokens, completionTokens, estimatedUsd };
}

/** POST /api/chat で記録された assistant 行（prompt_tokens あり＝1応答の代表行）のみ集計 */
export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase が未設定です。" }, { status: 503 });
  }

  const { data, error } = await supa
    .from("messages")
    .select("prompt_tokens, completion_tokens, usd_estimate, model_id, created_at")
    .eq("role", "assistant")
    .not("prompt_tokens", "is", null);

  if (error) {
    console.error("[usage/summary]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const today = sumBucket(rows, startToday);
  const month = sumBucket(rows, startMonth);
  const all = sumBucket(rows, 0);

  type Agg = { promptTokens: number; completionTokens: number; estimatedUsd: number };
  const byVendor: Record<string, Agg> = {};
  const byModel: Record<string, Agg> = {};

  for (const r of rows) {
    const mid = (r.model_id ?? "").trim() || "(model 不明)";
    const vend = vendorPrefixFromModelId(mid);
    const pt = typeof r.prompt_tokens === "number" ? r.prompt_tokens : 0;
    const ct = typeof r.completion_tokens === "number" ? r.completion_tokens : 0;
    const u = r.usd_estimate;
    const usd = u != null ? (typeof u === "number" ? u : Number(u) || 0) : 0;

    const bump = (m: Record<string, Agg>, key: string) => {
      if (!m[key]) m[key] = { promptTokens: 0, completionTokens: 0, estimatedUsd: 0 };
      m[key].promptTokens += pt;
      m[key].completionTokens += ct;
      m[key].estimatedUsd += usd;
    };
    bump(byVendor, vend);
    bump(byModel, mid);
  }

  return NextResponse.json({
    counts: { assistantTurnRows: rows.length },
    today: { ...today, totalTokens: today.promptTokens + today.completionTokens },
    month: { ...month, totalTokens: month.promptTokens + month.completionTokens },
    all: { ...all, totalTokens: all.promptTokens + all.completionTokens },
    byVendor,
    byModel,
  });
}
