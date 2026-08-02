/**
 * 講義構成フェーズ拡張（知識ドラフト → 監査 → 確定 → 構成 → 本文）の型。
 * 課金呼び出しは course-foundation.ts / API 経由。骨格のみでは LLM/Tavily を叩かない。
 */

export type FoundationStep = 1 | 2 | 3 | 4 | 5;

export type ContentDraftStatus = "draft" | "locked";

export type ContentDraft = {
  schema_version: 1;
  status: ContentDraftStatus;
  topic: string;
  learner_level: string;
  audience: string;
  /** 講義全体の教える中身（回割前）。見出し階層つき Markdown */
  body_markdown: string;
  learning_outcomes: string[];
  out_of_scope: string[];
  key_terms: { term: string; gloss: string }[];
  /** 監査対象の要確認ポイント（空でも可） */
  claims_to_verify: string[];
  meta: {
    model_id: string;
    cost_usd: number;
    latency_ms: number;
    created_at: string;
  };
};

export type AuditFindingKind = "freshness" | "fact_check" | "gap" | "risk";

export type AuditFinding = {
  kind: AuditFindingKind;
  severity: "info" | "warn" | "critical";
  claim_or_gap: string;
  recommendation: string;
  urls: string[];
};

export type AuditReport = {
  schema_version: 1;
  search_queries_used: number;
  search_budget: number;
  truncated: boolean;
  findings: AuditFinding[];
  revision_instructions: string[];
  /** 講義末尾用の参考 URL（インライン出典はしない） */
  reference_urls: string[];
  meta: {
    search_provider: "tavily" | "none";
    judge_model_id: string;
    cost_usd: number;
    latency_ms: number;
  };
};

/** PoC 監査上限（設計既定） */
export const FOUNDATION_AUDIT_DEFAULTS = {
  search_query_budget: 8,
  freshness_query_budget: 3,
  judge_llm_calls: 1,
  budget_usd_cap: 0.5,
} as const;

export type FoundationRunStatus =
  | "idle"
  | "estimated"
  | "running"
  | "completed"
  | "stopped_at_cap"
  | "error";

export type FoundationEstimate = {
  through_step: FoundationStep;
  /** 呼び出し内訳の説明 */
  calls: Array<{
    step: FoundationStep;
    label: string;
    model_or_tool: string;
    count: number;
    approx_usd: number;
  }>;
  approx_usd_total: number;
  approx_minutes: number;
  notes: string[];
};

export type FoundationArtifacts = {
  draft?: ContentDraft;
  audit?: AuditReport;
  locked?: ContentDraft;
  /** ステップ4: 既存 CourseMaster JSON */
  course_master?: unknown;
  verification?: unknown;
  /** ステップ5: 回ごとの本文結果 */
  sessions?: Array<{
    session_no: number;
    title?: string;
    status: "pending" | "done" | "error" | "skipped";
    model_id?: string;
    fallback_used?: boolean;
    body_chars?: number;
    target_chars?: number;
    length_pass?: boolean;
    cost_usd?: number;
    error?: string;
    pages?: Array<{
      section_no: number;
      heading: string;
      markdown: string;
      image_prompt: string | null;
    }>;
  }>;
};

export type FoundationManifest = {
  schema_version: 1;
  updated_at: string;
  course_id: string | null;
  theme: string;
  through_step: FoundationStep;
  status: FoundationRunStatus;
  estimate: FoundationEstimate | null;
  spent_usd: number;
  artifacts: FoundationArtifacts;
  error?: string;
  notes: string;
};

export function emptyFoundationManifest(
  partial?: Partial<FoundationManifest>,
): FoundationManifest {
  return {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    course_id: null,
    theme: "",
    through_step: 3,
    status: "idle",
    estimate: null,
    spent_usd: 0,
    artifacts: {},
    notes:
      "構成フェーズ拡張 PoC。課金実行は estimate 確認後・明示許可後のみ。",
    ...partial,
  };
}
