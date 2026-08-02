"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type TraceRow = {
  id: string;
  phase: string;
  step_key: string;
  model_id?: string | null;
  provider?: string | null;
  latency_ms?: number;
  cost_usd?: number | null;
  created_at: string;
  meta?: Record<string, unknown>;
  response_text?: string | null;
};

type SessionRow = {
  session_no: number;
  status: string;
  word_count?: number | null;
  generation_meta?: Record<string, unknown> | null;
  verification?: { status?: string } | null;
};

type VisualRow = {
  session_no: number;
  slot_id: string;
  status: string;
  artifact_url?: string | null;
  prompt?: string | null;
};

type CoursePayload = {
  course?: {
    id: string;
    title: string;
    status: string;
    params?: Record<string, unknown>;
    course_master?: {
      sessions?: Array<{
        session_no: number;
        title: string;
        hero_image_prompt?: string;
        sections?: Array<{
          section_no: number;
          heading: string;
          role?: string;
          image_source?: string;
          image_url?: string | null;
        }>;
      }>;
    } | null;
  };
  sessions?: SessionRow[];
  visuals?: VisualRow[];
  process_logs?: TraceRow[];
  llm_summary?: {
    total_cost_usd: number;
    total_latency_ms: number;
    event_count: number;
    by_phase: Record<string, { cost_usd: number; latency_ms: number; count: number }>;
  };
  error?: string;
};

function formatUsd(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function formatMs(ms?: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP");
}

function phaseLabel(phase: string) {
  switch (phase) {
    case "tier1_outline":
      return "構成";
    case "tier2_section":
      return "本文";
    case "tier2_image":
      return "画像";
    case "ui_display":
      return "画面";
    case "chat":
      return "チャット";
    default:
      return phase;
  }
}

export default function CourseRunTrackerPage() {
  const search = useSearchParams();
  const courseId = search.get("courseId")?.trim() ?? "";
  const [data, setData] = useState<CoursePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/courses/${courseId}?include_logs=1&include_artifacts=1`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as CoursePayload;
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!courseId) return;
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [courseId, load]);

  const course = data?.course;
  const sessions = data?.sessions ?? [];
  const visuals = data?.visuals ?? [];
  const logs = data?.process_logs ?? [];
  const summary = data?.llm_summary;

  const recentLogs = useMemo(
    () => [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [logs],
  );

  const byPhase = useMemo(() => {
    const out = new Map<string, TraceRow[]>();
    for (const row of recentLogs) {
      const list = out.get(row.phase) ?? [];
      list.push(row);
      out.set(row.phase, list);
    }
    return out;
  }, [recentLogs]);

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "1.5rem 1rem 3rem",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#172033",
        background: "linear-gradient(180deg,#f4f0e8,#e7edf2)",
        minHeight: "100%",
        boxSizing: "border-box",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", opacity: 0.7 }}>
        SAMPLE · COURSE RUN TRACKER
      </p>
      <h1 style={{ margin: "0.35rem 0 0.5rem", fontSize: "1.55rem" }}>
        講義生成トラッキング
      </h1>
      <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
        進行中の状態、各ステップの成果物、時間・料金をまとめて追跡する画面です。将来の講師ダッシュボード想定のたたき台です。
      </p>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/lab">← 実験室トップ</Link>
      </p>

      {!courseId ? (
        <div style={{ background: "#fff", padding: "1rem", borderTop: "3px solid #173f5f" }}>
          <p style={{ margin: 0 }}>
            `courseId` クエリが必要です。例: <code>/lab/course-run-tracker?courseId=...</code>
          </p>
        </div>
      ) : null}

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {course ? (
        <>
          <section
            style={{
              background: "rgba(255,255,255,0.92)",
              borderTop: "3px solid #173f5f",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <p style={{ margin: "0 0 0.4rem" }}>
              <strong>{course.title}</strong> · status={course.status}
              {loading ? " · 更新中…" : ""}
            </p>
            <p style={{ margin: "0 0 0.75rem", color: "#475569", fontSize: "0.85rem" }}>
              courseId: <code>{course.id}</code>
            </p>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <Link href={`/courses/${course.id}`} style={{ color: "#1d4ed8" }}>
                管理画面
              </Link>
              <Link href={`/courses/${course.id}/learn`} style={{ color: "#1d4ed8" }}>
                受講画面
              </Link>
              <button type="button" onClick={() => void load()}>
                今すぐ再読込
              </button>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ background: "#fff", padding: "0.85rem" }}>
              <strong>総コスト</strong>
              <div>{formatUsd(summary?.total_cost_usd)}</div>
            </div>
            <div style={{ background: "#fff", padding: "0.85rem" }}>
              <strong>総時間</strong>
              <div>{formatMs(summary?.total_latency_ms)}</div>
            </div>
            <div style={{ background: "#fff", padding: "0.85rem" }}>
              <strong>記録イベント</strong>
              <div>{summary?.event_count ?? 0}</div>
            </div>
            <div style={{ background: "#fff", padding: "0.85rem" }}>
              <strong>回数</strong>
              <div>{sessions.length}</div>
            </div>
          </section>

          <section style={{ background: "#fff", padding: "1rem", marginBottom: "1rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>進行状況</h2>
            <ul style={{ paddingLeft: "1.2rem", margin: 0, lineHeight: 1.7 }}>
              {sessions.map((s) => (
                <li key={s.session_no}>
                  第{s.session_no}回 · {s.status}
                  {s.word_count ? ` · ${s.word_count}字` : ""}
                  {s.verification?.status ? ` · 検証 ${s.verification.status}` : ""}
                </li>
              ))}
            </ul>
          </section>

          <section style={{ background: "#fff", padding: "1rem", marginBottom: "1rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>成果物まとめ</h2>
            {course.course_master?.sessions?.map((s) => {
              const hero = visuals.find((v) => v.slot_id === `hero_s${s.session_no}`);
              return (
                <details key={s.session_no} style={{ marginBottom: "0.75rem" }}>
                  <summary>
                    第{s.session_no}回 {s.title}
                  </summary>
                  <div style={{ marginTop: "0.5rem", fontSize: "0.84rem", lineHeight: 1.65 }}>
                    <div>ヒーロー画像: {hero?.status ?? "pending"}</div>
                    <div>
                      ヒーロープロンプト:
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          background: "#f8fafc",
                          padding: "0.6rem",
                          overflow: "auto",
                        }}
                      >
                        {s.hero_image_prompt || "（なし）"}
                      </pre>
                    </div>
                    <ul style={{ paddingLeft: "1.2rem" }}>
                      {(s.sections ?? []).map((sec) => (
                        <li key={sec.section_no}>
                          §{sec.section_no} {sec.heading}
                          {sec.role ? ` · ${sec.role}` : ""}
                          {sec.image_source ? ` · image=${sec.image_source}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              );
            })}
          </section>

          <section style={{ background: "#fff", padding: "1rem", marginBottom: "1rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>料金・時間の内訳</h2>
            <ul style={{ paddingLeft: "1.2rem", margin: 0, lineHeight: 1.7 }}>
              {Object.entries(summary?.by_phase ?? {}).map(([phase, row]) => (
                <li key={phase}>
                  {phaseLabel(phase)} · {row.count}件 · {formatUsd(row.cost_usd)} ·{" "}
                  {formatMs(row.latency_ms)}
                </li>
              ))}
            </ul>
          </section>

          <section style={{ background: "#fff", padding: "1rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>ステップログ</h2>
            {Array.from(byPhase.entries()).map(([phase, rows]) => (
              <details key={phase} style={{ marginBottom: "0.8rem" }} open={phase !== "ui_display"}>
                <summary>
                  {phaseLabel(phase)} ({rows.length})
                </summary>
                <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.6rem" }}>
                  {rows.map((row) => (
                    <div key={row.id} style={{ border: "1px solid #e2e8f0", padding: "0.7rem" }}>
                      <div style={{ fontSize: "0.77rem", color: "#475569", marginBottom: "0.35rem" }}>
                        {formatDate(row.created_at)} · {row.step_key} · {row.model_id ?? "—"} ·{" "}
                        {formatUsd(row.cost_usd)} · {formatMs(row.latency_ms)}
                      </div>
                      {row.response_text ? (
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontSize: "0.78rem",
                            background: "#f8fafc",
                            padding: "0.6rem",
                            overflow: "auto",
                            maxHeight: 220,
                          }}
                        >
                          {row.response_text}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
