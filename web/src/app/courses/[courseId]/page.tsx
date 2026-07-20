"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CourseMaster, CourseParams } from "@/lib/course-maker/course-master-schema";
import type { VerificationResult } from "@/lib/course-maker/verify-course-master";
import { verifyCourseMaster } from "@/lib/course-maker/verify-course-master";
import type { Tier2OutputMode } from "@/lib/course-maker/course-dev";
import type { CourseTraceSummary, ImagePatternCompareRow } from "@/lib/course-maker/course-trace";
import {
  formatCourseParamsForAdmin,
  getSectionMarkdown,
  indexSectionLogs,
  masterSectionSettings,
  chatLogEvents,
  chatLogSummary,
  groupChatLogsBySession,
  tier1LogEvents,
  tier1LogSummary,
  visualForSection,
  visualHasArtifact,
  formatMs,
  formatUsd,
  type ProcessingLogEvent,
  type VisualRow,
} from "@/lib/course-maker/course-admin-view";
import { putVisualArtifact } from "@/lib/course-maker/course-visual-client";
import {
  AdminSettingsTable,
  AdminSubBlock,
  AdminTierBlock,
  ExpandableText,
  LearnerPreview,
  LlmExchangeBlock,
  LlmTotalsBar,
  ProcessingLogSummary,
} from "../_components/course-admin-ui";
type Course = {
  id: string;
  title: string;
  status: string;
  params: CourseParams;
  course_master: CourseMaster | null;
  admin_memo?: string;
};

type Session = {
  session_no: number;
  status: string;
  word_count: number | null;
  markdown_body: string | null;
  verification: VerificationResult | null;
};

async function readJsonSafe<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "応答の解析に失敗しました"
        : `API ${res.status}: ページが見つかりません（サーバー再起動が必要な場合があります）`,
    );
  }
}

function CheckList({ v }: { v: VerificationResult | null }) {
  if (!v) return null;
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p className="cm-muted" style={{ marginBottom: "0.35rem" }}>
        講座構成の機械チェック（構成整合性）
      </p>
      {v.checks.map((c) => (
        <div
          key={c.id}
          className={`cm-check ${c.pass ? "cm-check-pass" : c.severity === "warn" ? "cm-check-warn" : "cm-check-fail"}`}
        >
          {c.pass ? "✓" : "✗"} {c.message_ja}
          {!c.pass && c.severity === "warn" && <span className="cm-muted"> （警告のみ・承認可）</span>}
          {!c.pass && c.severity === "error" && <span className="cm-muted"> （要修正）</span>}
        </div>
      ))}
    </div>
  );
}

function isPlaceholderIntent(intent: string): boolean {
  return /の部分テーマ\d+$/.test(intent);
}

export default function CourseAdminPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [visuals, setVisuals] = useState<VisualRow[]>([]);
  const [logs, setLogs] = useState<ProcessingLogEvent[]>([]);
  const [llmSummary, setLlmSummary] = useState<CourseTraceSummary | null>(null);
  const [imageCompare, setImageCompare] = useState<{
    text_cost_usd: number;
    text_latency_ms: number;
    patterns: ImagePatternCompareRow[];
    mid_course_total: ImagePatternCompareRow | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sectionBusy, setSectionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outlineVerification, setOutlineVerification] = useState<VerificationResult | null>(null);
  const [showMasterJson, setShowMasterJson] = useState(false);
  const [adminMemo, setAdminMemo] = useState("");
  const [memoBusy, setMemoBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const courseRes = await fetch(`/api/courses/${courseId}?include_logs=1`);
      const json = await readJsonSafe<{
        course?: Course;
        sessions?: Session[];
        visuals?: VisualRow[];
        process_logs?: ProcessingLogEvent[];
        llm_summary?: CourseTraceSummary;
        image_pattern_compare?: {
          text_cost_usd: number;
          text_latency_ms: number;
          patterns: ImagePatternCompareRow[];
          mid_course_total: ImagePatternCompareRow | null;
        };
        error?: string;
      }>(courseRes);
      if (!courseRes.ok) throw new Error(json.error ?? courseRes.statusText);
      setCourse(json.course ?? null);
      setAdminMemo(json.course?.admin_memo ?? "");
      setSessions(json.sessions ?? []);
      setVisuals(json.visuals ?? []);
      setLogs(json.process_logs ?? []);
      setLlmSummary(json.llm_summary ?? null);
      setImageCompare(json.image_pattern_compare ?? null);
      if (json.course?.course_master) {
        setOutlineVerification(verifyCourseMaster(json.course.course_master as CourseMaster));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(label: string, url: string, body?: unknown) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body != null ? { "Content-Type": "application/json" } : undefined,
        body: body != null ? JSON.stringify(body) : undefined,
      });
      const json = await readJsonSafe<{ error?: string; verification?: VerificationResult }>(res);
      if (!res.ok) {
        if (json.verification) setOutlineVerification(json.verification);
        throw new Error(json.error ?? res.statusText);
      }
      if (json.verification) setOutlineVerification(json.verification);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function generateSection(session_no: number, section_no: number, output: Tier2OutputMode) {
    const key = `s${session_no}_sec${section_no}`;
    setSectionBusy(key);
    setError(null);
    try {
      if (output === "image") {
        const res = await fetch(`/api/courses/${courseId}/visuals/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_no, section_no }),
        });
        const json = await readJsonSafe<{
          error?: string;
          visual?: { artifact_url?: string | null };
        }>(res);
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (json.visual?.artifact_url) {
          putVisualArtifact(courseId, session_no, section_no, json.visual.artifact_url);
        }
      } else {
        const res = await fetch(`/api/courses/${courseId}/sessions/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipeline: false, session_no, section_no, output }),
        });
        const json = await readJsonSafe<{ error?: string }>(res);
        if (!res.ok) throw new Error(json.error ?? res.statusText);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSectionBusy(null);
    }
  }

  async function saveAdminMemo() {
    setMemoBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_memo: adminMemo }),
      });
      const json = await readJsonSafe<{ error?: string; course?: Course }>(res);
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      if (json.course) setCourse(json.course);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMemoBusy(false);
    }
  }

  if (loading) return <p className="cm-muted">読み込み中…</p>;
  if (!course) return <div className="cm-error">講習が見つかりません</div>;

  const master = course.course_master;
  const params = course.params;
  const courseLogs = tier1LogEvents(logs);
  const courseLogSummary = tier1LogSummary(logs);
  const sectionLogs = indexSectionLogs(logs);
  const chatLogs = chatLogEvents(logs);
  const chatSummary = chatLogSummary(logs);
  const chatBySession = groupChatLogsBySession(logs);
  const verificationBlocksApprove = outlineVerification?.status === "error";
  const canApprove =
    course.status === "outline_draft" && !!master && !verificationBlocksApprove;
  const canGenerateSessions =
    course.status === "outline_approved" || course.status === "generating" || course.status === "ready";
  const hasReadySession = sessions.some((s) => s.status === "ready");

  return (
    <>
      <div className="cm-admin-header">
        <div>
          <h1 className="cm-page-title">{course.title}</h1>
          <p className="cm-page-sub">
            講座管理 · ステータス:{" "}
            <span className={`cm-badge cm-badge-${course.status}`}>{course.status}</span>
          </p>
        </div>
        {hasReadySession && (
          <Link href={`/courses/${courseId}/learn`} className="cm-btn cm-btn-primary">
            受講画面を開く →
          </Link>
        )}
      </div>

      <LlmTotalsBar summary={llmSummary} imageCompare={imageCompare} />

      <div className="cm-card">
        <h2>講師スレッド</h2>
        <p className="cm-muted" style={{ marginTop: 0 }}>
          受講画面の講師チャットのみ。生成パイプラインの料金・時間とは合算しません。
        </p>
        {chatLogs.length === 0 ? (
          <p className="cm-muted">まだログがありません。</p>
        ) : (
          <>
            <ProcessingLogSummary
              cost_usd={chatSummary.total_cost_usd}
              latency_ms={chatSummary.total_latency_ms}
              extra={`${chatSummary.event_count} 回の応答 · Sonnet 等`}
            />
            {[...chatBySession.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([sessionNo, evs]) => (
                <details key={sessionNo} className="cm-admin-tier" open={sessionNo === 1}>
                  <summary className="cm-admin-tier-title">
                    第{sessionNo}回（{evs.length} 件）
                  </summary>
                  <div className="cm-admin-tier-body">
                    {evs.map((ev) => (
                      <div key={ev.id} style={{ marginBottom: "0.75rem" }}>
                        <div className="cm-admin-log-meta">
                          <span>モデル: {ev.model_id ?? "—"}</span>
                          <span>経路: {ev.provider ?? "—"}</span>
                          <span>
                            トークン: {ev.prompt_tokens} / {ev.completion_tokens}
                          </span>
                          <span>{formatMs(ev.latency_ms)}</span>
                          <span>{formatUsd(ev.cost_usd)}</span>
                          <span>{new Date(ev.created_at).toLocaleString("ja-JP")}</span>
                        </div>
                        <ExpandableText label="受講者" text={ev.user_prompt} />
                        <ExpandableText label="講師応答" text={ev.response_text} defaultOpen />
                      </div>
                    ))}
                  </div>
                </details>
              ))}
          </>
        )}
      </div>

      {error && <div className="cm-error">{error}</div>}

      <div className="cm-card">
        <h2>管理者用メモ</h2>
        <p className="cm-muted">
          講座の生成には影響しません。モデル比較・観点・気づきを残すためのメモです。
        </p>
        <textarea
          value={adminMemo}
          onChange={(e) => setAdminMemo(e.target.value)}
          rows={6}
          placeholder={"例:\n- 講座構成: gpt-4.1-mini\n- 文書: …\n- 画像: gpt-image-1-mini low / 漢字崩れ\n- 比較ポイント: 内容の深さ、日本語、料金"}
          style={{ width: "100%", fontFamily: "inherit", fontSize: "0.85rem" }}
        />
        <div className="cm-btn-row" style={{ marginBottom: 0 }}>
          <button type="button" className="cm-btn" disabled={memoBusy} onClick={() => void saveAdminMemo()}>
            {memoBusy ? "保存中…" : "メモを保存"}
          </button>
        </div>
      </div>

      <div className="cm-card cm-admin-actions">
        <h2>操作</h2>
        <div className="cm-btn-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="cm-btn cm-btn-primary"
            disabled={!!busy}
            onClick={() => runAction("outline", `/api/courses/${courseId}/outline/generate`)}
          >
            {busy === "outline" ? "生成中…" : "講座構成を生成"}
          </button>
          <button
            type="button"
            className="cm-btn"
            disabled={!!busy || !canApprove}
            onClick={() => runAction("approve", `/api/courses/${courseId}/outline/approve`)}
          >
            {busy === "approve" ? "承認中…" : "講座構成を承認"}
          </button>
          <button
            type="button"
            className="cm-btn"
            disabled={!!busy || !canGenerateSessions}
            onClick={() =>
              runAction("sessions", `/api/courses/${courseId}/sessions/generate`, { pipeline: true })
            }
          >
            {busy === "sessions" ? "生成中…" : "全回を一括生成"}
          </button>
        </div>
      </div>

      {/* ── 1）講座 ── */}
      <AdminTierBlock title="講座 — 設定・構成・作成">
        <AdminSubBlock title="管理者設定">
          <AdminSettingsTable rows={formatCourseParamsForAdmin(params)} />
        </AdminSubBlock>

        <AdminSubBlock title="LLMとのやりとり（指示プロンプト・回答）">
          {courseLogs.length === 0 ? (
            <p className="cm-muted">講座構成を生成すると、ここに指示と回答が記録されます。</p>
          ) : (
            courseLogs.map((ev) => (
              <LlmExchangeBlock key={ev.id} label={`講座構成の生成（${ev.step_key}）`} ev={ev} />
            ))
          )}
        </AdminSubBlock>

        <AdminSubBlock title="講座の構成（本文）">
          {!master ? (
            <p className="cm-muted">未生成です。「講座構成を生成」を実行してください。</p>
          ) : (
            <>
              <p className="cm-muted">
                {master.meta.session_count}回 · 1回 {master.meta.session_duration_min}分 · 目標{" "}
                {master.meta.target_chars_per_session}字/回
                {outlineVerification && (
                  <>
                    {" "}
                    · 構成チェック: <strong>{outlineVerification.status}</strong>
                  </>
                )}
              </p>
              <CheckList v={outlineVerification} />
              {master.sessions.map((s) => (
                <div key={s.session_no} className="cm-admin-session-outline">
                  <strong>
                    第{s.session_no}回: {s.title}
                  </strong>
                  <ul>
                    {s.sections.map((sec) => {
                      const placeholder = isPlaceholderIntent(sec.intent);
                      return (
                        <li key={sec.section_no}>
                          §{sec.section_no} {sec.heading}
                          {placeholder ? (
                            <span className="cm-muted">
                              {" "}
                              — （意図未指定・システム補完）{sec.intent}
                            </span>
                          ) : (
                            <span> — {sec.intent}</span>
                          )}
                          <span className="cm-muted">（{sec.target_chars}字）</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <button
                type="button"
                className="cm-btn"
                style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}
                onClick={() => setShowMasterJson((v) => !v)}
              >
                {showMasterJson ? "JSON を隠す" : "JSON を表示"}
              </button>
              {showMasterJson && <pre className="cm-pre">{JSON.stringify(master, null, 2)}</pre>}
            </>
          )}
        </AdminSubBlock>

        <AdminSubBlock title="ログ情報">
          {courseLogs.length === 0 ? (
            <p className="cm-muted">記録なし</p>
          ) : (
            <ProcessingLogSummary
              cost_usd={courseLogSummary.total_cost_usd}
              latency_ms={courseLogSummary.total_latency_ms}
              extra={`${courseLogs.length} 回の LLM 呼び出し`}
            />
          )}
        </AdminSubBlock>
      </AdminTierBlock>

      {/* ── 2）各回のセクション ── */}
      {master &&
        master.sessions.map((session) => {
          const sessionRow = sessions.find((s) => s.session_no === session.session_no);
          return (
            <div key={session.session_no} className="cm-admin-session-group">
              <h2 className="cm-admin-session-heading">
                第{session.session_no}回: {session.title}
                {sessionRow && (
                  <span className={`cm-badge cm-badge-${sessionRow.status === "ready" ? "ready" : "draft"}`}>
                    {sessionRow.status}
                  </span>
                )}
              </h2>
              {session.sections.map((section) => {
                const logKey = `s${session.session_no}_sec${section.section_no}`;
                const bundle = sectionLogs.get(logKey) ?? {
                  text: null,
                  image: null,
                  total_cost_usd: 0,
                  total_latency_ms: 0,
                };
                const visual = visualForSection(visuals, session.session_no, section.section_no);
                const sectionMd = getSectionMarkdown(
                  sessionRow?.markdown_body ?? null,
                  section.section_no,
                );
                const busyThis = sectionBusy === logKey;

                return (
                  <AdminTierBlock
                    key={logKey}
                    title={`第${session.session_no}回・セクション${section.section_no} — ${section.heading}`}
                    defaultOpen={session.session_no === 1 && section.section_no === 1}
                  >
                    <AdminSubBlock title="管理者設定">
                      <AdminSettingsTable
                        rows={masterSectionSettings(master, session.session_no, section.section_no)}
                      />
                      {canGenerateSessions && (
                        <div className="cm-admin-gen-row">
                          <span className="cm-muted">このページ（セクション）:</span>
                          <button
                            type="button"
                            className="cm-btn cm-btn-primary"
                            disabled={!!busy || !!sectionBusy}
                            onClick={() =>
                              generateSection(session.session_no, section.section_no, "text")
                            }
                          >
                            {busyThis ? "…" : "1. 文章＋画像プロンプト"}
                          </button>
                          <button
                            type="button"
                            className="cm-btn"
                            disabled={!!busy || !!sectionBusy || !visual?.prompt}
                            title={!visual?.prompt ? "先に画像プロンプトを生成してください" : undefined}
                            onClick={() =>
                              generateSection(session.session_no, section.section_no, "image")
                            }
                          >
                            2. このプロンプトで画像生成
                          </button>
                          <button
                            type="button"
                            className="cm-btn"
                            disabled={!!busy || !!sectionBusy}
                            onClick={() =>
                              generateSection(session.session_no, section.section_no, "both")
                            }
                          >
                            一括（文章→画像）
                          </button>
                        </div>
                      )}
                    </AdminSubBlock>

                    <AdminSubBlock title="セクション画用プロンプト（先にここを検証）">
                      {!visual?.prompt ? (
                        <p className="cm-muted">
                          未作成。ステータス: {visual?.status ?? "—"}
                          {visual?.error_message ? ` — ${visual.error_message}` : ""}
                        </p>
                      ) : (
                        <>
                          <p className="cm-muted">
                            ステータス: <strong>{visual.status}</strong>
                            {visual.error_message ? ` · 判断メモ: ${visual.error_message}` : ""}
                            {" · "}
                            生成パラメータ: 横長 1536×1024 · quality=low · 1枚
                          </p>
                          <ExpandableText
                            label="画像モデルに渡すプロンプト（検証対象）"
                            text={visual.prompt}
                            defaultOpen
                          />
                        </>
                      )}
                    </AdminSubBlock>

                    <AdminSubBlock title="LLMとのやりとり（指示プロンプト・回答）">
                      <LlmExchangeBlock label="文章＋画像プロンプトの生成（1コール）" ev={bundle.text} />
                      <LlmExchangeBlock
                        label="画像 API の実行"
                        ev={
                          bundle.image
                            ? {
                                ...bundle.image,
                                system_prompt: null,
                                user_prompt: bundle.image.user_prompt ?? visual?.prompt ?? null,
                                response_text: bundle.image.response_text ?? "（画像は下のプレビューで確認）",
                              }
                            : null
                        }
                      />
                    </AdminSubBlock>

                    <AdminSubBlock title="受講者画面（プレビュー）">
                      <LearnerPreview
                        markdown={sectionMd}
                        imagePrompt={visual?.prompt ?? null}
                        lazyVisual={{
                          courseId,
                          sessionNo: session.session_no,
                          sectionNo: section.section_no,
                          hasArtifact: visualHasArtifact(visual),
                        }}
                      />
                    </AdminSubBlock>

                    <AdminSubBlock title="ログ情報">
                      {bundle.text || bundle.image ? (
                        <ProcessingLogSummary
                          cost_usd={bundle.total_cost_usd}
                          latency_ms={bundle.total_latency_ms}
                          extra={[bundle.text ? "文章" : null, bundle.image ? "画像" : null]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                      ) : (
                        <p className="cm-muted">記録なし</p>
                      )}
                    </AdminSubBlock>
                  </AdminTierBlock>
                );
              })}
            </div>
          );
        })}

      {!master && (
        <p className="cm-muted" style={{ marginTop: "1rem" }}>
          講座構成を生成すると、各回・セクションの作成ブロックが表示されます。
        </p>
      )}
    </>
  );
}
