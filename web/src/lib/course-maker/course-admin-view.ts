import type { CourseMaster, CourseParams } from "./course-master-schema";
import {
  AUDIENCE_OPTIONS,
  MATH_LEVEL_OPTIONS,
  mathLevelLabel,
} from "./course-master-schema";
import type { CourseTraceRow, CourseTraceSummary } from "./course-trace";
import { summarizeTraces } from "./course-trace";

export type ProcessingLogEvent = {
  id: string;
  phase: string;
  step_key: string;
  model_id: string | null;
  provider: string | null;
  system_prompt: string | null;
  user_prompt: string | null;
  response_text: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  cost_usd: number | null;
  created_at: string;
};

export type SectionLogBundle = {
  text: ProcessingLogEvent | null;
  image: ProcessingLogEvent | null;
  total_cost_usd: number;
  total_latency_ms: number;
};

export function parseSectionStepKey(
  step_key: string,
): { session_no: number; section_no: number } | null {
  const m = step_key.match(/^s(\d+)_sec(\d+)/);
  if (!m) return null;
  return { session_no: Number(m[1]), section_no: Number(m[2]) };
}

export function sectionLogKey(session_no: number, section_no: number): string {
  return `s${session_no}_sec${section_no}`;
}

export function splitMarkdownBySections(markdown: string | null): string[] {
  if (!markdown?.trim()) return [];
  const parts: string[] = [];
  const re = /^## /gm;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) starts.push(m.index);
  if (starts.length === 0) return [markdown.trim()];
  for (let i = 0; i < starts.length; i++) {
    const slice = markdown.slice(starts[i], starts[i + 1]);
    if (slice.trim()) parts.push(slice.trim());
  }
  return parts;
}

export function getSectionMarkdown(
  sessionBody: string | null,
  section_no: number,
): string | null {
  const parts = splitMarkdownBySections(sessionBody);
  if (parts.length === 0) return null;
  return parts[section_no - 1] ?? null;
}

/**
 * 回の本文は ao_course_sessions.markdown_body に1本で保存する。
 * セクション単独生成時は、見出しで既存セクションを突き合わせて差し替える。
 */
export function mergeSessionMarkdown(opts: {
  existing: string | null;
  sectionNo: number;
  newMarkdown: string;
  sections: Array<{ section_no: number; heading: string }>;
}): string {
  const ordered = [...opts.sections].sort((a, b) => a.section_no - b.section_no);
  const byNo = new Map<number, string>();
  const parts = splitMarkdownBySections(opts.existing);
  const used = new Set<number>();

  for (const part of parts) {
    const m = /^##\s+(.+)$/m.exec(part);
    const heading = m?.[1]?.trim() ?? "";
    const matched = ordered.find((s) => s.heading === heading && !used.has(s.section_no));
    if (matched) {
      byNo.set(matched.section_no, part.trim());
      used.add(matched.section_no);
    }
  }

  // 見出し一致が無い古いデータ向け: 先頭から位置で埋める
  if (byNo.size === 0) {
    parts.forEach((p, i) => {
      const sec = ordered[i];
      if (sec) byNo.set(sec.section_no, p.trim());
    });
  }

  byNo.set(opts.sectionNo, opts.newMarkdown.trim());

  return ordered
    .map((s) => byNo.get(s.section_no)?.trim())
    .filter((p): p is string => !!p && p.length > 0)
    .join("\n\n");
}

export function indexSectionLogs(events: ProcessingLogEvent[]): Map<string, SectionLogBundle> {
  const map = new Map<string, SectionLogBundle>();

  function ensure(key: string): SectionLogBundle {
    let b = map.get(key);
    if (!b) {
      b = { text: null, image: null, total_cost_usd: 0, total_latency_ms: 0 };
      map.set(key, b);
    }
    return b;
  }

  // events は新しい順を想定: 最初の1件だけ採用
  for (const ev of events) {
    if (ev.phase === "tier2_section") {
      const parsed = parseSectionStepKey(ev.step_key);
      if (!parsed) continue;
      const b = ensure(sectionLogKey(parsed.session_no, parsed.section_no));
      if (!b.text) {
        b.text = ev;
        b.total_cost_usd += Number(ev.cost_usd ?? 0);
        b.total_latency_ms += ev.latency_ms ?? 0;
      }
    }
    if (ev.phase === "tier2_image") {
      const parsed = parseSectionStepKey(ev.step_key);
      if (!parsed) continue;
      const b = ensure(sectionLogKey(parsed.session_no, parsed.section_no));
      if (!b.image) {
        b.image = ev;
        b.total_cost_usd += Number(ev.cost_usd ?? 0);
        b.total_latency_ms += ev.latency_ms ?? 0;
      }
    }
  }

  for (const b of map.values()) {
    b.total_cost_usd = Math.round(b.total_cost_usd * 1e6) / 1e6;
  }
  return map;
}

export function formatCourseParamsForAdmin(params: CourseParams): Array<{ label: string; value: string }> {
  const audience = AUDIENCE_OPTIONS.find((o) => o.value === params.audience)?.label ?? params.audience;
  const learner =
    params.learner_level === "zero"
      ? "ゼロから"
      : params.learner_level === "beginner"
        ? "初級"
        : "中級";
  return [
    { label: "テーマ", value: params.theme },
    { label: "達成目標", value: params.target_outcome || "—" },
    { label: "回数", value: String(params.session_count) },
    { label: "1回あたり", value: `${params.session_duration_min}分` },
    { label: "受講者", value: audience },
    { label: "現在のレベル", value: learner },
    { label: "数学レベル", value: mathLevelLabel(params.math_level) },
    { label: "語学レベル", value: params.language_level },
  ];
}

export function tier1LogEvents(events: ProcessingLogEvent[]): ProcessingLogEvent[] {
  return events.filter((e) => e.phase === "tier1_outline");
}

export function tier1LogSummary(events: ProcessingLogEvent[]): CourseTraceSummary {
  return summarizeTraces(tier1LogEvents(events) as CourseTraceRow[], { llmOnly: true });
}

/** 講師チャットログのみ（生成合計とは別集計） */
export function chatLogEvents(events: ProcessingLogEvent[]): ProcessingLogEvent[] {
  return events.filter((e) => e.phase === "chat");
}

export function chatLogSummary(events: ProcessingLogEvent[]): CourseTraceSummary {
  return summarizeTraces(chatLogEvents(events) as CourseTraceRow[], { llmOnly: true });
}

export function groupChatLogsBySession(
  events: ProcessingLogEvent[],
): Map<number, ProcessingLogEvent[]> {
  const map = new Map<number, ProcessingLogEvent[]>();
  for (const ev of chatLogEvents(events)) {
    const m = ev.step_key.match(/chat_s(\d+)/);
    const sessionNo = m ? Number(m[1]) : 0;
    const list = map.get(sessionNo) ?? [];
    list.push(ev);
    map.set(sessionNo, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return map;
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 0.0001) return "<$0.0001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}秒`;
}

export type VisualRow = {
  slot_id: string;
  session_no: number;
  status: string;
  /** 一覧 GET では null。本体は /visuals?session_no&section_no で取得 */
  artifact_url: string | null;
  /** slim GET 時: DB に画像があるか */
  has_artifact?: boolean;
  prompt: string | null;
  image_model_id: string | null;
  error_message?: string | null;
};

export function visualHasArtifact(v: VisualRow | null | undefined): boolean {
  if (!v) return false;
  if (v.has_artifact) return true;
  return Boolean(v.artifact_url?.startsWith("data:image") || v.artifact_url?.startsWith("http"));
}

export function visualForSection(
  visuals: VisualRow[],
  session_no: number,
  section_no: number,
): VisualRow | null {
  const slotId = `vis_${session_no}_${section_no}`;
  return (
    visuals.find((v) => v.session_no === session_no && v.slot_id === slotId) ??
    visuals.find((v) => v.session_no === session_no && v.slot_id.endsWith(`_${section_no}`)) ??
    null
  );
}

export function masterSectionSettings(
  master: CourseMaster,
  session_no: number,
  section_no: number,
): Array<{ label: string; value: string }> {
  const session = master.sessions.find((s) => s.session_no === session_no);
  const section = session?.sections.find((s) => s.section_no === section_no);
  if (!session || !section) return [];
  return [
    { label: "回タイトル", value: session.title },
    { label: "セクション見出し", value: section.heading },
    { label: "意図（intent）", value: section.intent },
    { label: "目標文字数", value: `${section.target_chars}字` },
    { label: "回の導入文脈", value: session.continuity_in },
    { label: "回の締め文脈", value: session.continuity_out },
    { label: "到達目標", value: session.objectives.join(" / ") },
  ];
}
