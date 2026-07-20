import {
  extractJsonFromLlm,
  MAX_SECTIONS_PER_SESSION,
  mathLevelGuide,
  mathLevelLabel,
  MIN_SECTIONS_PER_SESSION,
  parseCourseMaster,
  PREFERRED_SECTION_CHARS,
  targetCharsForDuration,
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
  const target = targetCharsForDuration(params.session_duration_min);
  const sectionCount = Math.max(
    MIN_SECTIONS_PER_SESSION,
    Math.min(MAX_SECTIONS_PER_SESSION, Math.round(target / PREFERRED_SECTION_CHARS)),
  );
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
      visual_slots:
        n === 2
          ? [
              {
                slot_id: `vis_${n}_1`,
                visual_type: "diagram" as const,
                prompt_hint: `${params.theme}の概念図`,
                image_model_tier: "mini" as const,
              },
            ]
          : [],
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
                : `セクション${si + 1}`,
          intent:
            role === "intro"
              ? n === 1
                ? "講座全体の位置づけと今回の目標"
                : "前回のまとめと今回の目標"
              : role === "outro"
                ? "今回のまとめ"
                : `${params.theme}の部分テーマ${si + 1}`,
          target_chars: sectionChars,
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

const OUTLINE_SYSTEM = `あなたは講座設計者です。出力は JSON のみ（説明文・markdown不要）。
schema_version は必ず 1。
sessions は配列。各要素に session_no（1始まりの整数）, title, objectives, keywords,
continuity_in, continuity_out, foreshadow_ids, payoff_ids, visual_slots, sections, source_refs を含める。
sections はテーマと1回の時間に応じてAIが各回3〜10個の範囲で決める。回ごとに個数が異なってよい。
最初の section は role="intro"、heading="はじめに"。第1回は講座全体の位置づけと今回の目標、第2回以降は前回のまとめと今回の目標を扱う。
最後の section は role="outro"、heading="まとめ"。今回の要点と次回へのつながり（最終回は講座全体の着地）を扱う。
その間は role="content"。section_no は各回1からの連番。
各 section には role, heading, intent（このセクションで教えること・なぜ必要かを日本語1〜2文）, target_chars を必ず書く。
target_chars は平均400字を基本とし、通常300〜500字。各回の合計を目標文字数の±10%に収める。
長時間回で10セクション×500字では総文字数に届かない場合は、10個を上限に各target_charsを均等に増やす。
intent に「部分テーマ1」のようなプレースホルダは不可。具体的な学習内容を書く。
continuity_in/out は各600字以内。第n回の continuity_out と 第n+1回の continuity_in は語彙を共有する。
visual_slots の image_model_tier は "mini" を既定とする。
meta / common の narrative_arc, tone は必ず文字列で出力する。
数値フィールド（session_no, section_no, session_count 等）は JSON number 型で出力する（文字列不可）。

【伏線 foreshadow — 機械検証 M3/M4 で必ずチェックされる】
1. foreshadow_registry[].id は fs_1, fs_2 のように一意の文字列
2. 各 id について introduced_session 回の sessions[].foreshadow_ids に含める
3. 各 id について resolved_session 回の sessions[].payoff_ids に含める（他の回には入れない）
4. sessions に出てくる foreshadow_ids / payoff_ids の id はすべて registry に定義する
5. payoff_ids に id がある回の session_no は、registry の resolved_session と一致させる

例（5回講座・伏線1本）:
foreshadow_registry: [{ "id": "fs_1", "introduced_session": 1, "resolved_session": 5, "description": "..." }]
sessions[0].foreshadow_ids: ["fs_1"], sessions[0].payoff_ids: []
sessions[4].foreshadow_ids: [], sessions[4].payoff_ids: ["fs_1"]`;

function buildOutlineUserPrompt(params: CourseParams, target: number, retryNote?: string): string {
  const base = `以下の条件で CourseMaster JSON を生成してください。

テーマ: ${params.theme}
現在のレベル（トピック習熟度）: ${params.learner_level}
数学レベル: ${mathLevelLabel(params.math_level)}（${params.math_level}）
数学の使用上限: ${mathLevelGuide(params.math_level)}
語学レベル: ${params.language_level}
達成目標: ${params.target_outcome || params.theme}
回数: ${params.session_count}
1回あたり時間: ${params.session_duration_min}分
1回あたり目標文字数: ${target}
各回のセクション数: 3〜10個から内容に応じて判断（平均400字、総文字数優先）

必須トップレベルキー: schema_version, meta, common, sources, foreshadow_registry, sessions
meta には theme, session_count, target_chars_per_session: ${target} を含める（learner_level 等は省略可）。
common には narrative_arc, tone, prerequisites_stated, glossary を含める。
sources は { "locked": false, "items": [] } でよい。
伏線は上記ルールに厳密に従うこと。`;

  if (!retryNote) return base;
  return `${base}

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
): Promise<{ master: CourseMaster; raw: string; llm: LlmCallResult }> {
  const user = buildOutlineUserPrompt(params, target, retryNote);
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
  options?: { model_id?: string; max_tokens?: number; max_attempts?: 1 | 2 },
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
  const target = targetCharsForDuration(params.session_duration_min);
  const maxTokens = options?.max_tokens ?? 20_000;
  const llm_calls: LlmCallResult[] = [];

  let { master, raw, llm } = await generateCourseMasterOnce(params, model_id, target, trace
    ? { ...trace, phase: "tier1_outline", step_key: "tier1_attempt_1" }
    : undefined, undefined, maxTokens);
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
    );
    master = second.master;
    raw = second.raw;
    llm_calls.push(second.llm);
    verification = verifyCourseMaster(master);
    attempts = 2;
  }

  return { master, model_id, raw, attempts, verification, llm_calls };
}

const SESSION_SYSTEM = `あなたは単一講師の連続講義を書く。出力は JSON のみ（説明文・前後のコードフェンス不要）。

スキーマ:
{
  "markdown": "string — 講義本文。見出しは ## から。Markdown。",
  "image_prompt": "string — このセクション紙芝居ページ上部の説明図を1枚つくるための画像生成プロンプト（日本語可）。必ず1本書く",
  "image_rationale": "string — 本文のどの部分を図にしたか／ねらい（短く）"
}

ルール:
- 1回の講義は同日・同じ座。セクション間で「こんにちは」「今日は」等の挨拶を繰り返さない。
- 第1回・第1セクションのみ短い導入挨拶可。それ以外は前セクションの続きから書く。
- 目標文字数を大きく超えない。
- 紙芝居は1セクション＝1ページ＝セクション画1枚。image_prompt は必ず非空で書く。
- image_prompt は次の順で、英語を主に1本の連続文／段落として書く（箇条書き不要）:
  1) 被写体（何を見せるか・焦点は1つ）
  2) 構図（16:9 wide。left-right / center hero 等）
  3) 視覚スタイル（YouTube背景級のシネマ調 educational B-roll。線画クリップアートは避ける）
  4) 照明・質感（volumetric light、浅い被写界深度、落ち着いたカラーグレード）
  5) 短いラベル（英語でも漢字でも可。長い文章ラベルは避ける）
- 科学的に正しく。装飾のための要素で主題をぼかさない。`;

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
      image_prompt: `教育用の横長説明図: 「${section.heading}」。${master.meta.theme}。シンプルな線画ダイアグラム、文字は最小限。`,
      image_rationale: "モック: 見出しの概念を1枚で示す",
      model_id: "mock",
    };
  }

  const model_id = opts.model_id?.trim() || resolveSessionModelId();
  const isFirstSection = session_no === 1 && section_no === 1;
  const audienceLabel =
    master.meta.audience === "student"
      ? "中高生"
      : master.meta.audience === "silver"
        ? "シルバー"
        : "社会人";
  const intentLine =
    section.intent && !/の部分テーマ\d+$/.test(section.intent)
      ? `設計メモ（参考・無くてもよい）: ${section.intent}`
      : "";

  const user = `講座テーマ: ${master.meta.theme}
口調: ${master.common.tone}
数学レベル: ${mathLevelLabel(master.meta.math_level)} — ${mathLevelGuide(master.meta.math_level)}
受講者: ${audienceLabel}

## 第${session_no}回 ${session.title}（1回＝紙芝居の連続ページ。本セクションは1ページ）
continuity_in（回の冒頭文脈）: ${session.continuity_in}
continuity_out（回の締め文脈）: ${session.continuity_out}
objectives: ${session.objectives.join(" / ")}

### 今回のページ（セクション ${section_no}/6）
見出し: ${section.heading}
${intentLine}
目標文字数: 約${section.target_chars}字（±10%以内）

出力: JSON（markdown + image_prompt）。
markdown は紙芝居の本文。image_prompt はこのページ上部のセクション画1枚用（1セクション必ず1画像）。空や null は不可。
「文章のどの部分を図にした方がよいか」を考えてから image_prompt を書け。
image_prompt は 焦点→構図(16:9)→シネマ/educational B-roll スタイル→照明→短いラベル の順。漢字ラベル可。線画クリップアートは避ける。

${isFirstSection ? "冒頭に短い挨拶を1回だけ入れてよい。" : "挨拶は禁止。前のページの続きとして書く。"}
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

const SESSION_BATCH_SYSTEM = `あなたは単一講師による1回分の連続講義を書く。出力はJSONのみ。
スキーマ:
{
  "sections": [
    {
      "section_no": 1,
      "markdown": "## 見出し\\n\\n本文",
      "image_prompt": "16:9の教材画像生成プロンプト",
      "image_rationale": "図にする狙い"
    }
  ]
}

ルール:
- 入力された全セクションを順番どおり、過不足なく1回答で書く。
- 各markdownは指定見出しから開始し、指定target_charsを目安にする。
- 回全体の本文合計を指定目標文字数の±15%に収める。
- intro「はじめに」は、第1回なら講座の位置づけと今回の目標、第2回以降なら前回のまとめと今回の目標。
- outro「まとめ」は今回の要点と次回へのつながり。最終回は講座全体を着地させる。
- 挨拶は第1回introに短く1回だけ。それ以外では繰り返さない。
- 1セクション＝紙芝居1ページ。各image_promptは必ず非空。
- image_promptは英語主体の1段落で、焦点→16:9構図→cinematic educational B-roll→照明・質感→短いラベルの順。
- 科学的に正しく、漢字ラベル可。線画クリップアートは避ける。`;

export type GeneratedSessionPage = {
  section_no: number;
  markdown: string;
  image_prompt: string;
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
      typeof value.image_prompt === "string" ? value.image_prompt.trim() : "";
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
    if (!image_prompt) throw new Error(`section ${section_no} image_prompt is empty`);
    return { section_no, markdown, image_prompt, image_rationale };
  });
  const totalChars = pages.reduce(
    (sum, page) => sum + page.markdown.replace(/[#*_`\s]/g, "").length,
    0,
  );
  const target = master.meta.target_chars_per_session;
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
        image_prompt: `${section.heading}を説明する16:9の教材図`,
        image_rationale: "モック",
      })),
      model_id: "mock",
      fallback_used: false,
      llm_calls: [],
    };
  }

  const audienceLabel =
    opts.master.meta.audience === "student"
      ? "中高生"
      : opts.master.meta.audience === "silver"
        ? "シルバー"
        : "社会人";
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
  const user = `講座テーマ: ${opts.master.meta.theme}
口調: ${opts.master.common.tone}
数学レベル: ${mathLevelLabel(opts.master.meta.math_level)} — ${mathLevelGuide(opts.master.meta.math_level)}
受講者: ${audienceLabel}
全${opts.master.meta.session_count}回中の第${opts.session_no}回: ${session.title}
回全体の本文目標: ${opts.master.meta.target_chars_per_session}字
continuity_in: ${session.continuity_in}
continuity_out: ${session.continuity_out}
objectives: ${session.objectives.join(" / ")}

セクション設計:
${JSON.stringify(sectionPlan, null, 2)}

上記セクションすべてのmarkdownとimage_promptを1つのJSON回答で生成せよ。`;

  const lunaModel = opts.luna_model_id?.trim() || "openai/gpt-5.6-luna";
  const terraModel = opts.terra_model_id?.trim() || "openai/gpt-5.6-terra";
  const calls: LlmCallResult[] = [];
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
        opts.enforce_length !== false,
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
