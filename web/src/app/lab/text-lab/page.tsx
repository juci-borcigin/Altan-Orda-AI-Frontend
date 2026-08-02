"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Metric = {
  model_id: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  cost_usd: number | null;
};

type SectionResult = {
  section_no: number;
  heading: string;
  markdown: string;
  image_prompt: string | null;
  image_rationale: string | null;
  metric: Metric;
};

type OutlineResult = {
  raw: string | null;
  master: unknown;
  attempts: number;
  verification_status: string;
  metrics: Metric[];
  total_cost_usd: number | null;
  total_latency_ms: number;
};

type ModelMeta = {
  id: string;
  label: string;
  config: string;
};

type Manifest = {
  updated_at: string;
  course_title: string;
  params: Record<string, unknown>;
  models: ModelMeta[];
  sections: Record<string, Record<string, SectionResult | undefined> | undefined>;
  outlines: Record<string, OutlineResult | undefined>;
  notes: string;
};

type ViewId = "section1" | "section2" | "outline";

function usd(value: number | null | undefined) {
  if (value == null) return "—";
  return `$${value.toFixed(4)}`;
}

function duration(ms: number | null | undefined) {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}秒`;
}

function MetricLine({ metric }: { metric: Metric }) {
  return (
    <div style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "#475569" }}>
      {usd(metric.cost_usd)} · {duration(metric.latency_ms)}
      <br />
      入力 {metric.prompt_tokens.toLocaleString()} / 出力{" "}
      {metric.completion_tokens.toLocaleString()} tokens
    </div>
  );
}

function ModelColumn({
  model,
  view,
  manifest,
}: {
  model: ModelMeta;
  view: ViewId;
  manifest: Manifest;
}) {
  const sectionKey = view === "section1" ? "1" : "2";
  const section = view === "outline" ? undefined : manifest.sections[sectionKey]?.[model.id];
  const outline = view === "outline" ? manifest.outlines[model.id] : undefined;

  return (
    <section
      style={{
        minWidth: 0,
        background: "rgba(255,255,255,0.82)",
        borderTop: "3px solid #1c3d5a",
        padding: "1rem",
      }}
    >
      <header style={{ minHeight: 76, marginBottom: "0.8rem" }}>
        <h2 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>{model.label}</h2>
        <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>
          {model.id}
          <br />
          {model.config}
        </p>
      </header>

      {section && (
        <>
          <MetricLine metric={section.metric} />
          <h3 style={{ fontSize: "0.82rem", margin: "1rem 0 0.35rem" }}>
            回答本文 · {section.heading}
          </h3>
          <div
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.75,
              fontSize: "0.82rem",
              padding: "0.8rem",
              background: "#f8fafc",
              border: "1px solid #d8dee8",
            }}
          >
            {section.markdown}
          </div>
          <h3 style={{ fontSize: "0.82rem", margin: "1rem 0 0.35rem" }}>画像指示文</h3>
          <div
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.55,
              fontSize: "0.76rem",
              padding: "0.7rem",
              background: "#eef3f7",
              border: "1px solid #d8dee8",
            }}
          >
            {section.image_prompt ?? "（なし）"}
          </div>
        </>
      )}

      {outline && (
        <>
          <div style={{ fontSize: "0.75rem", lineHeight: 1.55, color: "#475569" }}>
            合計 {usd(outline.total_cost_usd)} · {duration(outline.total_latency_ms)}
            <br />
            試行 {outline.attempts}回 · 検証 {outline.verification_status}
            <br />
            {outline.metrics
              .map(
                (m, index) =>
                  `#${index + 1} 入力 ${m.prompt_tokens.toLocaleString()} / 出力 ${m.completion_tokens.toLocaleString()} tokens`,
              )
              .join(" · ")}
          </div>
          <h3 style={{ fontSize: "0.82rem", margin: "1rem 0 0.35rem" }}>
            CourseMaster 回答
          </h3>
          <pre
            style={{
              margin: 0,
              maxHeight: 1200,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.5,
              fontSize: "0.72rem",
              padding: "0.75rem",
              background: "#f8fafc",
              border: "1px solid #d8dee8",
            }}
          >
            {outline.raw ?? JSON.stringify(outline.master, null, 2)}
          </pre>
        </>
      )}

      {!section && !outline && <p style={{ color: "#64748b" }}>未実行</p>}
    </section>
  );
}

export default function TextLabPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [view, setView] = useState<ViewId>("section1");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/lab/text-lab", { cache: "no-store" });
    const json = (await response.json()) as { manifest?: Manifest; error?: string };
    if (!response.ok) throw new Error(json.error ?? response.statusText);
    setManifest(json.manifest ?? null);
  }, []);

  useEffect(() => {
    void load().catch((reason) =>
      setError(reason instanceof Error ? reason.message : String(reason)),
    );
  }, [load]);

  const activeTitle = useMemo(() => {
    if (view === "section1") return "テスト1 · 第1回セクション1";
    if (view === "section2") return "テスト1 · 第1回セクション2";
    return "テスト2 · 講義構成（旧 Tier 1）";
  }, [view]);

  return (
    <main
      style={{
        maxWidth: 1800,
        width: "100%",
        margin: "0 auto",
        padding: "1.5rem 1rem 4rem",
        boxSizing: "border-box",
        color: "#172033",
        background: "linear-gradient(180deg, #f3f0ea 0%, #e8eef2 100%)",
        minHeight: "100%",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.08em", opacity: 0.7 }}>
        LOCAL SAMPLE · TEXT LAB
      </p>
      <h1 style={{ margin: "0.35rem 0 0.4rem", fontSize: "1.7rem" }}>本文・講義構成比較</h1>
      <p style={{ margin: "0 0 0.7rem", maxWidth: 900, lineHeight: 1.55 }}>
        同一の現行設定・CourseMasterで Sonnet 4.6 / GPT-5.6 Luna / GPT-5.6 Terra
        を比較。画像自体は生成せず、画像指示文まで表示します。
      </p>
      <p style={{ margin: "0 0 1rem", fontSize: "0.78rem" }}>
        <Link href="/lab/image-lab">画像比較ラボへ</Link>
        {" · "}
        <Link href="/lab/gpt-5-6-lab">GPT-5.6講義生成テストへ</Link>
        {" · "}
        <button
          type="button"
          onClick={() => void load().catch((reason) => setError(String(reason)))}
          style={{
            border: "none",
            padding: 0,
            background: "transparent",
            color: "#1c3d5a",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          再読込
        </button>
      </p>

      <nav style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {(
          [
            ["section1", "本文 · sec1"],
            ["section2", "本文 · sec2"],
            ["outline", "講義構成"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            style={{
              padding: "0.5rem 0.8rem",
              border: "1px solid #1c3d5a",
              background: view === id ? "#1c3d5a" : "transparent",
              color: view === id ? "#fff" : "#1c3d5a",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p style={{ background: "#fde8e8", color: "#8b1e1e", padding: "0.7rem" }}>{error}</p>}

      {manifest ? (
        <>
          <div style={{ fontSize: "0.76rem", color: "#64748b", marginBottom: "0.8rem" }}>
            {manifest.course_title} · 更新 {new Date(manifest.updated_at).toLocaleString("ja-JP")}
            <br />
            {manifest.notes}
            <br />
            <span style={{ color: "#8a5a16" }}>
              比較値は成功呼び出しのみ。準備中にSonnet構成が旧8,192出力上限で2回途中終了
              （比較外の実験費推定 約$0.25）したため、構成比較は全モデル20,000上限で再実行。
            </span>
          </div>
          <h2 style={{ fontSize: "1rem", margin: "0 0 0.6rem" }}>{activeTitle}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "0.75rem",
              alignItems: "start",
            }}
          >
            {manifest.models.map((model) => (
              <ModelColumn key={model.id} model={model} view={view} manifest={manifest} />
            ))}
          </div>
        </>
      ) : (
        <p>比較結果を読み込み中です。</p>
      )}
    </main>
  );
}
