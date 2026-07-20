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
};

export default function CourseFoundationPocPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [throughStep, setThroughStep] = useState(3);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/sample/course-foundation-poc", {
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

  async function runEstimate() {
    setError(null);
    try {
      const res = await fetch("/api/sample/course-foundation-poc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "estimate",
          through_step: throughStep,
          theme: "量子力学入門",
          session_count: 5,
        }),
      });
      const json = (await res.json()) as { manifest?: Manifest; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setManifest(json.manifest ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
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
        型・見積もり・マニフェストのみ。LLM / Tavily は未接続。課金実行は見積もり確認と明示許可の後。
      </p>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/sample">← 試験場トップ</Link>
      </p>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.85rem" }}>
          through_step{" "}
          <select
            value={throughStep}
            onChange={(e) => setThroughStep(Number(e.target.value))}
          >
            <option value={3}>3（ドラフト確定まで）</option>
            <option value={4}>4（＋講座構成）</option>
            <option value={5}>5（＋全回本文・画像除く）</option>
          </select>
        </label>
        <button type="button" onClick={() => void runEstimate()}>
          見積もり（課金なし）
        </button>
        <button type="button" onClick={() => void load()}>
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
          }}
        >
          <p style={{ margin: "0 0 0.4rem" }}>
            <strong>{manifest.theme || "（未設定）"}</strong> · status={manifest.status} ·
            through={manifest.through_step}
          </p>
          <p style={{ margin: "0 0 0.6rem", color: "#475569" }}>{manifest.notes}</p>
          {manifest.error && (
            <p style={{ color: "#b45309" }}>execute: {manifest.error}</p>
          )}
          {manifest.estimate && (
            <>
              <p style={{ margin: "0 0 0.4rem" }}>
                概算 <strong>${manifest.estimate.approx_usd_total.toFixed(2)}</strong> · 約{" "}
                {manifest.estimate.approx_minutes} 分
              </p>
              <ul style={{ margin: "0 0 0.6rem", paddingLeft: "1.1rem" }}>
                {manifest.estimate.calls.map((c) => (
                  <li key={c.step}>
                    Step {c.step}: {c.label} — {c.model_or_tool} ×{c.count} ≈ $
                    {c.approx_usd.toFixed(2)}
                  </li>
                ))}
              </ul>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#475569" }}>
                {manifest.estimate.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
          <p style={{ margin: "0.8rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
            updated {manifest.updated_at}
          </p>
        </section>
      )}
    </main>
  );
}
