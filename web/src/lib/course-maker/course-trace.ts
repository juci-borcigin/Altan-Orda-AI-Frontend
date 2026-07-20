import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateLlmCostUsd, imageGenerationUsdPerImage } from "./course-pricing";

export type CourseTracePhase =
  | "tier1_outline"
  | "tier2_section"
  | "tier2_image"
  | "chat"
  | "ui_display";

export type CourseTraceInput = {
  course_id: string;
  phase: CourseTracePhase;
  step_key: string;
  model_id?: string;
  provider?: string;
  system_prompt?: string;
  user_prompt?: string;
  response_text?: string;
  ui_display_ref?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  latency_ms?: number;
  cost_usd?: number | null;
  meta?: Record<string, unknown>;
};

export type CourseTraceRow = CourseTraceInput & {
  id: string;
  created_at: string;
};

export type CourseTraceSummary = {
  total_cost_usd: number;
  total_latency_ms: number;
  event_count: number;
  by_phase: Record<string, { cost_usd: number; latency_ms: number; count: number }>;
};

/** LLM / 画像 API 呼び出しのみ（ui_display は集計から除外） */
export const LLM_TRACE_PHASES: CourseTracePhase[] = [
  "tier1_outline",
  "tier2_section",
  "tier2_image",
  "chat",
];

export function isLlmTracePhase(phase: string): boolean {
  return (LLM_TRACE_PHASES as string[]).includes(phase);
}

export async function recordCourseTrace(
  supa: SupabaseClient | null,
  input: CourseTraceInput,
): Promise<CourseTraceRow | null> {
  // 管理者画面の処理ログ用。常時記録する
  if (!supa) return null;

  let cost = input.cost_usd;
  if (cost == null && input.phase !== "tier2_image") {
    cost = await estimateLlmCostUsd(
      input.prompt_tokens ?? 0,
      input.completion_tokens ?? 0,
      input.model_id ?? "",
    );
  }
  if (cost == null && input.phase === "tier2_image") {
    cost = imageGenerationUsdPerImage(input.model_id);
  }

  const row = {
    course_id: input.course_id,
    phase: input.phase,
    step_key: input.step_key,
    model_id: input.model_id ?? null,
    provider: input.provider ?? null,
    system_prompt: input.system_prompt ?? null,
    user_prompt: input.user_prompt ?? null,
    response_text: input.response_text ?? null,
    ui_display_ref: input.ui_display_ref ?? null,
    prompt_tokens: input.prompt_tokens ?? 0,
    completion_tokens: input.completion_tokens ?? 0,
    latency_ms: input.latency_ms ?? 0,
    cost_usd: cost,
    meta: input.meta ?? {},
  };

  const { data, error } = await supa.from("ao_course_trace_events").insert(row).select("*").single();
  if (error) {
    console.error("[course-trace]", error.message);
    return null;
  }
  return data as CourseTraceRow;
}

export async function listCourseTraces(
  supa: SupabaseClient,
  courseId: string,
  limit = 200,
): Promise<CourseTraceRow[]> {
  const { data, error } = await supa
    .from("ao_course_trace_events")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CourseTraceRow[];
}

/** 料金・時間サマリー用（巨大プロンプト本文を載せない） */
export async function listCourseTraceCosts(
  supa: SupabaseClient,
  courseId: string,
  limit = 500,
): Promise<
  Pick<CourseTraceRow, "phase" | "cost_usd" | "latency_ms" | "step_key" | "model_id" | "meta">[]
> {
  const { data, error } = await supa
    .from("ao_course_trace_events")
    .select("phase, cost_usd, latency_ms, step_key, model_id, meta")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<
    CourseTraceRow,
    "phase" | "cost_usd" | "latency_ms" | "step_key" | "model_id" | "meta"
  >[];
}

export function summarizeTraces(
  rows: Array<Pick<CourseTraceRow, "phase" | "cost_usd" | "latency_ms"> & Partial<CourseTraceRow>>,
  opts?: { llmOnly?: boolean },
): CourseTraceSummary {
  const filtered = opts?.llmOnly ? rows.filter((r) => isLlmTracePhase(r.phase)) : rows;
  const by_phase: CourseTraceSummary["by_phase"] = {};
  let total_cost_usd = 0;
  let total_latency_ms = 0;

  for (const r of filtered) {
    const cost = Number(r.cost_usd ?? 0);
    const lat = r.latency_ms ?? 0;
    total_cost_usd += cost;
    total_latency_ms += lat;
    const p = r.phase;
    if (!by_phase[p]) by_phase[p] = { cost_usd: 0, latency_ms: 0, count: 0 };
    by_phase[p].cost_usd += cost;
    by_phase[p].latency_ms += lat;
    by_phase[p].count += 1;
  }

  return {
    total_cost_usd: Math.round(total_cost_usd * 1e6) / 1e6,
    total_latency_ms,
    event_count: filtered.length,
    by_phase,
  };
}

export type ImagePatternCompareRow = {
  key: string;
  label: string;
  model_id: string;
  quality: string;
  image_count: number;
  image_cost_usd: number;
  image_latency_ms: number;
  /** 構成＋本文（＋チャット）＋この画像パターン */
  course_total_cost_usd: number;
  course_total_latency_ms: number;
  source: "trace" | "historical";
  highlighted?: boolean;
};

/** 旧 mini×low の実績（トレース削除後も比較用に残す） */
export const HISTORICAL_IMAGE_PATTERNS: Array<{
  model_id: string;
  quality: string;
  label: string;
  count: number;
  cost_usd: number;
  latency_ms: number;
}> = [
  {
    model_id: "gpt-image-1-mini",
    quality: "low",
    label: "① Image-1-mini · low ×30",
    count: 30,
    cost_usd: 0.18,
    latency_ms: 468_605,
  },
];

function imageQualityFromMeta(meta: unknown): string {
  if (meta && typeof meta === "object" && "quality" in meta) {
    const q = (meta as { quality?: unknown }).quality;
    if (typeof q === "string" && q.trim()) return q.trim().toLowerCase();
  }
  return "unknown";
}

function patternLabel(modelId: string, quality: string, count: number): string {
  const short = modelId.replace(/^gpt-/, "");
  return `${short} · ${quality} ×${count}`;
}

/**
 * 画像以外の課金と、画像パターン別の「その画像に差し替えた場合の講座合計」を算出。
 * 複数品質の画像トレースが共存しても合計を二重計上しない。
 */
export function buildImagePatternComparison(
  rows: Array<
    Pick<CourseTraceRow, "phase" | "cost_usd" | "latency_ms"> &
      Partial<Pick<CourseTraceRow, "model_id" | "meta">>
  >,
  opts?: { highlightQuality?: string; highlightModelIncludes?: string },
): {
  text_cost_usd: number;
  text_latency_ms: number;
  patterns: ImagePatternCompareRow[];
  mid_course_total: ImagePatternCompareRow | null;
} {
  let text_cost_usd = 0;
  let text_latency_ms = 0;
  const imageBuckets = new Map<
    string,
    { model_id: string; quality: string; count: number; cost: number; ms: number }
  >();

  for (const r of rows) {
    if (!isLlmTracePhase(r.phase)) continue;
    // 講師チャットは生成料金と合算しない
    if (r.phase === "chat") continue;
    const cost = Number(r.cost_usd ?? 0);
    const ms = r.latency_ms ?? 0;
    if (r.phase === "tier2_image") {
      const model_id = (r.model_id ?? "unknown").trim() || "unknown";
      const quality = imageQualityFromMeta(r.meta);
      const key = `${model_id}|${quality}`;
      const cur = imageBuckets.get(key) ?? {
        model_id,
        quality,
        count: 0,
        cost: 0,
        ms: 0,
      };
      cur.count += 1;
      cur.cost += cost;
      cur.ms += ms;
      imageBuckets.set(key, cur);
    } else {
      text_cost_usd += cost;
      text_latency_ms += ms;
    }
  }

  const patterns: ImagePatternCompareRow[] = [];

  for (const h of HISTORICAL_IMAGE_PATTERNS) {
    const key = `${h.model_id}|${h.quality}`;
    if (imageBuckets.has(key)) continue;
    patterns.push({
      key,
      label: h.label,
      model_id: h.model_id,
      quality: h.quality,
      image_count: h.count,
      image_cost_usd: Math.round(h.cost_usd * 1e6) / 1e6,
      image_latency_ms: h.latency_ms,
      course_total_cost_usd: Math.round((text_cost_usd + h.cost_usd) * 1e6) / 1e6,
      course_total_latency_ms: text_latency_ms + h.latency_ms,
      source: "historical",
    });
  }

  for (const [key, b] of imageBuckets) {
    patterns.push({
      key,
      label: patternLabel(b.model_id, b.quality, b.count),
      model_id: b.model_id,
      quality: b.quality,
      image_count: b.count,
      image_cost_usd: Math.round(b.cost * 1e6) / 1e6,
      image_latency_ms: b.ms,
      course_total_cost_usd: Math.round((text_cost_usd + b.cost) * 1e6) / 1e6,
      course_total_latency_ms: text_latency_ms + b.ms,
      source: "trace",
    });
  }

  const order = (p: ImagePatternCompareRow) => {
    if (p.model_id.includes("mini") && p.quality === "low") return 1;
    if (p.model_id.includes("gpt-image-2") && p.quality === "low") return 2;
    if (p.model_id.includes("gpt-image-2") && p.quality === "medium") return 3;
    return 9;
  };
  patterns.sort((a, b) => order(a) - order(b) || a.key.localeCompare(b.key));

  const hq = (opts?.highlightQuality ?? "medium").toLowerCase();
  const hm = opts?.highlightModelIncludes ?? "gpt-image-2";
  let mid_course_total: ImagePatternCompareRow | null = null;
  for (const p of patterns) {
    if (p.model_id.includes(hm) && p.quality === hq) {
      p.highlighted = true;
      mid_course_total = p;
    }
  }

  return {
    text_cost_usd: Math.round(text_cost_usd * 1e6) / 1e6,
    text_latency_ms,
    patterns,
    mid_course_total,
  };
}

export function filterTracesByPhase(rows: CourseTraceRow[], phase: CourseTracePhase): CourseTraceRow[] {
  return rows.filter((r) => r.phase === phase);
}
