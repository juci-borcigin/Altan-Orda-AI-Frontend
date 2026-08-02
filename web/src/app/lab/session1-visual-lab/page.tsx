"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Cell = {
  image_url: string | null;
  prompt: string | null;
  markdown: string;
  heading: string;
  cost_usd: number | null;
  latency_ms: number | null;
  quality: string;
  model_id: string;
  source: string;
};

type Section = {
  section_no: number;
  heading: string;
  cells: Partial<Record<string, Cell>>;
};

type Manifest = {
  updated_at: string;
  size: string;
  notes: string;
  totals: { generated_count: number; cost_usd: number; latency_ms: number };
  sections: Section[];
};

type VariantId = "sonnet_mid" | "luna_low" | "luna_mid" | "terra_low" | "terra_mid";

const VARIANTS: Array<{ id: VariantId; label: string }> = [
  { id: "sonnet_mid", label: "現行 Sonnet · mid（再利用）" },
  { id: "luna_low", label: "Luna · low" },
  { id: "luna_mid", label: "Luna · mid" },
  { id: "terra_low", label: "Terra · low" },
  { id: "terra_mid", label: "Terra · mid" },
];

function usd(value: number | null | undefined) {
  if (value == null) return "—";
  return `$${value.toFixed(4)}`;
}

/** 見出しはカード上部で出すため、本文先頭の ## 見出し行は落とす */
function bodyWithoutHeading(markdown: string, heading: string) {
  const trimmed = markdown.trim();
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new RegExp(`^##\\s*${escaped}\\s*\\n+`);
  if (exact.test(trimmed)) return trimmed.replace(exact, "").trim();
  return trimmed.replace(/^##\s+.+\n+/, "").trim();
}

function PageCard({ cell, label }: { cell?: Cell; label: string }) {
  if (!cell) {
    return (
      <article
        style={{
          background: "rgba(255,255,255,0.75)",
          borderTop: "3px solid #8aa0b4",
          padding: "0.75rem",
          minWidth: 0,
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.9rem" }}>{label}</h3>
        <p style={{ color: "#64748b", fontSize: "0.8rem" }}>このセクションにはありません</p>
      </article>
    );
  }

  return (
    <article
      style={{
        background: "rgba(255,255,255,0.9)",
        borderTop: "3px solid #173f5f",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <header style={{ padding: "0.7rem 0.8rem 0.4rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.9rem" }}>{label}</h3>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.72rem", color: "#64748b" }}>
          {usd(cell.cost_usd)} ·{" "}
          {cell.latency_ms != null ? `${(cell.latency_ms / 1000).toFixed(1)}秒` : "—"} ·{" "}
          {cell.source === "reused" ? "再利用" : "新規生成"}
        </p>
      </header>

      {cell.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cell.image_url}
          alt={cell.heading}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: "cover",
            background: "#0f172a",
          }}
        />
      ) : (
        <div
          style={{
            aspectRatio: "16 / 9",
            display: "grid",
            placeItems: "center",
            background: "#dbe4ec",
            color: "#475569",
            fontSize: "0.85rem",
          }}
        >
          画像未生成
        </div>
      )}
      {cell.image_url?.includes("terra_s1_sec2_low") && (
        <p
          style={{
            margin: 0,
            padding: "0.45rem 0.8rem",
            background: "#fff4db",
            color: "#8a5a16",
            fontSize: "0.72rem",
          }}
        >
          注意: この low 画像は単色の壊れ画像です。OpenAI課金上限のため再生成できていません。
        </p>
      )}

      <div style={{ padding: "0.9rem 0.85rem 1rem" }}>
        <h4 style={{ margin: "0 0 0.45rem", fontSize: "1rem", fontWeight: 650 }}>
          {cell.heading}
        </h4>
        <div
          style={{
            whiteSpace: "pre-wrap",
            lineHeight: 1.8,
            fontSize: "0.9rem",
            color: "#1e293b",
          }}
        >
          {bodyWithoutHeading(cell.markdown, cell.heading)}
        </div>
        <details style={{ marginTop: "0.85rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.78rem", color: "#173f5f" }}>
            料金・時間・画像生成プロンプト
          </summary>
          <p style={{ margin: "0.45rem 0 0.35rem", fontSize: "0.74rem", color: "#475569" }}>
            {usd(cell.cost_usd)} ·{" "}
            {cell.latency_ms != null ? `${(cell.latency_ms / 1000).toFixed(1)}秒` : "—"} ·{" "}
            {cell.model_id} · {cell.quality}
            {cell.source === "reused" ? " · 再利用" : ""}
          </p>
          <pre
            style={{
              marginTop: "0.25rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#eef3f7",
              padding: "0.65rem",
              fontSize: "0.7rem",
              lineHeight: 1.5,
            }}
          >
            {cell.prompt ?? "（なし）"}
          </pre>
        </details>
      </div>
    </article>
  );
}

export default function Session1VisualLabPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sectionNo, setSectionNo] = useState(1);
  const [visible, setVisible] = useState<Record<VariantId, boolean>>({
    sonnet_mid: true,
    luna_low: true,
    luna_mid: true,
    terra_low: true,
    terra_mid: true,
  });

  const load = useCallback(async () => {
    const response = await fetch("/api/lab/session1-visual-lab", { cache: "no-store" });
    const json = (await response.json()) as { manifest?: Manifest; error?: string };
    if (!response.ok) throw new Error(json.error ?? response.statusText);
    setManifest(json.manifest ?? null);
    if (json.manifest?.sections?.[0]) {
      setSectionNo((current) =>
        json.manifest!.sections.some((s) => s.section_no === current)
          ? current
          : json.manifest!.sections[0]!.section_no,
      );
    }
  }, []);

  useEffect(() => {
    void load().catch((reason) =>
      setError(reason instanceof Error ? reason.message : String(reason)),
    );
  }, [load]);

  const section = useMemo(
    () => manifest?.sections.find((s) => s.section_no === sectionNo),
    [manifest, sectionNo],
  );

  const activeVariants = VARIANTS.filter((v) => visible[v.id]);

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1480,
        margin: "0 auto",
        padding: "1rem 0.75rem 4rem",
        boxSizing: "border-box",
        minHeight: "100%",
        background: "linear-gradient(180deg,#f2efe7,#e8eef3)",
        color: "#172033",
        fontFamily: "ui-sans-serif,system-ui,sans-serif",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", opacity: 0.7 }}>
        LOCAL SAMPLE · SESSION 1 VISUAL LAB
      </p>
      <h1 style={{ margin: "0.3rem 0", fontSize: "1.45rem" }}>第1回 · 文章＋画像比較</h1>
      <p style={{ margin: "0 0 0.7rem", fontSize: "0.84rem", lineHeight: 1.55 }}>
        本番に近い「画像の下に本文」。料金・時間・プロンプトも表示。講師チャットなし。
      </p>
      <p style={{ margin: "0 0 0.9rem", fontSize: "0.78rem" }}>
        <Link href="/lab">実験室トップへ</Link>
        {" · "}
        <Link href="/lab/gpt-5-6-lab#test2">文章比較へ</Link>
        {" · "}
        <button
          type="button"
          onClick={() => void load().catch((reason) => setError(String(reason)))}
          style={{
            border: "none",
            background: "transparent",
            color: "#173f5f",
            textDecoration: "underline",
            cursor: "pointer",
            padding: 0,
          }}
        >
          再読込
        </button>
      </p>

      {error && (
        <p style={{ background: "#fde8e8", color: "#8b1e1e", padding: "0.7rem" }}>{error}</p>
      )}

      {manifest && (
        <>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.7rem" }}>
            {manifest.notes}
            <br />
            サイズ {manifest.size} · 生成 {manifest.totals.generated_count}枚 · 合計{" "}
            {usd(manifest.totals.cost_usd)} · {(manifest.totals.latency_ms / 1000).toFixed(1)}秒
            <br />
            更新 {manifest.updated_at.replace("T", " ").replace("Z", " UTC")}
          </div>

          <nav
            style={{
              display: "flex",
              gap: "0.4rem",
              flexWrap: "wrap",
              marginBottom: "0.65rem",
            }}
          >
            {manifest.sections.map((s) => (
              <button
                key={s.section_no}
                type="button"
                onClick={() => setSectionNo(s.section_no)}
                style={{
                  border: "1px solid #173f5f",
                  background: sectionNo === s.section_no ? "#173f5f" : "transparent",
                  color: sectionNo === s.section_no ? "#fff" : "#173f5f",
                  padding: "0.4rem 0.6rem",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                }}
              >
                sec{s.section_no}
              </button>
            ))}
          </nav>

          <div
            style={{
              display: "flex",
              gap: "0.55rem",
              flexWrap: "wrap",
              marginBottom: "0.85rem",
              fontSize: "0.74rem",
            }}
          >
            {VARIANTS.map((v) => (
              <label key={v.id} style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={visible[v.id]}
                  onChange={(event) =>
                    setVisible((prev) => ({ ...prev, [v.id]: event.target.checked }))
                  }
                />
                {v.label}
              </label>
            ))}
          </div>

          <h2 style={{ margin: "0 0 0.6rem", fontSize: "1.05rem" }}>
            第1回 · セクション{sectionNo}
            {section ? ` · ${section.heading}` : ""}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(activeVariants.length, 2)}, minmax(0, 1fr))`,
              gap: "0.75rem",
              alignItems: "start",
            }}
          >
            {activeVariants.map((v) => (
              <PageCard key={v.id} label={v.label} cell={section?.cells[v.id]} />
            ))}
          </div>
        </>
      )}

      {!manifest && !error && <p>読み込み中です。</p>}
    </main>
  );
}
