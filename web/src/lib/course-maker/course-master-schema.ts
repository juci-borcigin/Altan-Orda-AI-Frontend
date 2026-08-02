/** Tier1 講義マスター — 型とパース（Zod 未導入のため手動検証） */

import {
  CHARS_PER_SESSION,
  MAX_SECTIONS_PER_SESSION,
  MAX_SESSION_COUNT,
  MIN_SECTIONS_PER_SESSION,
  MIN_SESSION_COUNT,
  PREFERRED_CONTENT_SECTIONS,
  PREFERRED_SECTION_CHARS,
  targetCharsForDuration,
} from "./course-format-v2";

export {
  CHARS_PER_SESSION,
  MAX_SECTIONS_PER_SESSION,
  MAX_SESSION_COUNT,
  MIN_SECTIONS_PER_SESSION,
  MIN_SESSION_COUNT,
  PREFERRED_CONTENT_SECTIONS,
  PREFERRED_SECTION_CHARS,
  readingMinutesForSession,
  targetCharsForDuration,
} from "./course-format-v2";

/** 講義で使ってよい数学の上限（日本の学習段階） */
export type MathLevel = "elementary" | "middle_school" | "high_school";

/** Format v2: 数学は常に中学に固定 */
export const FIXED_MATH_LEVEL: MathLevel = "middle_school";

export const MATH_LEVEL_OPTIONS: {
  value: MathLevel;
  label: string;
  guide: string;
}[] = [
  {
    value: "elementary",
    label: "小学算数",
    guide: "四則演算・分数・割合・基本図形まで。文字式・関数・微積分は使わない。",
  },
  {
    value: "middle_school",
    label: "中学数学",
    guide: "一次方程式・連立方程式・平方根・基本的な関数と幾何まで。",
  },
  {
    value: "high_school",
    label: "高校数学",
    guide: "三角関数・指数対数・微積分の基礎・ベクトルなど高校範囲まで使える。",
  },
];

export function mathLevelLabel(level: MathLevel): string {
  return MATH_LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? level;
}

export function mathLevelGuide(level: MathLevel): string {
  return MATH_LEVEL_OPTIONS.find((o) => o.value === level)?.guide ?? "";
}

/** 旧スキーマ値 → 新3段階への読み替え（既存 DB 行の互換用） */
export function coerceMathLevel(v: unknown): MathLevel | null {
  if (v === "elementary" || v === "middle_school" || v === "high_school") return v;
  if (v === "none") return "elementary";
  if (v === "undergrad" || v === "expert") return "high_school";
  return null;
}

/**
 * 受講者属性（Format v2）— 口調・字数感・画像印象を統合。
 * 当面は社会人のみ選択可。
 */
export type Audience = "kids" | "student" | "working_adult";

export const AUDIENCE_OPTIONS: {
  value: Audience;
  label: string;
  enabled: boolean;
  note: string;
}[] = [
  {
    value: "kids",
    label: "キッズ（小中学生）",
    enabled: false,
    note: "",
  },
  {
    value: "student",
    label: "学生（高校・大学）",
    enabled: false,
    note: "",
  },
  {
    value: "working_adult",
    label: "社会人",
    enabled: true,
    note: "ネットに転がっているレベルの普通の日本語",
  },
];

export function coerceAudience(v: unknown): Audience {
  if (v === "kids" || v === "student" || v === "working_adult") return v;
  if (v === "silver") return "working_adult";
  return "working_adult";
}

export function audienceLabel(a: Audience): string {
  return AUDIENCE_OPTIONS.find((o) => o.value === a)?.label ?? a;
}

export type CourseParams = {
  theme: string;
  /** 受講者属性（キッズ／学生／社会人） */
  audience: Audience;
  /** 常に middle_school（Format v2） */
  math_level: MathLevel;
  target_outcome: string;
  /** 5〜10 */
  session_count: number;
};

/** フォーム／API 入力を Format v2 の CourseParams に正規化 */
export function normalizeCourseParams(
  raw: Partial<CourseParams> & { theme: string },
): CourseParams {
  const theme = raw.theme.trim();
  const sc = Number(raw.session_count);
  return {
    theme,
    audience: coerceAudience(raw.audience),
    math_level: FIXED_MATH_LEVEL,
    target_outcome: raw.target_outcome?.trim() || theme,
    session_count: Math.max(
      MIN_SESSION_COUNT,
      Math.min(MAX_SESSION_COUNT, Number.isFinite(sc) ? sc : MIN_SESSION_COUNT),
    ),
  };
}

export function heroSlotId(sessionNo: number): string {
  return `hero_s${sessionNo}`;
}

export type SourceRef = {
  source_id: string;
  kind: "upload" | "wikipedia" | "url";
  title: string;
  session_refs: number[];
};

export type Foreshadow = {
  id: string;
  introduced_session: number;
  resolved_session: number;
  description: string;
};

export type VisualSlot = {
  slot_id: string;
  visual_type: "diagram" | "portrait" | "comparison" | "timeline";
  prompt_hint: string;
  image_model_tier: "mini" | "medium";
};

export type SectionPlan = {
  section_no: number;
  role: "intro" | "content" | "outro";
  heading: string;
  intent: string;
  target_chars: number;
  /** Wikimedia 検索クエリ（content のみ）。intro/outro は空 */
  image_search_query?: string;
  /** 取得済み小画像 URL（非生成） */
  image_url?: string | null;
  image_attribution?: string | null;
  /** Commons ファイルページなど（ツールチップ用リンク） */
  image_page_url?: string | null;
  image_source?: "wikimedia" | "none";
};

export type SessionMaster = {
  session_no: number;
  title: string;
  objectives: string[];
  keywords: string[];
  continuity_in: string;
  continuity_out: string;
  foreshadow_ids: string[];
  payoff_ids: string[];
  /** 回メイン画像用プロンプト（Image2 Low・1枚） */
  hero_image_prompt?: string;
  /** @deprecated Format v1 visual_slots — 読み取り互換のみ */
  visual_slots: VisualSlot[];
  sections: SectionPlan[];
  source_refs: string[];
};

export type CourseMaster = {
  schema_version: 1;
  meta: CourseParams & {
    target_chars_per_session: number;
    /** 旧講義互換（生成では使わない） */
    session_duration_min?: number;
    learner_level?: string;
    language_level?: string;
  };
  common: {
    narrative_arc: string;
    tone: string;
    prerequisites_stated: string[];
    glossary: { term: string; definition: string }[];
  };
  sources: { locked: boolean; items: SourceRef[] };
  foreshadow_registry: Foreshadow[];
  sessions: SessionMaster[];
};

export type ParseResult =
  | { ok: true; master: CourseMaster }
  | { ok: false; errors: string[] };

const VISUAL_TYPES = ["diagram", "portrait", "comparison", "timeline"] as const;

function sectionCharsForSession(_params?: CourseParams): number {
  return PREFERRED_SECTION_CHARS;
}

function defaultSectionCount(_params?: CourseParams): number {
  return MIN_SECTIONS_PER_SESSION;
}

function pickString(sec: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = sec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeSections(
  raw: unknown,
  sessionNo: number,
  theme: string,
  defaultChars: number,
): SectionPlan[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (isRecord(raw)) list = Object.values(raw);
  const count = Math.max(
    MIN_SECTIONS_PER_SESSION,
    Math.min(MAX_SECTIONS_PER_SESSION, list.length || defaultSectionCount()),
  );

  const out: SectionPlan[] = [];
  for (let si = 0; si < count; si++) {
    const item = list[si];
    const sec: Record<string, unknown> = isRecord(item) ? item : {};
    const section_no = si + 1;
    const role: SectionPlan["role"] =
      si === 0 ? "intro" : si === count - 1 ? "outro" : "content";
    const heading =
      role === "intro"
        ? "はじめに"
        : role === "outro"
          ? "まとめ"
          : pickString(sec, ["heading", "title", "name", "label"]) ||
            `第${sessionNo}回・セクション${section_no}`;
    const intent =
      pickString(sec, ["intent", "description", "summary", "purpose", "goal"]) ||
      (role === "intro"
        ? sessionNo === 1
          ? `${theme}における講義全体の位置づけと今回の目標を示す`
          : "前回の要点を振り返り、今回の目標につなげる"
        : role === "outro"
          ? "今回の要点をまとめ、次回へのつながりを示す"
          : `${theme}の部分テーマ${section_no}`);
    const target_chars =
      coerceInt(sec.target_chars) ?? coerceInt(sec.target_char_count) ?? defaultChars;
    const image_search_query =
      role === "content"
        ? pickString(sec, ["image_search_query", "image_query", "search_query"]) || undefined
        : undefined;
    const image_url =
      typeof sec.image_url === "string" && sec.image_url.trim()
        ? sec.image_url.trim()
        : null;
    const image_attribution =
      typeof sec.image_attribution === "string" ? sec.image_attribution : null;
    const image_page_url =
      typeof sec.image_page_url === "string" && sec.image_page_url.trim()
        ? sec.image_page_url.trim()
        : null;
    const image_source =
      sec.image_source === "wikimedia" || sec.image_source === "none"
        ? sec.image_source
        : image_url
          ? "wikimedia"
          : "none";
    out.push({
      section_no,
      role,
      heading,
      intent,
      target_chars,
      image_search_query,
      image_url,
      image_attribution,
      image_page_url,
      image_source,
    });
  }
  return out;
}

function normalizeVisualSlots(raw: unknown, sessionNo: number, theme: string): VisualSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: VisualSlot[] = [];
  for (let vi = 0; vi < raw.length; vi++) {
    const vs = raw[vi];
    if (!isRecord(vs)) continue;
    const slot_id =
      pickString(vs, ["slot_id", "id", "name"]) || `vis_${sessionNo}_${vi + 1}`;
    const prompt_hint =
      pickString(vs, ["prompt_hint", "prompt", "description", "hint"]) ||
      `${theme}の図解（第${sessionNo}回）`;
    const visual_type = VISUAL_TYPES.includes(vs.visual_type as (typeof VISUAL_TYPES)[number])
      ? (vs.visual_type as VisualSlot["visual_type"])
      : "diagram";
    const image_model_tier = vs.image_model_tier === "medium" ? "medium" : "mini";
    out.push({ slot_id, visual_type, prompt_hint, image_model_tier });
  }
  return out;
}

function normalizeForeshadowRegistry(
  raw: unknown,
  sessionCount: number,
  theme: string,
): Foreshadow[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (isRecord(raw)) list = Object.values(raw);

  const out: Foreshadow[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (!isRecord(f)) continue;
    const id = pickString(f, ["id", "foreshadow_id", "name"]) || `fs_${i + 1}`;
    const introduced_session =
      coerceInt(f.introduced_session) ??
      coerceInt(f.introduced_in) ??
      coerceInt(f.intro_session) ??
      coerceInt(f.introduced) ??
      coerceInt(f.from_session) ??
      1;
    const resolved_session =
      coerceInt(f.resolved_session) ??
      coerceInt(f.resolved_in) ??
      coerceInt(f.resolve_session) ??
      coerceInt(f.resolved) ??
      coerceInt(f.to_session) ??
      sessionCount;
    const description =
      pickString(f, ["description", "summary", "note", "text", "content"]) ||
      `${theme}の伏線${i + 1}`;
    out.push({
      id,
      introduced_session: Math.max(1, introduced_session),
      resolved_session: Math.max(1, Math.min(resolved_session, sessionCount)),
      description,
    });
  }

  if (out.length === 0) {
    out.push({
      id: "fs_main",
      introduced_session: 1,
      resolved_session: sessionCount,
      description: `${theme}の核心`,
    });
  }
  return out;
}

function defaultSession(sessionNo: number, theme: string, sectionChars: number): SessionMaster {
  return {
    session_no: sessionNo,
    title: `${theme} — 第${sessionNo}回`,
    objectives: [`${theme}について説明できる`],
    keywords: [theme],
    continuity_in:
      sessionNo === 1 ? "前提知識なしから開始" : `第${sessionNo - 1}回までの内容を踏まえる`,
    continuity_out: `第${sessionNo}回の到達点を説明できる`,
    foreshadow_ids: sessionNo === 1 ? ["fs_main"] : [],
    payoff_ids: [],
    visual_slots: [],
    sections: normalizeSections([], sessionNo, theme, sectionChars),
    source_refs: [],
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function strOptional(v: unknown, max = 4000): string {
  if (typeof v !== "string" || !v.trim()) return "";
  return v.trim().slice(0, max);
}

function str(v: unknown, field: string, errors: string[], max = 4000): string | null {
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${field}: string required`);
    return null;
  }
  const t = v.trim();
  if (t.length > max) errors.push(`${field}: max ${max} chars`);
  return t.slice(0, max);
}

function coerceInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10);
  return null;
}

function posInt(v: unknown, field: string, errors: string[]): number | null {
  const n = coerceInt(v);
  if (n === null || n < 1) {
    errors.push(`${field}: positive integer required`);
    return null;
  }
  return n;
}

export type ParseCourseMasterOptions = {
  /** フォーム入力値。LLM が meta を欠落・誤記した場合の正規ソース */
  params?: CourseParams;
};

/** LLM 出力のよくある揺れを吸収してから parse する */
export function normalizeCourseMasterInput(raw: unknown, params?: CourseParams): unknown {
  if (!isRecord(raw)) return raw;

  const metaIn = isRecord(raw.meta) ? { ...raw.meta } : {};
  if (params) {
    metaIn.theme = params.theme;
    metaIn.audience = coerceAudience(params.audience);
    metaIn.math_level = FIXED_MATH_LEVEL;
    metaIn.target_outcome = params.target_outcome?.trim() || params.theme;
    metaIn.session_count = Math.max(
      MIN_SESSION_COUNT,
      Math.min(MAX_SESSION_COUNT, params.session_count),
    );
    metaIn.target_chars_per_session = CHARS_PER_SESSION;
    delete metaIn.session_duration_min;
    delete metaIn.learner_level;
    delete metaIn.language_level;
  } else {
    metaIn.math_level = FIXED_MATH_LEVEL;
    metaIn.audience = coerceAudience(metaIn.audience);
    const sc = coerceInt(metaIn.session_count);
    if (sc != null) metaIn.session_count = sc;
    metaIn.target_chars_per_session = CHARS_PER_SESSION;
  }

  const commonIn = isRecord(raw.common) ? { ...raw.common } : {};
  if (typeof commonIn.narrative_arc !== "string" || !commonIn.narrative_arc.trim()) {
    commonIn.narrative_arc = params
      ? `${params.theme}を${params.session_count}回で学ぶ`
      : "講義全体の物語線";
  }
  if (typeof commonIn.tone !== "string" || !commonIn.tone.trim()) {
    commonIn.tone = "単一講師・落ち着いた説明";
  }

  const theme =
    params?.theme ??
    (typeof metaIn.theme === "string" && metaIn.theme.trim() ? metaIn.theme.trim() : "講義");
  const sectionChars = sectionCharsForSession(params);
  const sessionCount = coerceInt(metaIn.session_count) ?? params?.session_count ?? 1;

  let sessionsRaw: unknown = raw.sessions;
  if (isRecord(sessionsRaw)) {
    sessionsRaw = Object.values(sessionsRaw);
  }
  const mapped = Array.isArray(sessionsRaw)
    ? sessionsRaw.map((s, i) => {
        if (!isRecord(s)) return defaultSession(i + 1, theme, sectionChars);
        const session_no =
          coerceInt(s.session_no) ??
          coerceInt(s.number) ??
          coerceInt(s.session_number) ??
          coerceInt(s.no) ??
          i + 1;
        const title =
          pickString(s, ["title", "name"]) || `${theme} — 第${session_no}回`;
        const continuity_in =
          strOptional(s.continuity_in, 600) ||
          (session_no === 1 ? "前提知識なしから開始" : `第${session_no - 1}回までの内容を踏まえる`);
        const continuity_out =
          strOptional(s.continuity_out, 600) || `第${session_no}回の到達点を説明できる`;
        return {
          ...s,
          session_no,
          title,
          continuity_in,
          continuity_out,
          objectives: Array.isArray(s.objectives)
            ? s.objectives.filter((x): x is string => typeof x === "string").slice(0, 8)
            : [],
          keywords: Array.isArray(s.keywords)
            ? s.keywords.filter((x): x is string => typeof x === "string").slice(0, 20)
            : [],
          foreshadow_ids: Array.isArray(s.foreshadow_ids)
            ? s.foreshadow_ids.filter((x): x is string => typeof x === "string")
            : [],
          payoff_ids: Array.isArray(s.payoff_ids)
            ? s.payoff_ids.filter((x): x is string => typeof x === "string")
            : [],
          source_refs: Array.isArray(s.source_refs)
            ? s.source_refs.filter((x): x is string => typeof x === "string")
            : [],
          sections: normalizeSections(s.sections, session_no, theme, sectionChars),
          visual_slots: normalizeVisualSlots(s.visual_slots, session_no, theme),
        };
      })
    : [];

  const sessions: SessionMaster[] = [];
  for (let n = 1; n <= sessionCount; n++) {
    const found = mapped.find((s) => isRecord(s) && coerceInt(s.session_no) === n);
    if (isRecord(found)) {
      sessions.push({
        session_no: n,
        title: pickString(found, ["title", "name"]) || `${theme} — 第${n}回`,
        objectives: Array.isArray(found.objectives)
          ? found.objectives.filter((x): x is string => typeof x === "string").slice(0, 8)
          : [],
        keywords: Array.isArray(found.keywords)
          ? found.keywords.filter((x): x is string => typeof x === "string").slice(0, 20)
          : [],
        continuity_in:
          strOptional(found.continuity_in, 600) ||
          (n === 1 ? "前提知識なしから開始" : `第${n - 1}回までの内容を踏まえる`),
        continuity_out:
          strOptional(found.continuity_out, 600) || `第${n}回の到達点を説明できる`,
        foreshadow_ids: Array.isArray(found.foreshadow_ids)
          ? found.foreshadow_ids.filter((x): x is string => typeof x === "string")
          : [],
        payoff_ids: Array.isArray(found.payoff_ids)
          ? found.payoff_ids.filter((x): x is string => typeof x === "string")
          : [],
        hero_image_prompt:
          pickString(found, ["hero_image_prompt", "session_image_prompt", "cover_prompt"]) ||
          undefined,
        visual_slots: normalizeVisualSlots(found.visual_slots, n, theme),
        sections: normalizeSections(found.sections, n, theme, sectionChars),
        source_refs: Array.isArray(found.source_refs)
          ? found.source_refs.filter((x): x is string => typeof x === "string")
          : [],
      });
    } else {
      sessions.push(defaultSession(n, theme, sectionChars));
    }
  }

  const foreshadow_registry = normalizeForeshadowRegistry(
    raw.foreshadow_registry,
    sessionCount,
    theme,
  );

  return {
    ...raw,
    schema_version: raw.schema_version ?? 1,
    meta: metaIn,
    common: commonIn,
    sessions,
    foreshadow_registry,
    sources: isRecord(raw.sources)
      ? raw.sources
      : { locked: false, items: [] },
  };
}

export function parseCourseMaster(raw: unknown, opts?: ParseCourseMasterOptions): ParseResult {
  const normalized = normalizeCourseMasterInput(raw, opts?.params);
  const errors: string[] = [];
  if (!isRecord(normalized)) return { ok: false, errors: ["root must be object"] };
  if (normalized.schema_version !== 1) errors.push("schema_version must be 1");

  const metaIn = isRecord(normalized.meta) ? normalized.meta : {};
  const theme = str(metaIn.theme, "meta.theme", errors, 500);
  const audience = coerceAudience(metaIn.audience);
  const math_level = FIXED_MATH_LEVEL;
  const target_outcome =
    str(metaIn.target_outcome, "meta.target_outcome", errors, 2000) ?? theme ?? "";
  let session_count = posInt(metaIn.session_count, "meta.session_count", errors);
  if (
    session_count != null &&
    (session_count < MIN_SESSION_COUNT || session_count > MAX_SESSION_COUNT)
  ) {
    errors.push(
      `meta.session_count must be ${MIN_SESSION_COUNT}..${MAX_SESSION_COUNT}`,
    );
  }

  const commonIn = isRecord(normalized.common) ? normalized.common : {};
  const narrative_arc = str(commonIn.narrative_arc, "common.narrative_arc", errors, 2000);
  const tone = str(commonIn.tone, "common.tone", errors, 1000) ?? "単一講師・落ち着いた説明";

  const sessionsRaw = Array.isArray(normalized.sessions) ? normalized.sessions : [];

  if (session_count && sessionsRaw.length !== session_count) {
    errors.push(`sessions.length must equal session_count (${session_count})`);
  }

  const foreshadow_registry: Foreshadow[] = Array.isArray(normalized.foreshadow_registry)
    ? normalized.foreshadow_registry
        .filter(isRecord)
        .map((f, i) => ({
          id: pickString(f, ["id", "foreshadow_id", "name"]) || `fs_${i + 1}`,
          introduced_session:
            coerceInt(f.introduced_session) ??
            coerceInt(f.introduced_in) ??
            coerceInt(f.intro_session) ??
            1,
          resolved_session:
            coerceInt(f.resolved_session) ??
            coerceInt(f.resolved_in) ??
            coerceInt(f.resolve_session) ??
            session_count ??
            1,
          description:
            pickString(f, ["description", "summary", "note", "text"]) ||
            `${theme ?? "講義"}の伏線${i + 1}`,
        }))
    : [];

  if (foreshadow_registry.length === 0 && session_count && theme) {
    foreshadow_registry.push({
      id: "fs_main",
      introduced_session: 1,
      resolved_session: session_count,
      description: `${theme}の核心`,
    });
  }

  const sessions: SessionMaster[] = [];
  for (const s of sessionsRaw) {
    if (!isRecord(s)) continue;
    const session_no = posInt(s.session_no, "session.session_no", errors);
    const title = str(s.title, "session.title", errors, 300);
    if (!session_no || !title) continue;

    const objectives = Array.isArray(s.objectives)
      ? s.objectives.filter((x): x is string => typeof x === "string").slice(0, 8)
      : [];
    const keywords = Array.isArray(s.keywords)
      ? s.keywords.filter((x): x is string => typeof x === "string").slice(0, 20)
      : [];
    const continuity_in = strOptional(s.continuity_in, 600);
    const continuity_out = strOptional(s.continuity_out, 600);
    const foreshadow_ids = Array.isArray(s.foreshadow_ids)
      ? s.foreshadow_ids.filter((x): x is string => typeof x === "string")
      : [];
    const payoff_ids = Array.isArray(s.payoff_ids)
      ? s.payoff_ids.filter((x): x is string => typeof x === "string")
      : [];
    const source_refs = Array.isArray(s.source_refs)
      ? s.source_refs.filter((x): x is string => typeof x === "string")
      : [];

    const sections = normalizeSections(
      s.sections,
      session_no,
      theme ?? "講義",
      sectionCharsForSession(opts?.params),
    );

    const visual_slots: VisualSlot[] = Array.isArray(s.visual_slots)
      ? normalizeVisualSlots(s.visual_slots, session_no, theme ?? "講義")
      : [];
    const hero_image_prompt =
      pickString(s, ["hero_image_prompt", "session_image_prompt", "cover_prompt"]) ||
      undefined;

    sessions.push({
      session_no,
      title,
      objectives,
      keywords,
      continuity_in,
      continuity_out,
      foreshadow_ids,
      payoff_ids,
      hero_image_prompt,
      visual_slots,
      sections,
      source_refs,
    });
  }

  const sourcesIn = isRecord(normalized.sources) ? normalized.sources : {};
  const items: SourceRef[] = [];
  if (Array.isArray(sourcesIn.items)) {
    for (const it of sourcesIn.items) {
      if (!isRecord(it)) continue;
      const source_id = str(it.source_id, "source.source_id", errors, 120);
      const kind = it.kind;
      const stitle = str(it.title, "source.title", errors, 500);
      const kinds = ["upload", "wikipedia", "url"] as const;
      const session_refs = Array.isArray(it.session_refs)
        ? it.session_refs.filter((n): n is number => typeof n === "number")
        : [];
      if (source_id && stitle && kinds.includes(kind as (typeof kinds)[number])) {
        items.push({
          source_id,
          kind: kind as SourceRef["kind"],
          title: stitle,
          session_refs,
        });
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const master: CourseMaster = {
    schema_version: 1,
    meta: {
      theme: theme!,
      audience,
      math_level,
      target_outcome: target_outcome!,
      session_count: session_count!,
      target_chars_per_session: CHARS_PER_SESSION,
    },
    common: {
      narrative_arc: narrative_arc ?? "",
      tone: tone,
      prerequisites_stated: Array.isArray(commonIn.prerequisites_stated)
        ? commonIn.prerequisites_stated.filter((x): x is string => typeof x === "string")
        : [],
      glossary: Array.isArray(commonIn.glossary)
        ? commonIn.glossary
            .filter(isRecord)
            .map((g) => ({
              term: String(g.term ?? ""),
              definition: String(g.definition ?? ""),
            }))
            .filter((g) => g.term)
        : [],
    },
    sources: { locked: Boolean(sourcesIn.locked), items },
    foreshadow_registry,
    sessions: sessions.sort((a, b) => a.session_no - b.session_no),
  };

  return { ok: true, master };
}

export function extractJsonFromLlm(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let body = fence ? fence[1]!.trim() : trimmed;
  // 出力上限などで閉じフェンスだけ欠けても、完結した JSON 本体は救済する。
  body = body.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(body);
  } catch (error) {
    const objectStart = body.indexOf("{");
    const objectEnd = body.lastIndexOf("}");
    const arrayStart = body.indexOf("[");
    const arrayEnd = body.lastIndexOf("]");
    const candidates = [
      objectStart >= 0 && objectEnd > objectStart ? body.slice(objectStart, objectEnd + 1) : "",
      arrayStart >= 0 && arrayEnd > arrayStart ? body.slice(arrayStart, arrayEnd + 1) : "",
    ].filter(Boolean);
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        // Try the next complete JSON-looking region.
      }
    }
    throw error;
  }
}
