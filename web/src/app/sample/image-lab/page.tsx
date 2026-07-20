"use client";

import { useCallback, useEffect, useState } from "react";

type Slot = {
  session_no: number;
  section_no: number;
  heading: string;
  base_prompt: string;
  style_a_prompt?: string;
  style_b_prompt?: string;
  style_b_prime_prompt?: string;
  style_b_prime_structured?: string;
  files: Record<string, string | undefined>;
  costs: Record<string, number | undefined>;
  latencies_ms: Record<string, number | undefined>;
  prompt_rewrite_costs?: Record<string, number | undefined>;
  prompt_rewrite_latencies_ms?: Record<string, number | undefined>;
  prompt_rewrite_model?: string;
  prompt_rewrite_model_b_prime?: string;
};

type Manifest = {
  updated_at: string;
  course_id: string;
  size: string;
  aspect: string;
  notes: string;
  slots: Slot[];
};

type Totals = {
  cost_usd: number;
  latency_ms: number;
  prompt_cost_usd?: number;
  prompt_latency_ms?: number;
  image_cost_usd?: number;
  image_latency_ms?: number;
};

function formatUsd(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(3)}`;
}

function formatMs(ms: number | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function PromptUnderImage({ label, text }: { label: string; text?: string }) {
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p
        style={{
          margin: "0 0 0.25rem",
          fontSize: "0.7rem",
          letterSpacing: "0.04em",
          opacity: 0.65,
          textTransform: "uppercase",
        }}
      >
        Prompt · {label}
      </p>
      <pre
        style={{
          margin: 0,
          maxHeight: 320,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "0.72rem",
          lineHeight: 1.45,
          padding: "0.55rem 0.6rem",
          background: "rgba(28, 61, 90, 0.06)",
          border: "1px solid rgba(28, 61, 90, 0.12)",
          color: "#243447",
        }}
      >
        {text?.trim() ? text : "（プロンプト未記録）"}
      </pre>
    </div>
  );
}

export default function SampleImageLabPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [busy, setBusy] = useState<"A" | "B" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPhase, setLastPhase] = useState<string | null>(null);
  const [lastTotals, setLastTotals] = useState<Totals | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/sample/image-lab");
    const json = (await res.json()) as { manifest?: Manifest; error?: string };
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    setManifest(json.manifest ?? null);
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  async function runPhase(phase: "A" | "B") {
    setBusy(phase);
    setError(null);
    try {
      const res = await fetch("/api/sample/image-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      const json = (await res.json()) as {
        error?: string;
        totals?: Totals;
        manifest?: Manifest;
        phase?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setLastPhase(json.phase ?? phase);
      setLastTotals(json.totals ?? null);
      setManifest(json.manifest ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      style={{
        maxWidth: 1920,
        margin: "0 auto",
        padding: "1.5rem 1rem 4rem",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#1a1a1a",
        background: "linear-gradient(180deg, #f3f0ea 0%, #e8eef2 100%)",
        minHeight: "100%",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.08em", opacity: 0.7 }}>
        LOCAL SAMPLE · IMAGE LAB
      </p>
      <h1 style={{ margin: "0.35rem 0 0.5rem", fontSize: "1.75rem" }}>画像比較ラボ</h1>
      <p style={{ margin: "0 0 1rem", maxWidth: 800, lineHeight: 1.5 }}>
        管理画面とは独立。5列: オリジナル / A / B / B&apos;（Infographic） / C（Nano Banana 2 ·
        同一組み立てプロンプト）。C はプロンプト非表示。サイズ{" "}
        {manifest?.size ?? "2048×1152"}（16:9）。
        <br />
        <a href="/sample/text-lab">本文・講座構成比較へ</a>
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => void runPhase("A")}
          disabled={busy != null}
          style={{
            padding: "0.55rem 1rem",
            border: "none",
            background: busy ? "#999" : "#1c3d5a",
            color: "#fff",
            cursor: busy ? "wait" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          {busy === "A" ? "A 生成中…" : "Phase A 再実行"}
        </button>
        <button
          type="button"
          onClick={() => void runPhase("B")}
          disabled={busy != null}
          style={{
            padding: "0.55rem 1rem",
            border: "none",
            background: busy ? "#999" : "#3d5a1c",
            color: "#fff",
            cursor: busy ? "wait" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          {busy === "B" ? "B 生成中（Sonnet＋画像・数分）…" : "Phase B を実行"}
        </button>
        <button
          type="button"
          onClick={() => void load().catch((e) => setError(String(e)))}
          style={{
            padding: "0.55rem 1rem",
            border: "1px solid #1c3d5a",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          再読込
        </button>
      </div>

      {error && (
        <p style={{ color: "#8b1e1e", background: "#fde8e8", padding: "0.75rem" }}>{error}</p>
      )}
      {lastTotals && (
        <p style={{ fontSize: "0.9rem" }}>
          直前 {lastPhase}: 合計 {formatUsd(lastTotals.cost_usd)} / {formatMs(lastTotals.latency_ms)}
          {lastTotals.prompt_cost_usd != null && (
            <>
              {" "}
              （プロンプト {formatUsd(lastTotals.prompt_cost_usd)} /{" "}
              {formatMs(lastTotals.prompt_latency_ms)} · 画像{" "}
              {formatUsd(lastTotals.image_cost_usd)} / {formatMs(lastTotals.image_latency_ms)}）
            </>
          )}
        </p>
      )}
      {manifest && (
        <p style={{ fontSize: "0.8rem", opacity: 0.75 }}>
          更新: {new Date(manifest.updated_at).toLocaleString("ja-JP")} · {manifest.notes}
        </p>
      )}

      {!manifest?.slots?.length && !busy && (
        <p style={{ opacity: 0.7 }}>まだ結果がありません。</p>
      )}

      {manifest?.slots.map((slot) => {
        const bPromptCost = slot.prompt_rewrite_costs?.style_b;
        const bPromptMs = slot.prompt_rewrite_latencies_ms?.style_b;
        const bImageCost = slot.costs.style_b;
        const bImageMs = slot.latencies_ms.style_b;
        const bTotalCost =
          bPromptCost != null || bImageCost != null
            ? (bPromptCost ?? 0) + (bImageCost ?? 0)
            : undefined;
        const bTotalMs =
          bPromptMs != null || bImageMs != null ? (bPromptMs ?? 0) + (bImageMs ?? 0) : undefined;

        const bpPromptCost = slot.prompt_rewrite_costs?.style_b_prime;
        const bpPromptMs = slot.prompt_rewrite_latencies_ms?.style_b_prime;
        const bpImageCost = slot.costs.style_b_prime;
        const bpImageMs = slot.latencies_ms.style_b_prime;
        const bpTotalCost =
          bpPromptCost != null || bpImageCost != null
            ? (bpPromptCost ?? 0) + (bpImageCost ?? 0)
            : undefined;
        const bpTotalMs =
          bpPromptMs != null || bpImageMs != null
            ? (bpPromptMs ?? 0) + (bpImageMs ?? 0)
            : undefined;

        return (
          <section
            key={slot.section_no}
            style={{
              marginTop: "1.75rem",
              padding: "1rem",
              background: "rgba(255,255,255,0.72)",
              borderTop: "2px solid #1c3d5a",
            }}
          >
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
              第{slot.session_no}回 · セクション {slot.section_no} — {slot.heading}
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
                gap: "0.75rem",
                alignItems: "start",
              }}
            >
              <figure style={{ margin: 0 }}>
                <figcaption style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
                  オリジナル mid · {formatUsd(slot.costs.baseline_mid)} /{" "}
                  {formatMs(slot.latencies_ms.baseline_mid)}
                </figcaption>
                {slot.files.baseline_mid ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${slot.files.baseline_mid}?t=${manifest.updated_at}`}
                    alt="baseline"
                    style={{ width: "100%", height: "auto", display: "block", background: "#ddd" }}
                  />
                ) : (
                  <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>未コピー</p>
                )}
                <PromptUnderImage label="original / base" text={slot.base_prompt} />
              </figure>
              <figure style={{ margin: 0 }}>
                <figcaption style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
                  A · mid + スタイル · {formatUsd(slot.costs.style_a)} /{" "}
                  {formatMs(slot.latencies_ms.style_a)}
                </figcaption>
                {slot.files.style_a ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${slot.files.style_a}?t=${manifest.updated_at}`}
                    alt="style A"
                    style={{ width: "100%", height: "auto", display: "block", background: "#ddd" }}
                  />
                ) : (
                  <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>未生成</p>
                )}
                <PromptUnderImage
                  label="A"
                  text={slot.style_a_prompt ?? slot.base_prompt}
                />
              </figure>
              <figure style={{ margin: 0 }}>
                <figcaption style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
                  B · シネマ調 + mid · 計 {formatUsd(bTotalCost)} / {formatMs(bTotalMs)}
                  <br />
                  <span style={{ opacity: 0.75 }}>
                    内訳: プロンプト {formatUsd(bPromptCost)} / {formatMs(bPromptMs)}
                    {slot.prompt_rewrite_model ? ` (${slot.prompt_rewrite_model})` : ""} · 画像{" "}
                    {formatUsd(bImageCost)} / {formatMs(bImageMs)}
                  </span>
                </figcaption>
                {slot.files.style_b ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${slot.files.style_b}?t=${manifest.updated_at}`}
                    alt="style B"
                    style={{ width: "100%", height: "auto", display: "block", background: "#ddd" }}
                  />
                ) : (
                  <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>未生成</p>
                )}
                <PromptUnderImage label="B" text={slot.style_b_prompt} />
              </figure>
              <figure style={{ margin: 0 }}>
                <figcaption style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
                  B&apos; · Infographic反省版 + mid · 計 {formatUsd(bpTotalCost)} /{" "}
                  {formatMs(bpTotalMs)}
                  <br />
                  <span style={{ opacity: 0.75 }}>
                    内訳: プロンプト {formatUsd(bpPromptCost)} / {formatMs(bpPromptMs)}
                    {slot.prompt_rewrite_model_b_prime
                      ? ` (${slot.prompt_rewrite_model_b_prime})`
                      : ""}{" "}
                    · 画像 {formatUsd(bpImageCost)} / {formatMs(bpImageMs)}
                  </span>
                </figcaption>
                {slot.files.style_b_prime ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${slot.files.style_b_prime}?t=${manifest.updated_at}`}
                    alt="style B prime"
                    style={{ width: "100%", height: "auto", display: "block", background: "#ddd" }}
                  />
                ) : (
                  <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>未生成</p>
                )}
                <PromptUnderImage
                  label="B' (構造+組み立て)"
                  text={slot.style_b_prime_structured ?? slot.style_b_prime_prompt}
                />
              </figure>
              <figure style={{ margin: 0 }}>
                <figcaption style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>
                  C · Nano Banana 2 · {formatUsd(slot.costs.nano_banana_2)} /{" "}
                  {formatMs(slot.latencies_ms.nano_banana_2)}
                </figcaption>
                {slot.files.nano_banana_2 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${slot.files.nano_banana_2}?t=${manifest.updated_at}`}
                    alt="Nano Banana 2"
                    style={{ width: "100%", height: "auto", display: "block", background: "#ddd" }}
                  />
                ) : (
                  <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>未生成</p>
                )}
              </figure>
            </div>
          </section>
        );
      })}

      <p style={{ marginTop: "2rem", fontSize: "0.8rem", opacity: 0.65 }}>
        C = B&apos; と同じ組み立てプロンプトを OpenRouter の Nano Banana 2 へ。Flux は比較対象外。
      </p>
    </main>
  );
}
