"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CourseTraceSummary } from "@/lib/course-maker/course-trace";
import {
  formatMs,
  formatUsd,
  type ProcessingLogEvent,
} from "@/lib/course-maker/course-admin-view";
import { LazyCourseVisual } from "./LazyCourseVisual";

export function AdminTierBlock({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="cm-admin-tier" open={defaultOpen}>
      <summary className="cm-admin-tier-title">{title}</summary>
      <div className="cm-admin-tier-body">{children}</div>
    </details>
  );
}

export function AdminSubBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cm-admin-sub">
      <h3 className="cm-admin-sub-title">{title}</h3>
      <div className="cm-admin-sub-body">{children}</div>
    </section>
  );
}

export function AdminSettingsTable({ rows }: { rows: Array<{ label: string; value: string }> }) {
  if (rows.length === 0) return <p className="cm-muted">未設定</p>;
  return (
    <table className="cm-table cm-admin-settings">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th>{r.label}</th>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LlmExchangeBlock({
  label,
  ev,
  defaultOpen = false,
}: {
  label: string;
  ev: ProcessingLogEvent | null;
  defaultOpen?: boolean;
}) {
  if (!ev) return <p className="cm-muted">{label}：まだ生成されていません。</p>;
  return (
    <div className="cm-admin-llm">
      <p className="cm-admin-llm-label">{label}</p>
      <div className="cm-admin-log-meta">
        {ev.model_id && <span>モデル: {ev.model_id}</span>}
        {ev.provider && <span>経路: {ev.provider}</span>}
        <span>
          トークン: {ev.prompt_tokens} 入力 / {ev.completion_tokens} 出力
        </span>
        <span>処理時間: {formatMs(ev.latency_ms)}</span>
        <span>料金: {formatUsd(ev.cost_usd)}</span>
        <span>{new Date(ev.created_at).toLocaleString("ja-JP")}</span>
      </div>
      <ExpandableText label="指示（system）" text={ev.system_prompt} defaultOpen={defaultOpen} />
      <ExpandableText label="指示（user）" text={ev.user_prompt} defaultOpen={defaultOpen} />
      <ExpandableText
        label={ev.phase === "tier2_image" ? "応答（画像）" : "応答"}
        text={
          ev.phase === "tier2_image" && ev.response_text?.startsWith("data:image")
            ? null
            : ev.response_text
        }
        isImage={ev.phase === "tier2_image" && !!ev.response_text?.startsWith("data:image")}
        imageUrl={
          ev.phase === "tier2_image" && ev.response_text?.startsWith("data:image")
            ? ev.response_text
            : null
        }
        defaultOpen={defaultOpen}
      />
    </div>
  );
}

export function ExpandableText({
  label,
  text,
  defaultOpen = false,
  isImage = false,
  imageUrl = null,
}: {
  label: string;
  text: string | null;
  defaultOpen?: boolean;
  isImage?: boolean;
  imageUrl?: string | null;
}) {
  if (!text && !imageUrl) return null;
  if (isImage && imageUrl) {
    return (
      <details className="cm-admin-expand" open={defaultOpen}>
        <summary>{label}</summary>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={label} className="cm-admin-preview-img" />
      </details>
    );
  }
  return (
    <details className="cm-admin-expand" open={defaultOpen}>
      <summary>
        {label}
        {text ? `（${text.length.toLocaleString()}字）` : ""}
      </summary>
      <pre className="cm-pre cm-pre-sm">{text}</pre>
    </details>
  );
}

export function ProcessingLogSummary({
  cost_usd,
  latency_ms,
  extra,
}: {
  cost_usd: number;
  latency_ms: number;
  extra?: string;
}) {
  return (
    <div className="cm-admin-log-summary">
      <span>
        料金合計: <strong>{formatUsd(cost_usd)}</strong>
      </span>
      <span>
        処理時間合計: <strong>{formatMs(latency_ms)}</strong>
      </span>
      {extra && <span className="cm-muted">{extra}</span>}
    </div>
  );
}

export function LlmTotalsBar({
  summary,
  imageCompare,
}: {
  summary: CourseTraceSummary | null;
  imageCompare?: {
    text_cost_usd: number;
    text_latency_ms: number;
    patterns: Array<{
      key: string;
      label: string;
      model_id: string;
      quality: string;
      image_count: number;
      image_cost_usd: number;
      image_latency_ms: number;
      course_total_cost_usd: number;
      course_total_latency_ms: number;
      source: "trace" | "historical";
      highlighted?: boolean;
    }>;
    mid_course_total: {
      course_total_cost_usd: number;
      course_total_latency_ms: number;
      image_cost_usd: number;
      image_latency_ms: number;
      image_count: number;
      label: string;
    } | null;
  } | null;
}) {
  const mid = imageCompare?.mid_course_total ?? null;
  return (
    <div className="cm-admin-totals">
      {mid ? (
        <p style={{ margin: 0 }}>
          画像を Mid（gpt-image-2）にしたときの合計: 料金{" "}
          <strong>{formatUsd(mid.course_total_cost_usd)}</strong> · 処理時間{" "}
          <strong>{formatMs(mid.course_total_latency_ms)}</strong>
          <span className="cm-muted">
            {" "}
            （構成＋本文＋画像 {mid.image_count}枚 {formatUsd(mid.image_cost_usd)} /{" "}
            {formatMs(mid.image_latency_ms)}）
          </span>
        </p>
      ) : summary && summary.event_count > 0 ? (
        <p style={{ margin: 0 }}>
          講座全体（モデル呼び出し累積）: 料金 <strong>{formatUsd(summary.total_cost_usd)}</strong> ·
          処理時間 <strong>{formatMs(summary.total_latency_ms)}</strong> · {summary.event_count} 回
        </p>
      ) : null}

      {imageCompare && imageCompare.patterns.length > 0 && (
        <div style={{ marginTop: "0.65rem" }}>
          <p className="cm-muted" style={{ margin: "0 0 0.35rem" }}>
            画像3パターン比較（テキスト共通: {formatUsd(imageCompare.text_cost_usd)} /{" "}
            {formatMs(imageCompare.text_latency_ms)}）
          </p>
          <table className="cm-admin-settings" style={{ width: "100%", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th align="left">パターン</th>
                <th align="right">画像料金</th>
                <th align="right">画像時間</th>
                <th align="right">講座合計（料金）</th>
                <th align="right">講座合計（時間）</th>
              </tr>
            </thead>
            <tbody>
              {imageCompare.patterns.map((p) => (
                <tr
                  key={p.key}
                  style={
                    p.highlighted
                      ? { background: "rgba(40, 120, 80, 0.12)", fontWeight: 600 }
                      : undefined
                  }
                >
                  <td>
                    {p.label}
                    {p.source === "historical" ? "（実績・履歴）" : ""}
                    {p.highlighted ? " ← 現表示" : ""}
                  </td>
                  <td align="right">{formatUsd(p.image_cost_usd)}</td>
                  <td align="right">{formatMs(p.image_latency_ms)}</td>
                  <td align="right">{formatUsd(p.course_total_cost_usd)}</td>
                  <td align="right">{formatMs(p.course_total_latency_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && summary.event_count > 0 && !mid && Object.keys(summary.by_phase).length > 0 && (
        <p className="cm-muted" style={{ margin: "0.35rem 0 0" }}>
          内訳:{" "}
          {Object.entries(summary.by_phase)
            .map(([phase, v]) => {
              const phaseLabel: Record<string, string> = {
                tier1_outline: "講座構成",
                tier2_section: "文書",
                tier2_image: "画像",
                chat: "チャット",
              };
              return `${phaseLabel[phase] ?? phase} ${v.count}回 ${formatUsd(v.cost_usd)} / ${formatMs(v.latency_ms)}`;
            })
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

export function LearnerPreview({
  markdown,
  imageUrl,
  imagePrompt,
  lazyVisual,
}: {
  markdown: string | null;
  imageUrl?: string | null;
  imagePrompt: string | null;
  /** slim GET 後に画像本体だけ遅延取得 */
  lazyVisual?: {
    courseId: string;
    sessionNo: number;
    sectionNo: number;
    hasArtifact: boolean;
  } | null;
}) {
  return (
    <div className="cm-admin-learner-preview">
      {lazyVisual ? (
        <div className="cm-admin-learner-visual">
          <LazyCourseVisual
            courseId={lazyVisual.courseId}
            sessionNo={lazyVisual.sessionNo}
            sectionNo={lazyVisual.sectionNo}
            hasArtifact={lazyVisual.hasArtifact}
            alt={imagePrompt ?? "図解"}
            emptyLabel="画像: 未生成"
          />
          {imagePrompt && <p className="cm-muted">{imagePrompt}</p>}
        </div>
      ) : imageUrl ? (
        <div className="cm-admin-learner-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imagePrompt ?? "図解"} />
          {imagePrompt && <p className="cm-muted">{imagePrompt}</p>}
        </div>
      ) : (
        <p className="cm-muted">画像: 未生成</p>
      )}
      {markdown ? (
        <div className="cm-body cm-admin-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      ) : (
        <p className="cm-muted">講義文: 未生成</p>
      )}
    </div>
  );
}
