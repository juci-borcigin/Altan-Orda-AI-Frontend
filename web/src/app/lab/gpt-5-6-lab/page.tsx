"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Metric = {
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  cost_usd: number | null;
};

type SessionPlan = {
  session_no: number;
  title: string;
  sections: Array<{
    section_no: number;
    role?: string;
    heading: string;
    target_chars: number;
  }>;
};

type OutlineResult = {
  label: string;
  model_id: string;
  master: { sessions: SessionPlan[] };
  raw: string | null;
  metric: Metric;
  verification: { status?: string } | null;
  section_counts: number[];
};

type SessionResult = {
  session_no: number;
  title: string;
  model_id: string;
  pages: Array<{
    section_no: number;
    heading: string;
    markdown: string;
    image_prompt: string | null;
    image_rationale: string | null;
  }>;
  metric: Metric;
  fallback_used: boolean;
  body_chars: number;
  target_chars: number;
  length_pass: boolean;
};

type PromptEvaluation = {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
};

type Manifest = {
  updated_at: string;
  course_title: string;
  params: Record<string, unknown>;
  logic: Record<string, string>;
  test1: {
    current: OutlineResult;
    terra: OutlineResult;
  } | null;
  test2: {
    current: Record<string, SessionResult>;
    luna: Record<string, SessionResult>;
    terra: Record<string, SessionResult>;
    evaluation: Partial<Record<"current" | "luna" | "terra", PromptEvaluation>>;
  } | null;
};

function formatCost(value: number | null) {
  return value == null ? "—" : `$${value.toFixed(4)}`;
}

function formatInteger(value: number) {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function aggregateSessions(results: Record<string, SessionResult>) {
  const values = Object.values(results);
  return {
    count: values.length,
    cost:
      values.some((result) => result.metric.cost_usd == null)
        ? null
        : values.reduce((sum, result) => sum + (result.metric.cost_usd ?? 0), 0),
    latency_ms: values.reduce((sum, result) => sum + result.metric.latency_ms, 0),
  };
}

function ResultColumn({ result }: { result: OutlineResult }) {
  return (
    <section
      style={{
        minWidth: 0,
        background: "rgba(255,255,255,0.86)",
        borderTop: "3px solid #173f5f",
        padding: "1rem",
      }}
    >
      <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem" }}>{result.label}</h2>
      <p style={{ margin: "0 0 0.8rem", fontSize: "0.75rem", color: "#64748b" }}>
        {result.model_id}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          gap: "0.5rem",
          marginBottom: "0.8rem",
        }}
      >
        <div style={{ background: "#eef3f7", padding: "0.65rem" }}>
          <strong>{formatCost(result.metric.cost_usd)}</strong>
          <br />
          <span style={{ fontSize: "0.75rem" }}>料金</span>
        </div>
        <div style={{ background: "#eef3f7", padding: "0.65rem" }}>
          <strong>{(result.metric.latency_ms / 1000).toFixed(1)}秒</strong>
          <br />
          <span style={{ fontSize: "0.75rem" }}>所要時間</span>
        </div>
      </div>
      <p style={{ fontSize: "0.75rem", color: "#475569", lineHeight: 1.5 }}>
        入力 {formatInteger(result.metric.prompt_tokens)} / 出力{" "}
        {formatInteger(result.metric.completion_tokens)} tokens
        <br />
        検証: {result.verification?.status ?? "—"}
        <br />
        セクション数: {result.section_counts.join(" / ")}
      </p>

      <h3 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem" }}>各回の構成</h3>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {result.master.sessions.map((session) => (
          <div
            key={session.session_no}
            style={{ border: "1px solid #d7dee6", padding: "0.65rem", background: "#fafbfc" }}
          >
            <strong style={{ fontSize: "0.8rem" }}>
              第{session.session_no}回 · {session.title}
            </strong>
            <ol style={{ margin: "0.45rem 0 0", paddingLeft: "1.3rem", fontSize: "0.75rem" }}>
              {session.sections.map((section) => (
                <li key={section.section_no} style={{ marginBottom: "0.2rem" }}>
                  {section.heading}（{section.target_chars}字
                  {section.role ? `・${section.role}` : ""}）
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", fontSize: "0.8rem" }}>回答JSON全文</summary>
        <pre
          style={{
            maxHeight: 900,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#f5f7f9",
            border: "1px solid #d7dee6",
            padding: "0.75rem",
            fontSize: "0.7rem",
            lineHeight: 1.5,
          }}
        >
          {result.raw ?? JSON.stringify(result.master, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function SessionColumn({
  label,
  result,
  evaluation,
}: {
  label: string;
  result?: SessionResult;
  evaluation?: PromptEvaluation;
}) {
  return (
    <section
      style={{
        minWidth: 0,
        background: "rgba(255,255,255,0.86)",
        borderTop: "3px solid #173f5f",
        padding: "0.9rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.2rem", fontSize: "0.95rem" }}>{label}</h3>
      {!result ? (
        <p style={{ color: "#64748b" }}>未生成</p>
      ) : (
        <>
          <p style={{ margin: "0 0 0.7rem", fontSize: "0.72rem", color: "#64748b" }}>
            {result.model_id}
            <br />
            {formatCost(result.metric.cost_usd)} ·{" "}
            {(result.metric.latency_ms / 1000).toFixed(1)}秒 · 入力{" "}
            {formatInteger(result.metric.prompt_tokens)} / 出力{" "}
            {formatInteger(result.metric.completion_tokens)} tokens
            <br />
            本文 {formatInteger(result.body_chars)}字 / 目標{" "}
            {formatInteger(result.target_chars)}字 ·{" "}
            <strong style={{ color: result.length_pass ? "#23613c" : "#a33a2b" }}>
              {result.length_pass ? "文字数合格" : "文字数不合格"}
            </strong>
          </p>
          {result.pages.map((page) => (
            <article
              key={page.section_no}
              style={{
                marginBottom: "0.8rem",
                border: "1px solid #d7dee6",
                background: "#fafbfc",
                padding: "0.7rem",
              }}
            >
              <h4 style={{ margin: "0 0 0.4rem", fontSize: "0.8rem" }}>
                {page.section_no}. {page.heading}
              </h4>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                  fontSize: "0.76rem",
                }}
              >
                {page.markdown}
              </div>
              <details style={{ marginTop: "0.65rem" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.74rem", color: "#173f5f" }}>
                  画像生成プロンプト
                </summary>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    marginTop: "0.4rem",
                    padding: "0.55rem",
                    background: "#edf3f7",
                    fontSize: "0.7rem",
                    lineHeight: 1.5,
                  }}
                >
                  {page.image_prompt ?? "（なし）"}
                </div>
              </details>
            </article>
          ))}
        </>
      )}
      {evaluation && (
        <aside style={{ marginTop: "0.8rem", padding: "0.65rem", background: "#fff5dc" }}>
          <strong style={{ fontSize: "0.78rem" }}>画像プロンプト評価</strong>
          <p style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>{evaluation.summary}</p>
          <ul style={{ paddingLeft: "1.1rem", fontSize: "0.7rem", lineHeight: 1.5 }}>
            {evaluation.strengths.map((item) => (
              <li key={item}>長所: {item}</li>
            ))}
            {evaluation.concerns.map((item) => (
              <li key={item}>懸念: {item}</li>
            ))}
          </ul>
          <p style={{ marginBottom: 0, fontSize: "0.72rem" }}>
            推奨: {evaluation.recommendation}
          </p>
        </aside>
      )}
    </section>
  );
}

export default function Gpt56LabPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionNo, setSessionNo] = useState(1);

  useEffect(() => {
    void fetch("/api/lab/gpt-5-6-lab", { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json()) as { manifest?: Manifest; error?: string };
        if (!response.ok) throw new Error(json.error ?? response.statusText);
        setManifest(json.manifest ?? null);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      );
  }, []);

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1600,
        margin: "0 auto",
        padding: "1.5rem 1rem 4rem",
        boxSizing: "border-box",
        minHeight: "100%",
        background: "linear-gradient(180deg,#f3f0e8,#e7edf1)",
        color: "#172033",
        fontFamily: "ui-sans-serif,system-ui,sans-serif",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", opacity: 0.7 }}>
        LOCAL SAMPLE · GPT-5.6 COURSE LAB
      </p>
      <h1 style={{ margin: "0.35rem 0", fontSize: "1.7rem" }}>GPT-5.6 講義生成テスト</h1>
      <p style={{ margin: "0 0 0.75rem" }}>
        <Link href="/lab">実験室トップへ</Link>
        {" · "}
        <Link href="/lab/session1-visual-lab">第1回画像比較へ</Link>
        {" · "}
        <Link href="/lab/text-lab">旧モデル文章比較へ</Link>
        {" · "}
        <Link href="/lab/image-lab">画像比較へ</Link>
        {" · "}
        <a href="#test2">テスト2の本文比較へ</a>
      </p>

      {error && <p style={{ padding: "0.7rem", background: "#fde8e8" }}>{error}</p>}
      {!manifest && !error && <p>結果を読み込み中です。</p>}
      {manifest && (
        <>
          <p style={{ fontSize: "0.78rem", color: "#64748b" }}>
            {manifest.course_title} · {manifest.updated_at.replace("T", " ").replace("Z", " UTC")}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            {Object.values(manifest.logic).map((text) => (
              <div key={text} style={{ background: "#fff8", padding: "0.6rem", fontSize: "0.75rem" }}>
                {text}
              </div>
            ))}
          </div>

          <h2 id="test1" style={{ fontSize: "1.05rem", margin: "0 0 0.6rem" }}>
            GPT-5.6 テスト1「講義設計」
          </h2>
          {manifest.test1 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                gap: "0.8rem",
                alignItems: "start",
              }}
            >
              <ResultColumn result={manifest.test1.current} />
              <ResultColumn result={manifest.test1.terra} />
            </div>
          ) : (
            <p>未実行です。</p>
          )}

          <h2 id="test2" style={{ fontSize: "1.05rem", margin: "1.5rem 0 0.4rem" }}>
            GPT-5.6 テスト2「全5回の本文」
          </h2>
          {manifest.test2 ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                  gap: "0.7rem",
                  marginBottom: "0.7rem",
                }}
              >
                {(
                  [
                    ["現行 Sonnet", manifest.test2.current],
                    ["Luna", manifest.test2.luna],
                    ["Terra", manifest.test2.terra],
                  ] as const
                ).map(([label, results]) => {
                  const total = aggregateSessions(results);
                  return (
                    <div key={label} style={{ padding: "0.65rem", background: "#fff8" }}>
                      <strong style={{ fontSize: "0.78rem" }}>{label}</strong>
                      <br />
                      <span style={{ fontSize: "0.74rem" }}>
                        {total.count}/5回 · {formatCost(total.cost)} ·{" "}
                        {(total.latency_ms / 1000).toFixed(1)}秒
                      </span>
                    </div>
                  );
                })}
              </div>
              <nav
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                  marginBottom: "0.7rem",
                }}
              >
                {[1, 2, 3, 4, 5].map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => setSessionNo(number)}
                    style={{
                      border: "1px solid #173f5f",
                      background: sessionNo === number ? "#173f5f" : "transparent",
                      color: sessionNo === number ? "#fff" : "#173f5f",
                      padding: "0.4rem 0.65rem",
                      cursor: "pointer",
                    }}
                  >
                    第{number}回
                  </button>
                ))}
              </nav>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                  gap: "0.7rem",
                  alignItems: "start",
                }}
              >
                <SessionColumn
                  label="現行 · Sonnet 4.6（6コール）"
                  result={manifest.test2.current[String(sessionNo)]}
                  evaluation={manifest.test2.evaluation.current}
                />
                <SessionColumn
                  label="GPT-5.6 Luna（1コール）"
                  result={manifest.test2.luna[String(sessionNo)]}
                  evaluation={manifest.test2.evaluation.luna}
                />
                <SessionColumn
                  label="GPT-5.6 Terra（1コール）"
                  result={manifest.test2.terra[String(sessionNo)]}
                  evaluation={manifest.test2.evaluation.terra}
                />
              </div>
            </>
          ) : (
            <p style={{ color: "#64748b" }}>未実行です。</p>
          )}
        </>
      )}
    </main>
  );
}
