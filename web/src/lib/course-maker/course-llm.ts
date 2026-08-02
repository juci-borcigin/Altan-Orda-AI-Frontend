import {
  audienceLabel,
  CHARS_PER_SESSION,
  extractJsonFromLlm,
  MAX_SECTIONS_PER_SESSION,
  mathLevelGuide,
  mathLevelLabel,
  MIN_SECTIONS_PER_SESSION,
  parseCourseMaster,
  PREFERRED_CONTENT_SECTIONS,
  PREFERRED_SECTION_CHARS,
  type CourseMaster,
  type CourseParams,
} from "./course-master-schema";
import { applyCompletionBudgetToPayload } from "@/lib/llm/completion-payload";
import { verifyCourseMaster, type VerificationResult } from "./verify-course-master";
import { completionHeaders } from "@/lib/llm/router";
import { hasAnyLlmCredential, resolveLlmRoute } from "@/lib/llm/resolve-route";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordCourseTrace } from "./course-trace";

export type LlmCallResult = {
  text: string;
  model_id: string;
  provider: string;
  system: string;
  user: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
};

export type LlmTraceCtx = {
  course_id: string;
  supa: SupabaseClient | null;
  phase: "tier1_outline" | "tier2_section";
  step_key: string;
};

function isMockMode(): boolean {
  const v = (process.env.AO_MOCK_LLM ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function resolveOutlineModelId(): string {
  return (
    process.env.AO_COURSE_OUTLINE_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    "openai/gpt-5.6-terra"
  );
}

function resolveSessionModelId(): string {
  return (
    process.env.AO_COURSE_SESSION_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    "openai/gpt-5.6-luna"
  );
}

async function llmCompletion(
  modelId: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<LlmCallResult> {
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
    route.provider === "openai" && route.modelId.trim().toLowerCase().startsWith("gpt-5.6");
  if (isOpenAiGpt56) {
    // GPT-5.6 は temperature=0.3 を拒否する。文章比較では非推論設定に揃える。
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
    signal: AbortSignal.timeout(180_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${raw.slice(0, 400)}`);
  const json = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("LLM returned empty content");
  return {
    text,
    model_id: modelId,
    provider: route.provider,
    system,
    user,
    prompt_tokens: json.usage?.prompt_tokens ?? 0,
    completion_tokens: json.usage?.completion_tokens ?? 0,
    latency_ms: Date.now() - started,
  };
}

async function traceLlmCall(ctx: LlmTraceCtx | undefined, call: LlmCallResult, meta?: Record<string, unknown>) {
  if (!ctx) return;
  await recordCourseTrace(ctx.supa, {
    course_id: ctx.course_id,
    phase: ctx.phase,
    step_key: ctx.step_key,
    model_id: call.model_id,
    provider: call.provider,
    system_prompt: call.system,
    user_prompt: call.user,
    response_text: call.text,
    prompt_tokens: call.prompt_tokens,
    completion_tokens: call.completion_tokens,
    latency_ms: call.latency_ms,
    meta,
  });
}

function mockCourseMaster(params: CourseParams): CourseMaster {
  const target = CHARS_PER_SESSION;
  const contentCount = PREFERRED_CONTENT_SECTIONS;
  const sectionCount = contentCount + 2;
  const sectionChars = Math.round(target / sectionCount);
  const sessions = Array.from({ length: params.session_count }, (_, i) => {
    const n = i + 1;
    return {
      session_no: n,
      title: `${params.theme} — 第${n}回`,
      objectives: [`${params.theme}について説明できる`, "前提を確認できる"],
      keywords: [params.theme, `キーワード${n}`],
      continuity_in: n === 1 ? "前提知識なしから開始" : `第${n - 1}回までの内容を踏まえる`,
      continuity_out: `第${n}回の到達点を説明できる`,
      foreshadow_ids: n === 1 ? ["fs_main"] : [],
      payoff_ids: n === params.session_count ? ["fs_main"] : [],
      hero_image_prompt: `Educational 16:9 hero for ${params.theme} session ${n}, cinematic educational still`,
      visual_slots: [] as CourseMaster["sessions"][number]["visual_slots"],
      sections: Array.from({ length: sectionCount }, (_, si) => {
        const role = si === 0 ? "intro" : si === sectionCount - 1 ? "outro" : "content";
        return {
          section_no: si + 1,
          role: role as "intro" | "content" | "outro",
          heading:
            role === "intro"
              ? "はじめに"
              : role === "outro"
                ? "まとめ"
                : `セクション${si}`,
          intent:
            role === "intro"
              ? n === 1
                ? "講義全体の位置づけと今回の目標"
                : "前回のまとめと今回の目標"
              : role === "outro"
                ? "今回のまとめ"
                : `${params.theme}の部分テーマ${si}`,
          target_chars: sectionChars,
          image_search_query:
            role === "content" ? `${params.theme} ${si}` : undefined,
          image_source: "none" as const,
        };
      }),
      source_refs: [],
    };
  });

  return {
    schema_version: 1,
    meta: { ...params, target_chars_per_session: target },
    common: {
      narrative_arc: `${params.theme}を${params.session_count}回で学ぶ`,
      tone: "単一講師・落ち着いた説明",
      prerequisites_stated: [],
      glossary: [],
    },
    sources: { locked: false, items: [] },
    foreshadow_registry: [
      {
        id: "fs_main",
        introduced_session: 1,
        resolved_session: params.session_count,
        description: `${params.theme}の核心`,
      },
    ],
    sessions,
  };
}

const OUTLINE_SYSTEM = `あなたは講義設計者です。出力は JSON のみ（説明文・markdown不要）。
schema_version は必ず 1。
sessions は配列。各要素に session_no（1始まりの整数）, title, objectives, keywords,
continuity_in, continuity_out, foreshadow_ids, payoff_ids, hero_image_prompt, sections, source_refs を含める。
visual_slots は空配列 [] でよい（Format v2 では使わない）。

【フォーマット — Web／ブログ型記事】
1回＝1本の縦読み記事。紙芝居・1コマ1画像ではない。
sections は受講画面の記事見出しブロック（Intro + 中身 + Outro）。
知識ドラフトの Markdown 見出しを1:1でセクション化しない。

【セクション数】
各回 ${MIN_SECTIONS_PER_SESSION}〜${MAX_SECTIONS_PER_SESSION} 個（Intro1 + 中身およそ${PREFERRED_CONTENT_SECTIONS}±1 + Outro1）。
中身だけ8個は多すぎ。総セクションも ${MAX_SECTIONS_PER_SESSION} を超えない。
最初は role="intro"、heading="はじめに"。最後は role="outro"、heading="まとめ"。間は role="content"。

【文字数】
1回の目標は常に ${CHARS_PER_SESSION} 字（Intro+中身+Outro合計）。
各 section に target_chars。合計を ${CHARS_PER_SESSION} の±10%に。
セクションあたり目安 roughly ${PREFERRED_SECTION_CHARS} 字。

【画像まわり（構成段階）】
- hero_image_prompt: その回のメイン画像用（英語主体1段落・16:9・シネマ調 educational）。各回必須。
- content セクションのみ image_search_query（英語または日本語の短い Wikimedia 検索語）。intro/outro には付けない。
- セクション画像は生成しない（検索取得）。visual_slots は不要。

各 section に role, heading, intent（日本語1〜2文）, target_chars を必ず書く。
intent に「部分テーマ1」のようなプレースホルダは不可。
continuity_in/out は各600字以内。第n回 continuity_out と第n+1回 continuity_in は語彙を共有。
meta / common の narrative_arc, tone は文字列。数値は JSON number。

【伏線 foreshadow — 機械検証 M3/M4】
1. foreshadow_registry[].id は fs_1 等で一意
2. introduced_session 回の foreshadow_ids に含める
3. resolved_session 回の payoff_ids に含める
4. 出てくる id はすべて registry に定義
5. payoff のある回の session_no は resolved_session と一致

例（5回・伏線1本）:
foreshadow_registry: [{ "id": "fs_1", "introduced_session": 1, "resolved_session": 5, "description": "..." }]
sessions[0].foreshadow_ids: ["fs_1"], sessions[0].payoff_ids: []
sessions[4].foreshadow_ids: [], sessions[4].payoff_ids: ["fs_1"]`;

function buildOutlineUserPrompt(
  params: CourseParams,
  target: number,
  retryNote?: string,
  contentLockedMarkdown?: string,
): string {
  const base = `以下の条件で CourseMaster JSON を生成してください（Format v2・Web記事型）。

テーマ: ${params.theme}
受講者属性: ${audienceLabel(params.audience)}（${params.audience}）
数学レベル: ${mathLevelLabel(params.math_level)}（常に中学数学固定）
数学の使用上限: ${mathLevelGuide(params.math_level)}
達成目標: ${params.target_outcome || params.theme}
回数: ${params.session_count}（5〜10のみ）
1回あたり目標文字数: ${target}（固定。分数パラメータは無い）
各回のセクション数: ${MIN_SECTIONS_PER_SESSION}〜${MAX_SECTIONS_PER_SESSION}（中身目安 ${PREFERRED_CONTENT_SECTIONS}±1）

必須トップレベルキー: schema_version, meta, common, sources, foreshadow_registry, sessions
meta には theme, audience, math_level, session_count, target_chars_per_session: ${target}, target_outcome を含める。
common には narrative_arc, tone, prerequisites_stated, glossary を含める。
sources は { "locked": false, "items": [] } でよい。
各 session に hero_image_prompt を書く。content に image_search_query を書く。
伏線は上記ルールに厳密に従うこと。`;

  const locked = contentLockedMarkdown?.trim()
    ? `

【確定済み知識ドラフト】
これは講義全体の「教える中身」である。Markdown 見出しは知識の目次であり、受講画面のセクション数ではない。
見出しを1:1でセクション化せず、指定の回数と1回 ${target} 字に合わせて回へ再配分せよ。内容の大幅な改変はしない。

${contentLockedMarkdown.trim().slice(0, 14_000)}
`
    : "";

  if (!retryNote) return `${base}${locked}`;
  return `${base}${locked}

【前回の出力は検証エラー。以下を修正して再出力】
${retryNote}`;
}

function verificationRetryNote(v: VerificationResult): string | null {
  const failed = v.checks.filter(
    (c) => !c.pass && (c.id === "M3" || c.id === "M4" || c.id === "M7" || c.id === "M8"),
  );
  if (failed.length === 0) return null;
  return failed.map((c) => `- [${c.id}] ${c.message_ja}`).join("\n");
}

async function generateCourseMasterOnce(
  params: CourseParams,
  model_id: string,
  target: number,
  trace?: LlmTraceCtx,
  retryNote?: string,
  maxTokens = 8192,
  contentLockedMarkdown?: string,
): Promise<{ master: CourseMaster; raw: string; llm: LlmCallResult }> {
  const user = buildOutlineUserPrompt(params, target, retryNote, contentLockedMarkdown);
  const llm = await llmCompletion(model_id, OUTLINE_SYSTEM, user, maxTokens);
  await traceLlmCall(trace, llm, { attempt: retryNote ? "retry" : "initial" });
  const parsed = parseCourseMaster(extractJsonFromLlm(llm.text), { params });
  if (!parsed.ok) {
    throw new Error(`CourseMaster parse failed: ${parsed.errors.join("; ")}`);
  }
  return { master: parsed.master, raw: llm.text, llm };
}

export async function generateCourseMaster(
  params: CourseParams,
  trace?: Pick<LlmTraceCtx, "course_id" | "supa">,
  options?: {
    model_id?: string;
    max_tokens?: number;
    max_attempts?: 1 | 2;
    /** 構成フェーズで確定した知識ドラフト（任意） */
    content_locked_markdown?: string;
  },
): Promise<{
  master: CourseMaster;
  model_id: string;
  raw?: string;
  attempts: number;
  verification: VerificationResult;
  llm_calls: LlmCallResult[];
}> {
  if (isMockMode() || !hasAnyLlmCredential()) {
    const master = mockCourseMaster(params);
    return {
      master,
      model_id: "mock",
      attempts: 1,
      verification: verifyCourseMaster(master),
      llm_calls: [],
    };
  }

  const model_id = options?.model_id?.trim() || resolveOutlineModelId();
  const target = CHARS_PER_SESSION;
  const maxTokens = options?.max_tokens ?? 20_000;
  const locked = options?.content_locked_markdown;
  const llm_calls: LlmCallResult[] = [];

  let { master, raw, llm } = await generateCourseMasterOnce(
    params,
    model_id,
    target,
    trace
      ? { ...trace, phase: "tier1_outline", step_key: "tier1_attempt_1" }
      : undefined,
    undefined,
    maxTokens,
    locked,
  );
  llm_calls.push(llm);
  let verification = verifyCourseMaster(master);
  let attempts = 1;

  const retryNote = verificationRetryNote(verification);
  if (verification.status === "error" && retryNote && (options?.max_attempts ?? 2) > 1) {
    const second = await generateCourseMasterOnce(
      params,
      model_id,
      target,
      trace ? { ...trace, phase: "tier1_outline", step_key: "tier1_attempt_2" } : undefined,
      retryNote,
      maxTokens,
      locked,
    );
    master = second.master;
    raw = second.raw;
    llm_calls.push(second.llm);
    verification = verifyCourseMaster(master);
    attempts = 2;
  }

  return { master, model_id, raw, attempts, verification, llm_calls };
}

const SESSION_SYSTEM = `あなたは単一講師の Web／ブログ型講義記事を書く。出力は JSON のみ（説明文・前後のコードフェンス不要）。

スキーマ:
{
  "markdown": "string — 講義本文。見出しは ## から。Markdown。",
  "image_prompt": "string|null — Format v2 では通常 null（セクション画像は検索取得）",
  "image_rationale": "string|null"
}

ルール:
- 1回の講義は同日・同じ座の連続記事。セクション間で「こんにちは」「今日は」等の挨拶を繰り返さない。
- 第1回・第1セクションのみ短い導入挨拶可。それ以外は前セクションの続きから書く。
- 目標文字数を大きく超えない（当面 soft）。
- 紙芝居ではない。セクションごとの生成画像プロンプトは不要（null 可）。
- 科学的に正しく。`;

function parseSectionLlmPayload(raw: string): {
  markdown: string;
  image_prompt: string | null;
  image_rationale: string | null;
} {
  try {
    const extracted = extractJsonFromLlm(raw);
    const json = (
      typeof extracted === "string" ? (JSON.parse(extracted) as Record<string, unknown>) : (extracted as Record<string, unknown>)
    );
    if (!json || typeof json !== "object") throw new Error("not object");
    const markdown =
      typeof json.markdown === "string"
        ? json.markdown.trim()
        : typeof json.body === "string"
          ? json.body.trim()
          : "";
    const image_prompt =
      typeof json.image_prompt === "string" && json.image_prompt.trim()
        ? json.image_prompt.trim()
        : null;
    const image_rationale =
      typeof json.image_rationale === "string" && json.image_rationale.trim()
        ? json.image_rationale.trim()
        : null;
    if (markdown) return { markdown, image_prompt, image_rationale };
  } catch {
    /* fall through: 旧形式の生 Markdown */
  }
  return { markdown: raw.trim(), image_prompt: null, image_rationale: null };
}

export async function generateSessionSection(opts: {
  master: CourseMaster;
  session_no: number;
  section_no: number;
  trace?: Pick<LlmTraceCtx, "course_id" | "supa">;
  model_id?: string;
}): Promise<{
  markdown: string;
  image_prompt: string | null;
  image_rationale: string | null;
  model_id: string;
  llm?: LlmCallResult;
}> {
  const { master, session_no, section_no } = opts;
  const session = master.sessions.find((s) => s.session_no === session_no);
  if (!session) throw new Error(`session ${session_no} not found`);
  const section = session.sections.find((s) => s.section_no === section_no);
  if (!section) throw new Error(`section ${section_no} not found`);

  if (isMockMode() || !hasAnyLlmCredential()) {
    const body = `## ${section.heading}\n\nこれは第${session_no}回・セクション${section_no}のモック本文です。${master.meta.theme}について説明します。\n\n`;
    return {
      markdown: body,
      image_prompt: null,
      image_rationale: null,
      model_id: "mock",
    };
  }

  const model_id = opts.model_id?.trim() || resolveSessionModelId();
  const isFirstSection = session_no === 1 && section_no === 1;
  const intentLine =
    section.intent && !/の部分テーマ\d+$/.test(section.intent)
      ? `設計メモ（参考・無くてもよい）: ${section.intent}`
      : "";

  const user = `講義テーマ: ${master.meta.theme}
口調: ${master.common.tone}
数学レベル: ${mathLevelLabel(master.meta.math_level)} — ${mathLevelGuide(master.meta.math_level)}
受講者: ${audienceLabel(master.meta.audience)}

## 第${session_no}回 ${session.title}（Web記事の1ブロック）
continuity_in（回の冒頭文脈）: ${session.continuity_in}
continuity_out（回の締め文脈）: ${session.continuity_out}
objectives: ${session.objectives.join(" / ")}

### 今回のブロック（セクション ${section_no}）
見出し: ${section.heading}
role: ${section.role}
${intentLine}
目標文字数: 約${section.target_chars}字（±15%目安・soft）

出力: JSON（markdown 必須。image_prompt は null でよい）。
${isFirstSection ? "冒頭に短い挨拶を1回だけ入れてよい。" : "挨拶は禁止。前のブロックの続きとして書く。"}
見出しは ## ${section.heading} から始める。`;

  const llm = await llmCompletion(model_id, SESSION_SYSTEM, user, 4096);
  const parsed = parseSectionLlmPayload(llm.text);
  await traceLlmCall(
    opts.trace
      ? {
          ...opts.trace,
          phase: "tier2_section",
          step_key: `s${session_no}_sec${section_no}`,
        }
      : undefined,
    llm,
    {
      session_no,
      section_no,
      heading: section.heading,
      image_prompt: parsed.image_prompt,
      image_rationale: parsed.image_rationale,
    },
  );
  return {
    markdown: parsed.markdown,
    image_prompt: parsed.image_prompt,
    image_rationale: parsed.image_rationale,
    model_id,
    llm,
  };
}

const SESSION_BATCH_SYSTEM = `あなたは単一講師による1回分の Web／ブログ型講義記事を書く。出力はJSONのみ。
スキーマ:
{
  "sections": [
    {
      "section_no": 1,
      "markdown": "## 見出し\\n\\n本文"
    }
  ]
}

ルール:
- 入力された全セクションを順番どおり、過不足なく1回答で書く。
- 各markdownは指定見出しから開始し、指定target_charsを目安にする。
- 回全体の本文合計を指定目標文字数の±15%に近づける（当面 soft。厳格失敗で落とさない想定の呼び出し側あり）。
- intro「はじめに」は、第1回なら講義の位置づけと今回の目標、第2回以降なら前回のまとめと今回の目標。
- outro「まとめ」は今回の要点と次回へのつながり。最終回は講義全体を着地させる。
- 挨拶は第1回introに短く1回だけ。それ以外では繰り返さない。
- 紙芝居ではない。セクションごとの image_prompt は不要（書いても無視される）。
- 科学的に正しく。`;

export type GeneratedSessionPage = {
  section_no: number;
  markdown: string;
  image_prompt: string | null;
  image_rationale: string | null;
};

function parseSessionBatchPayload(
  raw: string,
  master: CourseMaster,
  sessionNo: number,
  enforceLength: boolean,
): GeneratedSessionPage[] {
  const session = master.sessions.find((s) => s.session_no === sessionNo);
  if (!session) throw new Error(`session ${sessionNo} not found`);
  const extracted = extractJsonFromLlm(raw);
  if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
    throw new Error("session batch root must be object");
  }
  const rows = (extracted as Record<string, unknown>).sections;
  if (!Array.isArray(rows) || rows.length !== session.sections.length) {
    throw new Error(
      `session batch sections must contain exactly ${session.sections.length} items`,
    );
  }
  const expected = [...session.sections].sort((a, b) => a.section_no - b.section_no);
  const pages = rows.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`session batch section ${index + 1} must be object`);
    }
    const value = row as Record<string, unknown>;
    const plan = expected[index]!;
    const section_no = Number(value.section_no);
    const markdown = typeof value.markdown === "string" ? value.markdown.trim() : "";
    const image_prompt =
      typeof value.image_prompt === "string" && value.image_prompt.trim()
        ? value.image_prompt.trim()
        : null;
    const image_rationale =
      typeof value.image_rationale === "string" && value.image_rationale.trim()
        ? value.image_rationale.trim()
        : null;
    if (section_no !== plan.section_no) {
      throw new Error(`session batch section order mismatch at ${index + 1}`);
    }
    if (!markdown.startsWith(`## ${plan.heading}`)) {
      throw new Error(`section ${section_no} must start with ## ${plan.heading}`);
    }
    return { section_no, markdown, image_prompt, image_rationale };
  });
  const totalChars = pages.reduce(
    (sum, page) => sum + page.markdown.replace(/[#*_`\s]/g, "").length,
    0,
  );
  const target = master.meta.target_chars_per_session || CHARS_PER_SESSION;
  const ratio = totalChars / Math.max(target, 1);
  if (enforceLength && (ratio < 0.85 || ratio > 1.15)) {
    throw new Error(
      `session batch body length ${totalChars} is outside target ${target} ±15%`,
    );
  }
  return pages;
}

export async function generateSessionContent(opts: {
  master: CourseMaster;
  session_no: number;
  trace?: Pick<LlmTraceCtx, "course_id" | "supa">;
  luna_model_id?: string;
  terra_model_id?: string;
  allow_fallback?: boolean;
  /** Format v2 既定は soft（false）。厳格化時のみ true */
  enforce_length?: boolean;
  max_tokens?: number;
}): Promise<{
  pages: GeneratedSessionPage[];
  model_id: string;
  fallback_used: boolean;
  llm_calls: LlmCallResult[];
}> {
  const session = opts.master.sessions.find((s) => s.session_no === opts.session_no);
  if (!session) throw new Error(`session ${opts.session_no} not found`);
  if (isMockMode() || !hasAnyLlmCredential()) {
    return {
      pages: session.sections.map((section) => ({
        section_no: section.section_no,
        markdown: `## ${section.heading}\n\n${opts.master.meta.theme}についてのモック本文です。`,
        image_prompt: null,
        image_rationale: null,
      })),
      model_id: "mock",
      fallback_used: false,
      llm_calls: [],
    };
  }

  const sectionPlan = [...session.sections]
    .sort((a, b) => a.section_no - b.section_no)
    .map((section, index, all) => ({
      section_no: section.section_no,
      role:
        section.role ??
        (index === 0 ? "intro" : index === all.length - 1 ? "outro" : "content"),
      heading: section.heading,
      intent: section.intent,
      target_chars: section.target_chars,
    }));
  const user = `講義テーマ: ${opts.master.meta.theme}
口調: ${opts.master.common.tone}
数学レベル: ${mathLevelLabel(opts.master.meta.math_level)} — ${mathLevelGuide(opts.master.meta.math_level)}
受講者: ${audienceLabel(opts.master.meta.audience)}
全${opts.master.meta.session_count}回中の第${opts.session_no}回: ${session.title}
回全体の本文目標: ${opts.master.meta.target_chars_per_session || CHARS_PER_SESSION}字（soft）
continuity_in: ${session.continuity_in}
continuity_out: ${session.continuity_out}
objectives: ${session.objectives.join(" / ")}

セクション設計:
${JSON.stringify(sectionPlan, null, 2)}

上記セクションすべてのmarkdownを1つのJSON回答で生成せよ。`;

  const lunaModel = opts.luna_model_id?.trim() || "openai/gpt-5.6-luna";
  const terraModel = opts.terra_model_id?.trim() || "openai/gpt-5.6-terra";
  const calls: LlmCallResult[] = [];
  const enforce = opts.enforce_length === true;
  const run = async (modelId: string, fallback: boolean) => {
    const call = await llmCompletion(
      modelId,
      SESSION_BATCH_SYSTEM,
      user,
      opts.max_tokens ?? 20_000,
    );
    calls.push(call);
    try {
      const pages = parseSessionBatchPayload(
        call.text,
        opts.master,
        opts.session_no,
        enforce,
      );
      await traceLlmCall(
        opts.trace
          ? {
              ...opts.trace,
              phase: "tier2_section",
              step_key: `s${opts.session_no}_all_${fallback ? "terra_fallback" : "luna"}`,
            }
          : undefined,
        call,
        { session_no: opts.session_no, section_count: pages.length, fallback },
      );
      return pages;
    } catch (error) {
      await traceLlmCall(
        opts.trace
          ? {
              ...opts.trace,
              phase: "tier2_section",
              step_key: `s${opts.session_no}_all_${fallback ? "terra_fallback" : "luna"}_invalid`,
            }
          : undefined,
        call,
        {
          session_no: opts.session_no,
          fallback,
          validation_error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  };

  try {
    const pages = await run(lunaModel, false);
    return { pages, model_id: lunaModel, fallback_used: false, llm_calls: calls };
  } catch (error) {
    if (opts.allow_fallback === false) throw error;
    const pages = await run(terraModel, true);
    return { pages, model_id: terraModel, fallback_used: true, llm_calls: calls };
  }
}

const IMAGE_PROMPT_REWRITE_SYSTEM = `あなたは教材用セクション画のプロンプト作家である。出力は JSON のみ。
スキーマ: { "image_prompt": "string", "image_rationale": "string" }

image_prompt は画像モデルに渡す英文を主とした1本のプロンプト。次の順で必ず含める:
1) 被写体（焦点は1つ）
2) 構図（16:9 wide）
3) 視覚スタイル（YouTube背景級のシネマ調 educational B-roll。線画・クリップアートは避ける）
4) 照明・質感
5) 短いラベル（英語でも漢字でも可。長い文章ラベルは避ける）

漢字禁止や「Japanese characters forbidden」などの制約は書かない。
科学的正確さを優先する。`;

/** image-lab Phase B: 既存本文から image_prompt だけを新ルールで書き直す */
export async function rewriteSectionImagePrompt(opts: {
  theme: string;
  session_no: number;
  section_no: number;
  heading: string;
  section_markdown: string;
}): Promise<{
  image_prompt: string;
  image_rationale: string | null;
  model_id: string;
  llm: LlmCallResult;
  cost_usd: number;
}> {
  const model_id = resolveSessionModelId();
  const user = `テーマ: ${opts.theme}
第${opts.session_no}回・セクション${opts.section_no}
見出し: ${opts.heading}

### このセクションの講義本文
${opts.section_markdown.trim() || "（本文なし）"}

上記本文の要点を1枚のセクション画で伝える image_prompt を書け。`;

  const llm = await llmCompletion(model_id, IMAGE_PROMPT_REWRITE_SYSTEM, user, 1200);
  let image_prompt = "";
  let image_rationale: string | null = null;
  try {
    const extracted = extractJsonFromLlm(llm.text);
    const json = (
      typeof extracted === "string"
        ? (JSON.parse(extracted) as Record<string, unknown>)
        : (extracted as Record<string, unknown>)
    );
    if (typeof json.image_prompt === "string") image_prompt = json.image_prompt.trim();
    if (typeof json.image_rationale === "string") image_rationale = json.image_rationale.trim();
  } catch {
    image_prompt = llm.text.trim();
  }
  if (!image_prompt) throw new Error("rewrite returned empty image_prompt");

  const { estimateLlmCostUsd } = await import("./course-pricing");
  const cost_usd =
    (await estimateLlmCostUsd(llm.prompt_tokens, llm.completion_tokens, model_id)) ?? 0;

  return { image_prompt, image_rationale, model_id, llm, cost_usd };
}
