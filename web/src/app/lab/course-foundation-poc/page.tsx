"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type EstimateCall = {
  step: number;
  label: string;
  model_or_tool: string;
  count: number;
  approx_usd: number;
};

type SessionPage = {
  section_no: number;
  heading: string;
  markdown: string;
  image_prompt: string;
};

type SessionResult = {
  session_no: number;
  title?: string;
  status: string;
  model_id?: string;
  fallback_used?: boolean;
  body_chars?: number;
  target_chars?: number;
  length_pass?: boolean;
  cost_usd?: number;
  error?: string;
  pages?: SessionPage[];
};

type OutlineSession = {
  session_no: number;
  title: string;
  sections?: Array<{
    section_no: number;
    role?: string;
    heading: string;
    intent?: string;
    target_chars?: number;
  }>;
};

type Manifest = {
  updated_at: string;
  theme: string;
  through_step: number;
  status: string;
  spent_usd: number;
  notes: string;
  error?: string;
  estimate: {
    through_step: number;
    approx_usd_total: number;
    approx_minutes: number;
    calls: EstimateCall[];
    notes: string[];
  } | null;
  artifacts?: {
    draft?: {
      body_markdown?: string;
      learning_outcomes?: string[];
      claims_to_verify?: string[];
      meta?: { cost_usd?: number; model_id?: string };
    };
    audit?: {
      findings?: Array<{
        severity: string;
        kind: string;
        claim_or_gap: string;
        recommendation: string;
      }>;
      revision_instructions?: string[];
      reference_urls?: string[];
      truncated?: boolean;
      search_queries_used?: number;
      meta?: { cost_usd?: number };
    };
    locked?: {
      body_markdown?: string;
      meta?: { cost_usd?: number; model_id?: string };
    };
    course_master?: {
      meta?: { target_chars_per_session?: number; session_count?: number };
      sessions?: OutlineSession[];
    };
    sessions?: SessionResult[];
  };
};

const preStyle = {
  whiteSpace: "pre-wrap" as const,
  background: "#fff",
  padding: "0.8rem",
  fontSize: "0.8rem",
  maxHeight: 320,
  overflow: "auto" as const,
};

export default function CourseFoundationPocPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openSession, setOpenSession] = useState<number>(1);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/lab/course-foundation-poc", {
        cache: "no-store",
      });
      const json = (await res.json()) as { manifest?: Manifest; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setManifest(json.manifest ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(action: "estimate" | "execute", throughStep: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lab/course-foundation-poc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          through_step: throughStep,
          theme: "量子力学入門",
          session_count: 5,
          ...(throughStep >= 4
            ? { regenerate_outline: true, only_sessions: [1, 2, 3, 4, 5] }
            : {}),
        }),
      });
      const json = (await res.json()) as {
        manifest?: Manifest;
        error?: string;
      };
      if (!res.ok && !json.manifest) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      if (json.manifest) setManifest(json.manifest);
      if (!res.ok && json.error) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const draft = manifest?.artifacts?.draft;
  const audit = manifest?.artifacts?.audit;
  const locked = manifest?.artifacts?.locked;
  const courseMaster = manifest?.artifacts?.course_master;
  const sessions = manifest?.artifacts?.sessions ?? [];
  const active = sessions.find((s) => s.session_no === openSession) ?? sessions[0];

  return (
    <main
      style={{
        maxWidth: 820,
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
        SAMPLE · FOUNDATION POC
      </p>
      <h1 style={{ margin: "0.35rem 0 0.5rem", fontSize: "1.45rem" }}>
        構成フェーズ拡張 PoC
      </h1>
      <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", lineHeight: 1.55 }}>
        1〜3 知識ドラフト／監査／確定 → 4 講義構成 → 5 各回本文（画像なし）。成果物は{" "}
        <code>public/lab/course-foundation-poc/manifest.json</code>。
      </p>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/lab">← 実験室トップ</Link>
      </p>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button type="button" disabled={busy} onClick={() => void post("estimate", 5)}>
          見積もり（課金なし）
        </button>
        <button type="button" disabled={busy} onClick={() => void post("execute", 3)}>
          {busy ? "実行中…" : "execute ≤3"}
        </button>
        <button type="button" disabled={busy} onClick={() => void post("execute", 5)}>
          {busy ? "実行中…" : "execute 4+5 やり直し"}
        </button>
        <button type="button" disabled={busy} onClick={() => void load()}>
          再読込
        </button>
      </div>

      {error && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{error}</p>
      )}

      {manifest && (
        <section
          style={{
            background: "rgba(255,255,255,0.9)",
            borderTop: "3px solid #173f5f",
            padding: "0.9rem 1rem",
            fontSize: "0.85rem",
            lineHeight: 1.55,
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: "0 0 0.4rem" }}>
            <strong>{manifest.theme || "（未設定）"}</strong> · status=
            {manifest.status} · through={manifest.through_step} · spent $
            {manifest.spent_usd.toFixed(4)}
          </p>
          <p style={{ margin: "0 0 0.6rem", color: "#475569" }}>{manifest.notes}</p>
        </section>
      )}

      {draft && (
        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem" }}>1. ドラフト（知識の目次・講義セクションではない）</h2>
          <p style={{ fontSize: "0.8rem", color: "#475569" }}>
            {draft.meta?.model_id} · ${draft.meta?.cost_usd?.toFixed(4)}
          </p>
          <pre style={preStyle}>{draft.body_markdown}</pre>
        </section>
      )}

      {audit && (
        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem" }}>2. 監査</h2>
          <p style={{ fontSize: "0.8rem", color: "#475569" }}>
            検索 {audit.search_queries_used} 回
            {audit.truncated ? "（打ち切り）" : ""} · $
            {audit.meta?.cost_usd?.toFixed(4)}
          </p>
          <ul style={{ fontSize: "0.82rem" }}>
            {(audit.findings ?? []).map((f, i) => (
              <li key={i}>
                [{f.severity}/{f.kind}] {f.claim_or_gap} — {f.recommendation}
              </li>
            ))}
          </ul>
        </section>
      )}

      {locked && (
        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem" }}>3. 確定ドラフト</h2>
          <p style={{ fontSize: "0.8rem", color: "#475569" }}>
            {locked.meta?.model_id} · ${locked.meta?.cost_usd?.toFixed(4)}
          </p>
          <pre style={preStyle}>{locked.body_markdown}</pre>
        </section>
      )}

      {courseMaster?.sessions && (
        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem" }}>4. 講義構成（CourseMaster・講義セクション）</h2>
          <p style={{ fontSize: "0.8rem", color: "#475569" }}>
            目標 {courseMaster.meta?.target_chars_per_session ?? "—"} 字/回 ·{" "}
            {courseMaster.sessions.length} 回
          </p>
          {courseMaster.sessions.map((s) => {
            const sum = (s.sections ?? []).reduce(
              (n, sec) => n + (sec.target_chars ?? 0),
              0,
            );
            return (
              <details key={s.session_no} style={{ marginBottom: "0.5rem" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.9rem" }}>
                  第{s.session_no}回 {s.title} — {s.sections?.length ?? 0}セクション /
                  target合計 {sum}
                </summary>
                <ol style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
                  {(s.sections ?? []).map((sec) => (
                    <li key={sec.section_no}>
                      [{sec.role}] {sec.heading}（{sec.target_chars}字）— {sec.intent}
                    </li>
                  ))}
                </ol>
              </details>
            );
          })}
        </section>
      )}

      {sessions.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.05rem" }}>5. 各回本文</h2>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            {sessions.map((s) => (
              <button
                key={s.session_no}
                type="button"
                onClick={() => setOpenSession(s.session_no)}
                style={{
                  fontWeight: openSession === s.session_no ? 700 : 400,
                }}
              >
                第{s.session_no}回
                {s.length_pass === false ? " !" : ""}
              </button>
            ))}
          </div>
          {active && (
            <>
              <p style={{ fontSize: "0.8rem", color: "#475569" }}>
                {active.title} · {active.status} · {active.model_id}
                {active.fallback_used ? "（FB）" : ""} · {active.body_chars ?? "—"} /{" "}
                {active.target_chars ?? "—"} 字 · length_pass=
                {String(active.length_pass)} · ${active.cost_usd?.toFixed(4) ?? "—"}
              </p>
              {active.error && (
                <p style={{ color: "#b45309", fontSize: "0.82rem" }}>{active.error}</p>
              )}
              {(active.pages ?? []).map((p) => (
                <article
                  key={p.section_no}
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    borderTop: "2px solid #173f5f",
                    padding: "0.75rem",
                    marginBottom: "0.6rem",
                  }}
                >
                  <h3 style={{ margin: "0 0 0.4rem", fontSize: "0.95rem" }}>
                    {p.heading}
                  </h3>
                  <pre style={{ ...preStyle, maxHeight: 220 }}>{p.markdown}</pre>
                  <details>
                    <summary style={{ fontSize: "0.75rem" }}>画像プロンプト</summary>
                    <pre style={{ ...preStyle, maxHeight: 120 }}>{p.image_prompt}</pre>
                  </details>
                </article>
              ))}
            </>
          )}
        </section>
      )}

      {!courseMaster?.sessions && !sessions.length && locked && (
        <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
          ステップ4・5はまだ表示データがありません。上の「execute 4+5
          やり直し」か、再読込で確認してください。
        </p>
      )}
    </main>
  );
}
