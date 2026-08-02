import { extractJsonFromLlm } from "./course-master-schema";
import { estimateLlmCostUsd } from "./course-pricing";
import { applyCompletionBudgetToPayload } from "@/lib/llm/completion-payload";
import { completionHeaders } from "@/lib/llm/router";
import { resolveLlmRoute } from "@/lib/llm/resolve-route";
import {
  FOUNDATION_AUDIT_DEFAULTS,
  type AuditFinding,
  type AuditReport,
  type ContentDraft,
  type FoundationManifest,
  type FoundationStep,
} from "./course-foundation-schema";
import {
  estimateFoundationRun,
  writeFoundationManifest,
  emptyFoundationManifest,
} from "./course-foundation";

type LlmCall = {
  text: string;
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  cost_usd: number;
};

const LUNA = "openai/gpt-5.6-luna";
const TERRA = "openai/gpt-5.6-terra";

/** Tavily basic 検索の概算（USD / クエリ） */
const TAVILY_USD_PER_QUERY = 0.008;

async function foundationLlm(
  modelId: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<LlmCall> {
  const route = resolveLlmRoute(modelId);
  if (!route.apiKey) throw new Error("LLM API key is not set");

  const payload: Record<string, unknown> = {
    model: route.modelId,
    stream: false,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  const isOpenAiGpt56 =
    route.provider === "openai" &&
    route.modelId.trim().toLowerCase().startsWith("gpt-5.6");
  if (isOpenAiGpt56) {
    payload.reasoning_effort = "none";
  } else {
    payload.temperature = 0.3;
  }
  applyCompletionBudgetToPayload(payload, route, maxTokens);

  const started = Date.now();
  const res = await fetch(`${route.baseUrl}/chat/completions`, {
    method: "POST",
    headers: completionHeaders(route),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${raw.slice(0, 500)}`);
  const json = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("LLM returned empty content");
  const prompt_tokens = json.usage?.prompt_tokens ?? 0;
  const completion_tokens = json.usage?.completion_tokens ?? 0;
  return {
    text,
    model_id: modelId,
    prompt_tokens,
    completion_tokens,
    latency_ms: Date.now() - started,
    cost_usd: (await estimateLlmCostUsd(prompt_tokens, completion_tokens, modelId)) ?? 0,
  };
}

type TavilyHit = {
  query: string;
  answer: string;
  urls: string[];
  text: string;
  cost_usd: number;
};

async function tavilySearchOnce(query: string): Promise<TavilyHit> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) throw new Error("TAVILY_API_KEY is not configured");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Tavily ${res.status}: ${rawText.slice(0, 400)}`);
  }
  const data = JSON.parse(rawText) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  const urls = (data.results ?? [])
    .map((r) => r.url)
    .filter((u): u is string => Boolean(u?.trim()));
  const lines: string[] = [];
  if (data.answer?.trim()) lines.push(`要約: ${data.answer.trim()}`);
  for (const r of data.results ?? []) {
    const snip = (r.content ?? "").slice(0, 400).trim();
    lines.push(`${r.title ?? ""} — ${r.url ?? ""}\n${snip}`.trim());
  }
  return {
    query,
    answer: data.answer?.trim() ?? "",
    urls,
    text: lines.join("\n\n---\n\n") || "(検索結果なし)",
    cost_usd: TAVILY_USD_PER_QUERY,
  };
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function parseDraftJson(
  raw: unknown,
  opts: {
    status: "draft" | "locked";
    topic: string;
    learner_level: string;
    audience: string;
    call: LlmCall;
  },
): ContentDraft {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const key_terms_raw = Array.isArray(o.key_terms) ? o.key_terms : [];
  const key_terms = key_terms_raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const term = typeof r.term === "string" ? r.term : "";
      const gloss = typeof r.gloss === "string" ? r.gloss : "";
      if (!term) return null;
      return { term, gloss };
    })
    .filter((x): x is { term: string; gloss: string } => Boolean(x));

  const body =
    typeof o.body_markdown === "string" && o.body_markdown.trim()
      ? o.body_markdown.trim()
      : typeof o.body === "string"
        ? o.body.trim()
        : "";

  if (!body) throw new Error("ContentDraft: body_markdown が空です");

  return {
    schema_version: 1,
    status: opts.status,
    topic: opts.topic,
    learner_level: opts.learner_level,
    audience: opts.audience,
    body_markdown: body,
    learning_outcomes: asStringArray(o.learning_outcomes),
    out_of_scope: asStringArray(o.out_of_scope),
    key_terms,
    claims_to_verify: asStringArray(o.claims_to_verify),
    meta: {
      model_id: opts.call.model_id,
      cost_usd: opts.call.cost_usd,
      latency_ms: opts.call.latency_ms,
      created_at: new Date().toISOString(),
    },
  };
}

function parseAuditJson(
  raw: unknown,
  opts: {
    search_queries_used: number;
    search_budget: number;
    truncated: boolean;
    judge: LlmCall;
    search_cost_usd: number;
    reference_urls: string[];
  },
): AuditReport {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const findingsRaw = Array.isArray(o.findings) ? o.findings : [];
  const findings: AuditFinding[] = [];
  for (const row of findingsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const kind = r.kind;
    const severity = r.severity;
    if (
      kind !== "freshness" &&
      kind !== "fact_check" &&
      kind !== "gap" &&
      kind !== "risk"
    ) {
      continue;
    }
    if (severity !== "info" && severity !== "warn" && severity !== "critical") {
      continue;
    }
    findings.push({
      kind,
      severity,
      claim_or_gap: typeof r.claim_or_gap === "string" ? r.claim_or_gap : "",
      recommendation: typeof r.recommendation === "string" ? r.recommendation : "",
      urls: asStringArray(r.urls),
    });
  }

  return {
    schema_version: 1,
    search_queries_used: opts.search_queries_used,
    search_budget: opts.search_budget,
    truncated: opts.truncated,
    findings,
    revision_instructions: asStringArray(o.revision_instructions),
    reference_urls: [
      ...new Set([...opts.reference_urls, ...asStringArray(o.reference_urls)]),
    ],
    meta: {
      search_provider: "tavily",
      judge_model_id: opts.judge.model_id,
      cost_usd:
        Math.round((opts.judge.cost_usd + opts.search_cost_usd) * 1e6) / 1e6,
      latency_ms: opts.judge.latency_ms,
    },
  };
}

async function step1Draft(params: {
  theme: string;
  learner_level: string;
  audience: string;
  session_count: number;
  target_outcome: string;
}): Promise<ContentDraft> {
  const system = `あなたは講義の「知識ドラフト」執筆者です。回や受講画面のセクションにはまだ割りません。
講義全体で教える中身を、見出し階層つき Markdown でまとめてください（見出しは知識の目次であり、講義セクション数ではない）。
出力は JSON のみ（前後の説明禁止）。キー:
body_markdown, learning_outcomes (string[]), out_of_scope (string[]),
key_terms ({term,gloss}[]), claims_to_verify (string[] — 数値・固有名・時事など要確認点)`;

  const user = `題材: ${params.theme}
学習者レベル: ${params.learner_level}
受講者: ${params.audience}
予定回数: ${params.session_count}回（各回おおよそ5000字の記事）
到達目標: ${params.target_outcome}

社会人がゼロから理解できる範囲。数式は最小限。主張のうち後で検索確認したい点を claims_to_verify に列挙。`;

  const call = await foundationLlm(LUNA, system, user, 8000);
  const parsed = extractJsonFromLlm(call.text);
  return parseDraftJson(parsed, {
    status: "draft",
    topic: params.theme,
    learner_level: params.learner_level,
    audience: params.audience,
    call,
  });
}

async function step2Audit(draft: ContentDraft): Promise<{
  audit: AuditReport;
  searchHits: TavilyHit[];
}> {
  const budget = FOUNDATION_AUDIT_DEFAULTS.search_query_budget;
  const freshnessBudget = FOUNDATION_AUDIT_DEFAULTS.freshness_query_budget;
  const fcBudget = Math.max(0, budget - freshnessBudget);

  const planSystem = `講義ドラフトの監査用検索クエリを計画する。JSONのみ。
キー: freshness_queries (string[], 最大${freshnessBudget}),
fact_check_queries (string[], 最大${fcBudget})。
日本語クエリ。最新動向と、ドラフトの数値・固有名・論争点の確認に絞る。`;

  const planUser = `題材: ${draft.topic}
claims_to_verify:
${draft.claims_to_verify.map((c) => `- ${c}`).join("\n") || "（なし）"}

ドラフト抜粋:
${draft.body_markdown.slice(0, 6000)}`;

  const planCall = await foundationLlm(TERRA, planSystem, planUser, 2000);
  const planRaw = extractJsonFromLlm(planCall.text) as Record<string, unknown>;
  const freshness = asStringArray(planRaw.freshness_queries).slice(0, freshnessBudget);
  const factCheck = asStringArray(planRaw.fact_check_queries).slice(0, fcBudget);
  const queries = [...freshness, ...factCheck].slice(0, budget);

  const searchHits: TavilyHit[] = [];
  let searchCost = planCall.cost_usd;
  let truncated = false;

  for (const q of queries) {
    if (searchCost + planCall.cost_usd > FOUNDATION_AUDIT_DEFAULTS.budget_usd_cap) {
      // 判定前にキャップ超えそうなら検索打ち切り
      truncated = true;
      break;
    }
    if (
      searchCost + TAVILY_USD_PER_QUERY >
      FOUNDATION_AUDIT_DEFAULTS.budget_usd_cap
    ) {
      truncated = true;
      break;
    }
    const hit = await tavilySearchOnce(q);
    searchHits.push(hit);
    searchCost += hit.cost_usd;
  }

  const searchBlock = searchHits
    .map((h, i) => `### 検索${i + 1}: ${h.query}\n${h.text}`)
    .join("\n\n");

  const judgeSystem = `あなたは講義ドラフトの監査官です。要点のみ（全主張の網羅は不要）。
JSONのみ。キー:
findings: [{kind: freshness|fact_check|gap|risk, severity: info|warn|critical,
  claim_or_gap, recommendation, urls: string[]}],
revision_instructions: string[],
reference_urls: string[]`;

  const judgeUser = `ドラフト:
${draft.body_markdown}

検索結果:
${searchBlock || "（検索なし）"}

数値・固有名・時事・論争点とギャップに集中し、改訂指示を具体的に。`;

  const judge = await foundationLlm(TERRA, judgeSystem, judgeUser, 6000);
  const tavilyCost = searchHits.reduce((s, h) => s + h.cost_usd, 0);
  const auditCost =
    Math.round((planCall.cost_usd + tavilyCost + judge.cost_usd) * 1e6) / 1e6;
  if (auditCost > FOUNDATION_AUDIT_DEFAULTS.budget_usd_cap) truncated = true;

  const audit = parseAuditJson(extractJsonFromLlm(judge.text), {
    search_queries_used: searchHits.length,
    search_budget: budget,
    truncated,
    judge,
    search_cost_usd: Math.round((tavilyCost + planCall.cost_usd) * 1e6) / 1e6,
    reference_urls: searchHits.flatMap((h) => h.urls),
  });
  audit.meta.cost_usd = auditCost;

  return { audit, searchHits };
}

async function step3Lock(
  draft: ContentDraft,
  audit: AuditReport,
): Promise<ContentDraft> {
  const system = `あなたは講義知識ドラフトの確定編集者です。監査指示を反映し、status=locked の確定稿にする。
回割はしない。JSONのみ。キーはドラフトと同じ:
body_markdown, learning_outcomes, out_of_scope, key_terms, claims_to_verify`;

  const user = `元ドラフト:
${draft.body_markdown}

学習目標: ${JSON.stringify(draft.learning_outcomes)}
スコープ外: ${JSON.stringify(draft.out_of_scope)}

監査 findings:
${JSON.stringify(audit.findings, null, 2)}

改訂指示:
${audit.revision_instructions.map((x) => `- ${x}`).join("\n")}

誤りの修正・不足の補完・危険な断定の緩和を行い、確定稿を出力。`;

  const call = await foundationLlm(TERRA, system, user, 8000);
  return parseDraftJson(extractJsonFromLlm(call.text), {
    status: "locked",
    topic: draft.topic,
    learner_level: draft.learner_level,
    audience: draft.audience,
    call,
  });
}

export type FoundationRunParams = {
  through_step: FoundationStep;
  theme: string;
  course_id?: string | null;
  session_count?: number;
  session_duration_min?: number;
  learner_level?: string;
  audience?: string;
  target_outcome?: string;
};

/**
 * through_step≤3 の課金実行。4以上は未実装（呼び出し側で弾く）。
 */
export async function runFoundationThrough3(
  opts: FoundationRunParams,
): Promise<FoundationManifest> {
  if (opts.through_step > 3) {
    throw new Error("このランナーは through_step≤3 のみ対応です");
  }

  // OpenAI 直結を優先（クォータ復旧後）。失敗時は呼び出し側で OpenRouter を検討。
  const prevForce = process.env.AO_LLM_FORCE_OPENROUTER;
  // 既定では強制しない。AO_COURSE_FOUNDATION_FORCE_OPENROUTER=1 のときのみ OR 固定。
  const forceOr =
    (process.env.AO_COURSE_FOUNDATION_FORCE_OPENROUTER ?? "").trim() === "1";
  if (forceOr) process.env.AO_LLM_FORCE_OPENROUTER = "1";
  else if (prevForce === undefined) {
    /* keep unset */
  }

  const estimate = estimateFoundationRun({
    through_step: opts.through_step,
    session_count: opts.session_count,
  });

  const theme = opts.theme.trim() || "量子力学入門";
  let spent = 0;
  const manifest = emptyFoundationManifest({
    course_id: opts.course_id ?? null,
    theme,
    through_step: opts.through_step,
    status: "running",
    estimate,
    spent_usd: 0,
    artifacts: {},
    notes: forceOr
      ? "through_step≤3 実行中（OpenRouter 強制）"
      : "through_step≤3 実行中",
  });
  await writeFoundationManifest(manifest);

  try {
    if (opts.through_step >= 1) {
      const draft = await step1Draft({
        theme,
        learner_level: opts.learner_level ?? "zero",
        audience: opts.audience ?? "working_adult",
        session_count: opts.session_count ?? 5,
        target_outcome:
          opts.target_outcome ??
          "量子力学の基本イメージを日常の言葉で説明できる",
      });
      spent += draft.meta.cost_usd;
      manifest.artifacts.draft = draft;
      manifest.spent_usd = Math.round(spent * 1e6) / 1e6;
      await writeFoundationManifest(manifest);
    }

    if (opts.through_step >= 2 && manifest.artifacts.draft) {
      const { audit } = await step2Audit(manifest.artifacts.draft);
      spent += audit.meta.cost_usd;
      manifest.artifacts.audit = audit;
      manifest.spent_usd = Math.round(spent * 1e6) / 1e6;
      if (audit.truncated) manifest.status = "stopped_at_cap";
      await writeFoundationManifest(manifest);
    }

    if (opts.through_step >= 3 && manifest.artifacts.draft && manifest.artifacts.audit) {
      const locked = await step3Lock(
        manifest.artifacts.draft,
        manifest.artifacts.audit,
      );
      spent += locked.meta.cost_usd;
      manifest.artifacts.locked = locked;
      manifest.spent_usd = Math.round(spent * 1e6) / 1e6;
      await writeFoundationManifest(manifest);
    }

    if (manifest.status === "running") {
      manifest.status = "completed";
    }
    manifest.notes =
      manifest.status === "stopped_at_cap"
        ? "監査が予算/クエリ上限で途中打ち切り。取得分で確定まで完了。"
        : "through_step≤3 完了。ステップ4・5は未実行。";
    await writeFoundationManifest(manifest);
    return manifest;
  } catch (e) {
    manifest.status = "error";
    manifest.error = e instanceof Error ? e.message : String(e);
    manifest.spent_usd = Math.round(spent * 1e6) / 1e6;
    manifest.notes = "実行中にエラー。部分成果は artifacts に残る場合あり。";
    await writeFoundationManifest(manifest);
    throw e;
  } finally {
    if (forceOr) {
      if (prevForce === undefined) delete process.env.AO_LLM_FORCE_OPENROUTER;
      else process.env.AO_LLM_FORCE_OPENROUTER = prevForce;
    }
  }
}

/**
 * 既存の locked（と任意の course_master）からステップ4・5を続行。
 * 失敗した回のみ再生成可能。本文の厳格文字数ゲートは PoC では緩め、length_pass を記録する。
 */
export async function runFoundationContinue45(opts: {
  theme?: string;
  course_id?: string | null;
  session_count?: number;
  session_duration_min?: number;
  learner_level?: string;
  audience?: string;
  target_outcome?: string;
  /** 指定時はその回だけ再生成。未指定なら error / 欠落のみ */
  only_sessions?: number[];
  regenerate_outline?: boolean;
}): Promise<FoundationManifest> {
  const { generateCourseMaster, generateSessionContent } = await import(
    "./course-llm"
  );
  const { estimateLlmCostUsd } = await import("./course-pricing");
  const { readFoundationManifest } = await import("./course-foundation");
  type CourseMaster = import("./course-master-schema").CourseMaster;
  type CourseParams = import("./course-master-schema").CourseParams;

  const existing = await readFoundationManifest();
  if (!existing?.artifacts?.locked?.body_markdown) {
    throw new Error("locked ドラフトがありません。先に through_step≤3 を完了してください");
  }

  const forceOr =
    (process.env.AO_COURSE_FOUNDATION_FORCE_OPENROUTER ?? "").trim() === "1";
  const prevForce = process.env.AO_LLM_FORCE_OPENROUTER;
  if (forceOr) process.env.AO_LLM_FORCE_OPENROUTER = "1";

  const theme = opts.theme?.trim() || existing.theme || "量子力学入門";
  const sessionCount = Math.max(5, Math.min(10, opts.session_count ?? 5));
  const estimate = estimateFoundationRun({
    through_step: 5,
    session_count: sessionCount,
  });

  const manifest: FoundationManifest = {
    ...existing,
    theme,
    through_step: 5,
    status: "running",
    estimate,
    notes: "ステップ4・5 続行中",
    error: undefined,
  };
  let spent = existing.spent_usd ?? 0;
  await writeFoundationManifest(manifest);

  try {
    let master = manifest.artifacts.course_master as CourseMaster | undefined;
    if (!master || opts.regenerate_outline) {
      const { coerceAudience, FIXED_MATH_LEVEL } = await import(
        "./course-master-schema"
      );
      const params: CourseParams = {
        theme,
        audience: coerceAudience(opts.audience),
        math_level: FIXED_MATH_LEVEL,
        target_outcome:
          opts.target_outcome ??
          "量子力学の基本イメージを日常の言葉で説明できる",
        session_count: sessionCount,
      };
      const outline = await generateCourseMaster(params, undefined, {
        model_id: "openai/gpt-5.6-terra",
        content_locked_markdown: existing.artifacts.locked.body_markdown,
        max_attempts: 2,
      });
      for (const call of outline.llm_calls) {
        spent += await estimateLlmCostUsd(
          call.prompt_tokens,
          call.completion_tokens,
          call.model_id,
        ) ?? 0;
      }
      master = outline.master;
      manifest.artifacts.course_master = master;
      manifest.artifacts.verification = outline.verification;
      manifest.spent_usd = Math.round(spent * 1e6) / 1e6;
      await writeFoundationManifest(manifest);
    }

    if (!master) throw new Error("course_master がありません");

    const target = master.meta.target_chars_per_session;
    const prevSessions = [...(manifest.artifacts.sessions ?? [])];
    const byNo = new Map(prevSessions.map((s) => [s.session_no, s]));

    const want = opts.only_sessions?.length
      ? opts.only_sessions
      : master.sessions.map((s) => s.session_no);

    for (const sessionNo of want) {
      const prev = byNo.get(sessionNo);
      if (
        !opts.only_sessions &&
        prev?.status === "done" &&
        (prev.pages?.length ?? 0) > 0
      ) {
        continue;
      }
      const sessionMeta = master.sessions.find((s) => s.session_no === sessionNo);
      try {
        const result = await generateSessionContent({
          master,
          session_no: sessionNo,
          enforce_length: false,
          allow_fallback: true,
        });
        let cost = 0;
        for (const call of result.llm_calls) {
          cost += await estimateLlmCostUsd(
            call.prompt_tokens,
            call.completion_tokens,
            call.model_id,
          ) ?? 0;
        }
        spent += cost;
        const bodyChars = result.pages.reduce(
          (n, p) => n + (p.markdown?.replace(/\s+/g, "").length ?? 0),
          0,
        );
        // ざっくり: 空白込みでも比較しやすいよう trim 後の文字数も
        const bodyCharsLoose = result.pages.reduce(
          (n, p) => n + (p.markdown?.length ?? 0),
          0,
        );
        const ratio = bodyCharsLoose / Math.max(target, 1);
        const length_pass = ratio >= 0.85 && ratio <= 1.15;
        byNo.set(sessionNo, {
          session_no: sessionNo,
          title: sessionMeta?.title,
          status: "done",
          model_id: result.model_id,
          fallback_used: result.fallback_used,
          body_chars: bodyCharsLoose,
          target_chars: target,
          length_pass,
          cost_usd: Math.round(cost * 1e6) / 1e6,
          pages: result.pages.map((p) => ({
            section_no: p.section_no,
            heading: p.markdown.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? `セクション${p.section_no}`,
            markdown: p.markdown,
            image_prompt: p.image_prompt,
          })),
        });
      } catch (e) {
        byNo.set(sessionNo, {
          session_no: sessionNo,
          title: sessionMeta?.title,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
          target_chars: target,
        });
      }
      manifest.artifacts.sessions = [...byNo.values()].sort(
        (a, b) => a.session_no - b.session_no,
      );
      manifest.spent_usd = Math.round(spent * 1e6) / 1e6;
      await writeFoundationManifest(manifest);
    }

    const allDone = (manifest.artifacts.sessions ?? []).every(
      (s) => s.status === "done",
    );
    manifest.status = allDone ? "completed" : "error";
    manifest.notes = allDone
      ? "through_step=5 完了（画像生成は含まない。文字数は soft 記録）。"
      : "ステップ5に失敗した回あり。artifacts.sessions を確認。";
    await writeFoundationManifest(manifest);
    return manifest;
  } catch (e) {
    manifest.status = "error";
    manifest.error = e instanceof Error ? e.message : String(e);
    manifest.spent_usd = Math.round(spent * 1e6) / 1e6;
    await writeFoundationManifest(manifest);
    throw e;
  } finally {
    if (forceOr) {
      if (prevForce === undefined) delete process.env.AO_LLM_FORCE_OPENROUTER;
      else process.env.AO_LLM_FORCE_OPENROUTER = prevForce;
    }
  }
}
