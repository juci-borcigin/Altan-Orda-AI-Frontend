import fs from "fs/promises";
import path from "path";
import {
  emptyFoundationManifest,
  FOUNDATION_AUDIT_DEFAULTS,
  type FoundationEstimate,
  type FoundationManifest,
  type FoundationStep,
} from "./course-foundation-schema";

const PUBLIC_REL = path.join("sample", "course-foundation-poc");

export function foundationPocPublicDir(): string {
  return path.join(process.cwd(), "public", PUBLIC_REL);
}

export function foundationManifestPath(): string {
  return path.join(foundationPocPublicDir(), "manifest.json");
}

export async function readFoundationManifest(): Promise<FoundationManifest | null> {
  try {
    const raw = await fs.readFile(foundationManifestPath(), "utf8");
    return JSON.parse(raw) as FoundationManifest;
  } catch {
    return null;
  }
}

export async function writeFoundationManifest(
  manifest: FoundationManifest,
): Promise<void> {
  await fs.mkdir(foundationPocPublicDir(), { recursive: true });
  const next = { ...manifest, updated_at: new Date().toISOString() };
  await fs.writeFile(
    foundationManifestPath(),
    JSON.stringify(next, null, 2),
    "utf8",
  );
}

/**
 * 課金なし見積もり。
 * through_step=3: 新規の知識確定のみ（安い検証）
 * through_step=5: 構成＋全回本文まで（画像は含まない。画像は別見積もり）
 */
export function estimateFoundationRun(opts: {
  through_step: FoundationStep;
  session_count?: number;
}): FoundationEstimate {
  const sessions = Math.max(1, Math.min(20, opts.session_count ?? 5));
  const calls: FoundationEstimate["calls"] = [
    {
      step: 1,
      label: "コンテンツ・ドラフト（講座全体）",
      model_or_tool: "openai/gpt-5.6-luna",
      count: 1,
      approx_usd: 0.04,
    },
    {
      step: 2,
      label: `監査（Tavily≤${FOUNDATION_AUDIT_DEFAULTS.search_query_budget} + Terra判定）`,
      model_or_tool: "tavily + openai/gpt-5.6-terra",
      count: 1 + FOUNDATION_AUDIT_DEFAULTS.search_query_budget,
      approx_usd: 0.12,
    },
    {
      step: 3,
      label: "ドラフト改訂・確定",
      model_or_tool: "openai/gpt-5.6-terra",
      count: 1,
      approx_usd: 0.08,
    },
  ];

  const notes: string[] = [
    "概算。実トークン長・検索ヒット数で前後する。",
    `監査はクエリ上限 ${FOUNDATION_AUDIT_DEFAULTS.search_query_budget}・USD キャップ約 $${FOUNDATION_AUDIT_DEFAULTS.budget_usd_cap}。`,
  ];

  if (opts.through_step >= 4) {
    calls.push({
      step: 4,
      label: "講座構成（CourseMaster）",
      model_or_tool: "openai/gpt-5.6-terra",
      count: 1,
      approx_usd: 0.12,
    });
    notes.push("ステップ4は既存 generateCourseMaster に content_locked を注入する想定。");
  }

  if (opts.through_step >= 5) {
    calls.push({
      step: 5,
      label: `全${sessions}回の本文＋画像プロンプト`,
      model_or_tool: "openai/gpt-5.6-luna (+ terra fallback)",
      count: sessions,
      approx_usd: Math.round(sessions * 0.02 * 100) / 100,
    });
    notes.push(
      "ステップ5に画像生成（Image2 Low）は含めていない。画像は枚数×単価で別見積もり。",
    );
  }

  const filtered = calls.filter((c) => c.step <= opts.through_step);
  const approx_usd_total =
    Math.round(filtered.reduce((s, c) => s + c.approx_usd, 0) * 100) / 100;
  const approx_minutes =
    opts.through_step <= 3 ? 3 : opts.through_step === 4 ? 5 : 5 + sessions * 0.5;

  return {
    through_step: opts.through_step,
    calls: filtered,
    approx_usd_total,
    approx_minutes: Math.round(approx_minutes * 10) / 10,
    notes,
  };
}

/**
 * 実行スタブ。課金パスは未配線。
 * 許可後の実装で step ごとに LLM/Tavily を呼ぶ。
 */
export async function runFoundationPipelineStub(opts: {
  through_step: FoundationStep;
  theme: string;
  course_id?: string | null;
  session_count?: number;
  /** true のときのみ「実行」とみなすが、現状は常に未実装エラー */
  execute?: boolean;
}): Promise<FoundationManifest> {
  const estimate = estimateFoundationRun({
    through_step: opts.through_step,
    session_count: opts.session_count,
  });

  if (!opts.execute) {
    const manifest = emptyFoundationManifest({
      course_id: opts.course_id ?? null,
      theme: opts.theme,
      through_step: opts.through_step,
      status: "estimated",
      estimate,
      notes:
        "見積もりのみ。execute=true かつ殿下が範囲許可したのち、実装済みランナーで課金実行する。",
    });
    await writeFoundationManifest(manifest);
    return manifest;
  }

  const manifest = emptyFoundationManifest({
    course_id: opts.course_id ?? null,
    theme: opts.theme,
    through_step: opts.through_step,
    status: "error",
    estimate,
    error:
      "課金ランナー未実装。型・見積もり・マニフェスト保存のみ。実装後に再実行すること。",
    notes: "骨格フェーズ: LLM/Tavily は呼び出していない。",
  });
  await writeFoundationManifest(manifest);
  return manifest;
}
