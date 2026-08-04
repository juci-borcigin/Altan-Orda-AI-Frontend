/**
 * ヒアリング・Brief要約・骨格アウトライン生成（Terra）
 */

import { applyCompletionBudgetToPayload } from "@/lib/llm/completion-payload";
import { completionHeaders } from "@/lib/llm/router";
import { resolveLlmRoute } from "@/lib/llm/resolve-route";
import {
  buildDefaultBrief,
  DEFAULT_DISCLAIMER,
  clampSessionCount,
  HEARING_SYSTEM_PROMPT,
  SKELETON_SYSTEM_PROMPT,
  SUMMARIZE_SYSTEM_PROMPT,
  skeletonTotalMinutes,
  type HearingTurn,
  type OutlineSkeleton,
  type ThemeBrief,
} from "./course-theme-brief";
import { extractJsonFromLlm } from "./course-master-schema";

export type HearingLlmResult = {
  text: string;
  model_id: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
};

function isMockMode(): boolean {
  const v = (process.env.AO_MOCK_LLM ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function resolveHearingModelId(): string {
  return (
    process.env.AO_COURSE_OUTLINE_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    "openai/gpt-5.6-terra"
  );
}

async function llmCompletion(
  system: string,
  user: string,
  maxTokens: number,
): Promise<HearingLlmResult> {
  const modelId = resolveHearingModelId();
  if (isMockMode()) {
    return {
      text: user.includes("OutlineSkeleton") || system.includes("OutlineSkeleton")
        ? ""
        : "（モック）承知しました。ほかに力点の偏りがなければ、アウトライン提案に進んでよさそうです。",
      model_id: modelId,
      provider: "mock",
      prompt_tokens: 0,
      completion_tokens: 0,
      latency_ms: 20,
    };
  }

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
  // sampling は送らない（ベンダー既定）。拒否モデルでの 400 を避ける。
  applyCompletionBudgetToPayload(payload, route, maxTokens);

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${route.baseUrl}/chat/completions`, {
      method: "POST",
      headers: completionHeaders(route),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const cause =
      e instanceof Error && e.cause instanceof Error
        ? e.cause.message
        : e instanceof Error && typeof e.cause === "string"
          ? e.cause
          : "";
    throw new Error(
      msg.toLowerCase().includes("fetch failed") || msg.toLowerCase().includes("timeout")
        ? `LLM接続に失敗しました${cause ? `（${cause}）` : ""}。もう一度お試しください。`
        : msg,
    );
  }
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Hearing LLM ${res.status}: ${raw.slice(0, 400)}`);
  }
  const json = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: json.choices?.[0]?.message?.content?.trim() || "",
    model_id: modelId,
    provider: route.provider,
    prompt_tokens: json.usage?.prompt_tokens ?? 0,
    completion_tokens: json.usage?.completion_tokens ?? 0,
    latency_ms: Date.now() - started,
  };
}

export async function runHearingTurn(opts: {
  title: string;
  history: HearingTurn[];
  message: string;
}): Promise<HearingLlmResult & { reply: string }> {
  const history = opts.history
    .filter((t) => t.content?.trim() && (t.role === "user" || t.role === "assistant"))
    .slice(-16);

  if (isMockMode()) {
    const reply =
      "（モック）ありがとうございます。想定読者は情報収集する社会人として進めます。力点に偏りがなければ均等配分でよいでしょうか。準備ができたら「アウトラインを提案」を押してください。";
    return {
      reply,
      text: reply,
      model_id: resolveHearingModelId(),
      provider: "mock",
      prompt_tokens: 0,
      completion_tokens: 0,
      latency_ms: 15,
    };
  }

  const transcript = [
    ...history.map((t) => `${t.role === "user" ? "ユーザー" : "AI"}: ${t.content}`),
    `ユーザー: ${opts.message.trim()}`,
  ].join("\n");

  const user = [
    `タイトル: ${opts.title}`,
    "",
    "会話:",
    transcript,
    "",
    "上記を踏まえ、ヒアリング役として次の一言を返せ。",
  ].join("\n");

  const result = await llmCompletion(HEARING_SYSTEM_PROMPT, user, 1024);
  const reply = result.text || "続けて教えてください。おまかせでも構いません。";
  return { ...result, reply };
}

function normalizeBrief(raw: unknown, title: string, hearingTurns: number): ThemeBrief {
  const base = buildDefaultBrief(title, hearingTurns);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const personaIn =
    o.persona && typeof o.persona === "object"
      ? (o.persona as Record<string, unknown>)
      : {};
  const scaleIn =
    o.scale && typeof o.scale === "object" ? (o.scale as Record<string, unknown>) : {};
  const discIn =
    o.disclaimer && typeof o.disclaimer === "object"
      ? (o.disclaimer as Record<string, unknown>)
      : {};

  const outcomes = Array.isArray(o.learning_outcomes)
    ? o.learning_outcomes.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  const statements = Array.isArray(discIn.statements)
    ? discIn.statements.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  if (!statements.some((s) => s.includes("情報提供"))) {
    statements.unshift(DEFAULT_DISCLAIMER);
  }
  const statementsNorm = [
    ...new Set(
      statements.map((s) =>
        s.includes("教養・情報提供を目的とし") || s.length > 80 ? DEFAULT_DISCLAIMER : s,
      ),
    ),
  ];
  if (!statementsNorm.length) statementsNorm.push(DEFAULT_DISCLAIMER);

  let sessions = clampSessionCount(
    typeof scaleIn.recommended_sessions === "number"
      ? scaleIn.recommended_sessions
      : undefined,
  );

  type Emphasis = ThemeBrief["emphasis"][number];
  const emphasis: Emphasis[] = Array.isArray(o.emphasis)
    ? o.emphasis
        .map((e): Emphasis | null => {
          if (!e || typeof e !== "object") return null;
          const row = e as Record<string, unknown>;
          const domain = typeof row.domain === "string" ? row.domain.trim() : "";
          if (!domain) return null;
          const weight =
            row.weight === "primary" || row.weight === "secondary" || row.weight === "mention"
              ? row.weight
              : "secondary";
          return { domain, weight };
        })
        .filter((x): x is Emphasis => Boolean(x))
    : [];

  return {
    ...base,
    status: "ready",
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim() : title,
    seed_theme:
      typeof o.seed_theme === "string" && o.seed_theme.trim()
        ? o.seed_theme.trim()
        : title,
    course_type:
      o.course_type === "single_field" ||
      o.course_type === "interdisciplinary" ||
      o.course_type === "skills_practice" ||
      o.course_type === "series_part"
        ? o.course_type
        : base.course_type,
    framing:
      typeof o.framing === "string" && o.framing.trim() ? o.framing.trim() : base.framing,
    learning_outcomes: outcomes.length ? outcomes : base.learning_outcomes,
    out_of_scope: Array.isArray(o.out_of_scope)
      ? o.out_of_scope.filter((x): x is string => typeof x === "string")
      : [],
    emphasis,
    persona: {
      label:
        typeof personaIn.label === "string" && personaIn.label.trim()
          ? personaIn.label.trim()
          : base.persona.label,
      age_band: typeof personaIn.age_band === "string" ? personaIn.age_band : null,
      gender:
        personaIn.gender === "female" ||
        personaIn.gender === "male" ||
        personaIn.gender === "other" ||
        personaIn.gender === "unspecified"
          ? personaIn.gender
          : null,
      context: typeof personaIn.context === "string" ? personaIn.context : "",
      prior_knowledge:
        typeof personaIn.prior_knowledge === "string" && personaIn.prior_knowledge.trim()
          ? personaIn.prior_knowledge.trim()
          : base.persona.prior_knowledge,
    },
    delivery_focus:
      o.delivery_focus === "persona_deep" ? "persona_deep" : "broad_principles",
    scale: {
      fits_one_course: scaleIn.fits_one_course !== false,
      recommended_sessions: sessions,
      series_role: typeof scaleIn.series_role === "string" ? scaleIn.series_role : null,
      follow_ons: Array.isArray(scaleIn.follow_ons)
        ? scaleIn.follow_ons.filter((x): x is string => typeof x === "string")
        : [],
    },
    disclaimer: {
      domains: Array.isArray(discIn.domains)
        ? discIn.domains.filter(
            (d): d is ThemeBrief["disclaimer"]["domains"][number] =>
              d === "medical" ||
              d === "beauty" ||
              d === "finance" ||
              d === "legal" ||
              d === "other",
          )
        : ["other"],
      statements: statementsNorm,
      forbidden: Array.isArray(discIn.forbidden)
        ? discIn.forbidden.filter((x): x is string => typeof x === "string")
        : base.disclaimer.forbidden,
    },
    user_freeform: (() => {
      let free =
        typeof o.user_freeform === "string" ? o.user_freeform.trim() : "";
      free = free
        .replace(/当初は全\d+回を希望していた。?/g, "")
        .replace(/全\d+回を希望[^\n。]*。?/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return free;
    })(),
    claims_to_watch: Array.isArray(o.claims_to_watch)
      ? o.claims_to_watch.filter((x): x is string => typeof x === "string")
      : [],
    notes_for_outline: typeof o.notes_for_outline === "string" ? o.notes_for_outline : "",
    meta: {
      model_id: resolveHearingModelId(),
      updated_at: new Date().toISOString(),
      hearing_turns: hearingTurns,
    },
  };
}

export async function summarizeThemeBrief(opts: {
  title: string;
  messages: HearingTurn[];
}): Promise<{ brief: ThemeBrief; llm: HearingLlmResult }> {
  const turns = opts.messages.filter((m) => m.content?.trim()).length;
  if (isMockMode()) {
    const brief = buildDefaultBrief(opts.title, turns);
    brief.framing = `（モック）${opts.title} の要点をつかむ講義`;
    return {
      brief,
      llm: {
        text: JSON.stringify(brief),
        model_id: resolveHearingModelId(),
        provider: "mock",
        prompt_tokens: 0,
        completion_tokens: 0,
        latency_ms: 10,
      },
    };
  }

  const transcript = opts.messages
    .map((t) => `${t.role === "user" ? "ユーザー" : "AI"}: ${t.content}`)
    .join("\n");
  const user = [
    `title: ${opts.title}`,
    "",
    "会話:",
    transcript || "（会話なし・おまかせ）",
    "",
    "ThemeBrief JSON のみ出力せよ。",
  ].join("\n");

  const llm = await llmCompletion(SUMMARIZE_SYSTEM_PROMPT, user, 3072);
  let parsed: unknown = null;
  try {
    parsed = extractJsonFromLlm(llm.text);
  } catch {
    parsed = null;
  }
  return { brief: normalizeBrief(parsed, opts.title, turns), llm };
}

function normalizeSkeleton(
  raw: unknown,
  brief: ThemeBrief,
  revisionNote?: string,
): OutlineSkeleton {
  const n = clampSessionCount(brief.scale.recommended_sessions);

  if (isMockMode() || !raw || typeof raw !== "object") {
    const sessions = Array.from({ length: n }, (_, i) => ({
      session_no: i + 1,
      title: `第${i + 1}回 ${brief.title}（仮）`,
      one_liner: `${brief.title}に関する要点その${i + 1}`,
    }));
    return {
      schema_version: 1,
      status: "draft",
      session_count: n,
      estimated_total_minutes: skeletonTotalMinutes(n),
      sessions,
      change_log: revisionNote ? [revisionNote] : [],
    };
  }

  const o = raw as Record<string, unknown>;
  let count =
    typeof o.session_count === "number" ? Math.round(o.session_count) : n;
  count = clampSessionCount(count);

  const sessionsIn = Array.isArray(o.sessions) ? o.sessions : [];
  const sessions = Array.from({ length: count }, (_, i) => {
    const row =
      sessionsIn.find(
        (s) =>
          s &&
          typeof s === "object" &&
          (s as { session_no?: number }).session_no === i + 1,
      ) ?? sessionsIn[i];
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      session_no: i + 1,
      title:
        typeof r.title === "string" && r.title.trim()
          ? r.title.trim()
          : `第${i + 1}回`,
      one_liner:
        typeof r.one_liner === "string" && r.one_liner.trim()
          ? r.one_liner.trim()
          : "（要約未設定）",
    };
  });

  const change_log = Array.isArray(o.change_log)
    ? o.change_log.filter((x): x is string => typeof x === "string")
    : [];
  if (revisionNote) change_log.push(revisionNote);

  return {
    schema_version: 1,
    status: "draft",
    session_count: count,
    estimated_total_minutes:
      typeof o.estimated_total_minutes === "number"
        ? o.estimated_total_minutes
        : skeletonTotalMinutes(count),
    sessions,
    change_log,
  };
}

export async function generateOutlineSkeleton(opts: {
  brief: ThemeBrief;
  revision?: string;
  previous?: OutlineSkeleton | null;
}): Promise<{ skeleton: OutlineSkeleton; llm: HearingLlmResult }> {
  if (isMockMode()) {
    const skeleton = normalizeSkeleton(null, opts.brief, opts.revision);
    return {
      skeleton,
      llm: {
        text: JSON.stringify(skeleton),
        model_id: resolveHearingModelId(),
        provider: "mock",
        prompt_tokens: 0,
        completion_tokens: 0,
        latency_ms: 10,
      },
    };
  }

  const user = [
    "ThemeBrief:",
    JSON.stringify(opts.brief, null, 2),
    opts.previous
      ? `\n現在の骨格:\n${JSON.stringify(opts.previous, null, 2)}`
      : "",
    opts.revision?.trim()
      ? `\n修正指示:\n${opts.revision.trim()}`
      : "\n修正指示: なし（新規生成）",
    "",
    "OutlineSkeleton JSON のみ出力せよ。",
  ].join("\n");

  const llm = await llmCompletion(SKELETON_SYSTEM_PROMPT, user, 3072);
  let parsed: unknown = null;
  try {
    parsed = extractJsonFromLlm(llm.text);
  } catch {
    parsed = null;
  }
  return {
    skeleton: normalizeSkeleton(parsed, opts.brief, opts.revision?.trim() || undefined),
    llm,
  };
}
