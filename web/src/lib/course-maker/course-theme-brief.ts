/**
 * ヒアリング → ThemeBrief → OutlineSkeleton（構成前の方針正本）
 */

import {
  FIXED_MATH_LEVEL,
  MAX_SESSION_COUNT,
  MIN_SESSION_COUNT,
  readingMinutesForSession,
  type CourseParams,
} from "./course-master-schema";

export type HearingTurn = { role: "user" | "assistant"; content: string };

export type HearingSlot = {
  id: string;
  label: string;
  kind: "common" | "theme_specific";
  priority: "must" | "should" | "skip";
  why: string;
  value: string | null;
  source: "user" | "inferred" | null;
};

export type ThemeBrief = {
  schema_version: 1;
  status: "hearing" | "ready" | "locked";
  title: string;
  seed_theme: string;
  course_type: "single_field" | "interdisciplinary" | "skills_practice" | "series_part";
  framing: string;
  learning_outcomes: string[];
  out_of_scope: string[];
  emphasis: Array<{
    domain: string;
    weight: "primary" | "secondary" | "mention";
  }>;
  persona: {
    label: string;
    age_band: string | null;
    gender: "unspecified" | "female" | "male" | "other" | null;
    context: string;
    prior_knowledge: string;
  };
  delivery_focus: "broad_principles" | "persona_deep";
  scale: {
    fits_one_course: boolean;
    recommended_sessions: number | null;
    series_role: string | null;
    follow_ons: string[];
  };
  disclaimer: {
    domains: Array<"medical" | "beauty" | "finance" | "legal" | "other">;
    statements: string[];
    forbidden: string[];
  };
  slots: HearingSlot[];
  user_freeform: string;
  claims_to_watch: string[];
  notes_for_outline: string;
  meta: {
    model_id: string;
    updated_at: string;
    hearing_turns: number;
  };
};

export type OutlineSkeleton = {
  schema_version: 1;
  status: "draft" | "locked";
  session_count: number;
  estimated_total_minutes: number;
  sessions: Array<{
    session_no: number;
    title: string;
    one_liner: string;
  }>;
  change_log: string[];
};

export type CourseSetupPhase = "hearing" | "confirm" | "skeleton" | "locked";

export type CourseSetupState = {
  v: 1;
  kind: "course_setup";
  phase: CourseSetupPhase;
  messages: HearingTurn[];
  brief: ThemeBrief | null;
  skeleton: OutlineSkeleton | null;
};

export const DEFAULT_DISCLAIMER =
  "本講義は一般的な情報提供であり、個別の診断・治療・投資／法律助言ではありません。";

export const DEFAULT_PERSONA_LABEL = "情報収集する社会人（ネットユーザー）";

export function defaultOutcome(title: string): string {
  return `『${title}』の要点を理解し、自分の文脈で説明できる`;
}

export function clampSessionCount(n: number | null | undefined, fallback = MIN_SESSION_COUNT): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(MIN_SESSION_COUNT, Math.min(MAX_SESSION_COUNT, v));
}

export function formatEmphasisPlain(brief: ThemeBrief): string {
  if (brief.emphasis.length === 0) return "均等（仮）";
  const primary = brief.emphasis.filter((e) => e.weight === "primary").map((e) => e.domain);
  const secondary = brief.emphasis.filter((e) => e.weight === "secondary").map((e) => e.domain);
  const mention = brief.emphasis.filter((e) => e.weight === "mention").map((e) => e.domain);
  const parts: string[] = [];
  if (primary.length) parts.push(primary.join("、"));
  if (secondary.length) parts.push(secondary.join("、"));
  if (mention.length) parts.push(`（${mention.join("、")}）`);
  return parts.join(" / ") || "均等（仮）";
}

export function buildDefaultBrief(title: string, hearingTurns = 0): ThemeBrief {
  const t = title.trim() || "無題の講義";
  return {
    schema_version: 1,
    status: "ready",
    title: t,
    seed_theme: t,
    course_type: "interdisciplinary",
    framing: `『${t}』について、実務に使える要点を一通りつかむ講義`,
    learning_outcomes: [defaultOutcome(t)],
    out_of_scope: [],
    emphasis: [],
    persona: {
      label: DEFAULT_PERSONA_LABEL,
      age_band: null,
      gender: null,
      context: "",
      prior_knowledge: "特別な前提なし。中学数学まで",
    },
    delivery_focus: "broad_principles",
    scale: {
      fits_one_course: true,
      recommended_sessions: MIN_SESSION_COUNT,
      series_role: null,
      follow_ons: [],
    },
    disclaimer: {
      domains: ["other"],
      statements: [DEFAULT_DISCLAIMER],
      forbidden: ["個別診断", "個別の投資・法律助言"],
    },
    slots: [],
    user_freeform: "",
    claims_to_watch: [],
    notes_for_outline: "",
    meta: {
      model_id: "default",
      updated_at: new Date().toISOString(),
      hearing_turns: hearingTurns,
    },
  };
}

export function briefToCourseParams(brief: ThemeBrief): CourseParams {
  return {
    theme: brief.seed_theme || brief.title,
    audience: "working_adult",
    math_level: FIXED_MATH_LEVEL,
    target_outcome: brief.learning_outcomes[0] || defaultOutcome(brief.title),
    session_count: clampSessionCount(brief.scale.recommended_sessions),
  };
}

/** プレーンテキスト用（ログ等）。UIは PolicyBriefBlock を使う */
export function briefConfirmLines(brief: ThemeBrief): string[] {
  const age = brief.persona.age_band ? `・${brief.persona.age_band}` : "";
  const sessions = clampSessionCount(brief.scale.recommended_sessions);
  const lines = [
    `対象: ${brief.persona.label}${age}`,
    `目標: ${brief.learning_outcomes[0] ?? defaultOutcome(brief.title)}`,
    `回数: ${sessions}回`,
    `力点: ${formatEmphasisPlain(brief)}`,
    `注意: ${brief.disclaimer.statements[0] ?? DEFAULT_DISCLAIMER}`,
  ];
  if (brief.user_freeform.trim()) {
    lines.push(`その他: ${brief.user_freeform.trim()}`);
  }
  return lines;
}

export function emptySetupState(): CourseSetupState {
  return {
    v: 1,
    kind: "course_setup",
    phase: "hearing",
    messages: [],
    brief: null,
    skeleton: null,
  };
}

export function parseSetupState(adminMemo: string | null | undefined): CourseSetupState | null {
  if (!adminMemo?.trim()) return null;
  try {
    const raw = JSON.parse(adminMemo) as Partial<CourseSetupState>;
    if (raw?.kind !== "course_setup" || raw.v !== 1) return null;
    return {
      v: 1,
      kind: "course_setup",
      phase: raw.phase ?? "hearing",
      messages: Array.isArray(raw.messages) ? raw.messages : [],
      brief: (raw.brief as ThemeBrief | null) ?? null,
      skeleton: (raw.skeleton as OutlineSkeleton | null) ?? null,
    };
  } catch {
    return null;
  }
}

export function serializeSetupState(state: CourseSetupState): string {
  return JSON.stringify(state);
}

export function openingAssistantMessage(title: string): string {
  return [
    `それでは**『${title}』**の講義を一緒に作っていきましょう！`,
    ``,
    `そのために、どういう講義にするかの**方針**を決めましょう。`,
    ``,
    `まず、この講義で一番大事にしたいことを、一言で教えてください。（おまかせでも構いません）`,
    ``,
    `「そろそろいいかな」と思ったら、いつでも**方針を決定**をクリックしてください。講義の構成を作りたいと思います。`,
  ].join("\n");
}

/** 右ペイン用の仮サマリ（LLMなし） */
export function provisionalSummary(title: string, brief: ThemeBrief | null): string[] {
  if (brief) return briefConfirmLines(brief);
  return [
    `対象: ${DEFAULT_PERSONA_LABEL}（未ヒアリング）`,
    `目標: ${defaultOutcome(title)}`,
    `回数: ${MIN_SESSION_COUNT}（既定）`,
    `力点: 均等（既定）`,
    `注意: 一般的な情報提供（既定）`,
  ];
}

export function skeletonTotalMinutes(sessionCount: number): number {
  return sessionCount * readingMinutesForSession();
}

export const HEARING_SYSTEM_PROMPT = `あなたは講義メーカーのヒアリング役である。目的は、大テーマから「1本のWeb記事型講義」を立てるための方針を、短く対話で固めること。百科事典や完成本文は書かない。診断・個別の医療/投資助言はしない。

# あなたの仕事
1. 必要なら短い質問で意図・対象・力点・境界を確認する
2. ユーザーが曖昧・「おまかせ」なら、決め打ちして先へ進めてよい（しつこく聞かない）
3. 十分に話が進んだら「方針を決定に進んでよさそう」と自然に案内する
4. JSON や ThemeBrief は出力しない。自然文のみ。

# 質問の原則
- タイトルは既に決まっている。繰り返して聞かない
- 画一的な長いアンケートにしない
- 推奨（短縮可）: 大事にしたいこと → 想定読者について粗く → 力点の偏り → その他のこだわり（任意）→ 回数希望
- 1応答につき質問は原則1つ（最大2）。選択肢は短く
- テーマから聞いた方がよいことは提案してよいが、必須扱いで止めない

# 決め打ちデフォルト（頭に置く。ユーザーに長く説明しない）
- 対象: 情報収集する社会人（ネットユーザー）
- 目標: タイトルの理解
- 力点: 均等 / 回数: 5（ユーザーが変えればそれに従う。許容 4〜10） / 寄せ: 広い原則
- Disclaimer: 一般情報提供であり個別診断・投資・法律助言ではない

# 禁止
- 本文・詳細シラバスの長文
- 脅す表現、銘柄推奨、個別診断
- 未確定をいつまでも質問で止め続けること
`;

export const SUMMARIZE_SYSTEM_PROMPT = `次のヒアリング会話を ThemeBrief JSON に一括要約せよ。出力は JSON オブジェクトのみ（説明文・コードフェンス禁止）。

欠損は次の既定で埋めよ:
- audience 相当ペルソナ: 情報収集する社会人（ネットユーザー）
- prior_knowledge: 特別な前提なし。中学数学まで
- learning_outcomes: [「『{title}』の要点を理解し、自分の文脈で説明できる」]
- emphasis: 空配列（均等の意味）または会話にあれば weight 付き
- recommended_sessions: 会話で回数の希望があればその数値。なければ 5。必ず 4〜10 に収める
- 回数は scale.recommended_sessions のみに入れる。「当初は全N回希望」などと user_freeform に書かない
- delivery_focus: broad_principles（明示がなければ）
- disclaimer.statements に必ず次を含める（これ以外の長い注意文は不要）: 「本講義は一般的な情報提供であり、個別の診断・治療・投資／法律助言ではありません。」
- user_freeform は回数以外のこだわり（力点の補足・禁止・トーン等）。disclaimer / forbidden は上書きするな
- status は "ready"
- schema_version は 1
- slots は空でもよい

型の要点:
{
  "schema_version": 1,
  "status": "ready",
  "title": string,
  "seed_theme": string,
  "course_type": "single_field"|"interdisciplinary"|"skills_practice"|"series_part",
  "framing": string,
  "learning_outcomes": string[],
  "out_of_scope": string[],
  "emphasis": [{"domain": string, "weight": "primary"|"secondary"|"mention"}],
  "persona": {
    "label": string,
    "age_band": string|null,
    "gender": "unspecified"|"female"|"male"|"other"|null,
    "context": string,
    "prior_knowledge": string
  },
  "delivery_focus": "broad_principles"|"persona_deep",
  "scale": {
    "fits_one_course": boolean,
    "recommended_sessions": number|null,
    "series_role": string|null,
    "follow_ons": string[]
  },
  "disclaimer": {
    "domains": ("medical"|"beauty"|"finance"|"legal"|"other")[],
    "statements": string[],
    "forbidden": string[]
  },
  "slots": [],
  "user_freeform": string,
  "claims_to_watch": string[],
  "notes_for_outline": string
}
`;

export const SKELETON_SYSTEM_PROMPT = `ThemeBrief から講義の骨格アウトライン（OutlineSkeleton）を JSON のみで出力せよ。説明文・コードフェンス禁止。

制約:
- session_count は Brief の recommended_sessions（なければ5）。必ず 4〜10
- sessions は session_no 1..N、各 title と one_liner（1文）
- estimated_total_minutes は session_count * 20
- status は "draft"
- change_log は []（修正指示がある場合のみ要約を1件追加）
- Intro/Outro の詳細は書かない。回の見出しレベルのみ
- 医療・投資の個別助言に踏み込まない

型:
{
  "schema_version": 1,
  "status": "draft",
  "session_count": number,
  "estimated_total_minutes": number,
  "sessions": [{"session_no": number, "title": string, "one_liner": string}],
  "change_log": string[]
}
`;
