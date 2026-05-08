"use client";

import { useEffect, useState } from "react";
import { IcoArrowLeft } from "@/components/ao-action-icons";

const AO_NAVY = "#133D5C";
const AO_GOLD = "#DBB961";
const AO_PARCHMENT = "#f6f4ee";
const AO_INK = "#3D1C08";

type Agg = { promptTokens: number; completionTokens: number; estimatedUsd: number; totalTokens: number };

type SummaryJson = {
  counts?: { assistantTurnRows?: number };
  today?: Agg;
  month?: Agg;
  all?: Agg;
  byVendor?: Record<string, { promptTokens: number; completionTokens: number; estimatedUsd: number }>;
  byModel?: Record<string, { promptTokens: number; completionTokens: number; estimatedUsd: number }>;
  error?: string;
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(6)}`;
}

function SummaryBlock({ title, a }: { title: string; a?: Agg }) {
  if (!a) return null;
  return (
    <div className="border-b pb-3 mb-3" style={{ borderColor: `${AO_INK}22` }}>
      <h4 className="mb-1 text-[12px] font-semibold text-[#3D1C08]">{title}</h4>
      <div className="grid gap-0.5 font-mono text-[11px] text-[#3D1C08]/80">
        <div>
          入力 tok: <span className="text-[#1a1208]">{a.promptTokens}</span>　出力 tok:{" "}
          <span className="text-[#1a1208]">{a.completionTokens}</span>　計:{" "}
          <span className="text-[#1a1208]">{a.totalTokens}</span>
        </div>
        <div>
          概算 USD: <span className="text-[#1a1208]">{fmtUsd(a.estimatedUsd)}</span>
        </div>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AoUsageOverlay({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<SummaryJson | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const res = await fetch("/api/usage/summary");
        const j = (await res.json()) as SummaryJson;
        if (!res.ok) throw new Error(j.error || "読み込みに失敗しました");
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const vendorEntries = data?.byVendor ? Object.entries(data.byVendor).sort((a, b) => b[1].estimatedUsd - a[1].estimatedUsd) : [];
  const modelEntries = data?.byModel ? Object.entries(data.byModel).sort((a, b) => b[1].estimatedUsd - a[1].estimatedUsd) : [];

  return (
    <div
      className="absolute inset-0 z-[55] flex min-h-0 min-w-0 flex-col box-border overflow-x-hidden p-3 ao-p5-parchment-surface"
      style={{ backgroundColor: AO_PARCHMENT }}
      role="dialog"
      aria-label="使用量"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 pb-2 pr-[10px] pt-1">
        <h3 className="pl-2 font-serif text-[14px] font-semibold text-[#3D1C08]">AI API 使用量（集計）</h3>
        <button
          type="button"
          className="flex items-center justify-center rounded-sm border-0 bg-transparent p-1.5 text-[#3D1C08] hover:bg-black/5"
          aria-label="戻る"
          onClick={onClose}
        >
          <IcoArrowLeft size={18} />
        </button>
      </div>

      <p className="shrink-0 px-2 pb-2 text-[11px] leading-snug text-[#3D1C08]/70">
        Supabase の <code className="font-mono text-[10px] text-[#c2cad6]">messages</code> に保存された助手応答（
        <code className="font-mono text-[10px]">prompt_tokens</code> ありの行）のみ集計します。009
        マイグレーション未適用・または環境変数未設定の概算 USD は 0 に近いことがあります。
      </p>

      {err ? <div className="shrink-0 px-2 pb-2 text-center text-[12px] text-red-300">{err}</div> : null}

      <div
        className="min-h-0 flex-1 overflow-y-auto border border-solid px-3 py-2 [scrollbar-gutter:stable]"
        style={{ borderColor: AO_INK, backgroundColor: "#faf6ee" }}
      >
        {loading ? (
          <div className="py-8 text-center text-[#3D1C08]/60">読み込み中…</div>
        ) : (
          <div className="space-y-1 pb-6 font-serif">
            <div className="mb-2 text-[11px] text-[#3D1C08]/70">
              応答サンプル数（DB 行）:{" "}
              <span className="font-mono text-[#1a1208]">{data?.counts?.assistantTurnRows ?? 0}</span>
            </div>
            <SummaryBlock title="今日" a={data?.today} />
            <SummaryBlock title="今月" a={data?.month} />
            <SummaryBlock title="累積（全期間）" a={data?.all} />

            <h4 className="mb-1 mt-4 text-[12px] font-semibold text-[#3D1C08]">ベンダー別（model_id の接頭辞）</h4>
            <div className="space-y-1 font-mono text-[10px] text-[#3D1C08]/70">
              {vendorEntries.length === 0 ? (
                <div>（データなし）</div>
              ) : (
                vendorEntries.map(([k, v]) => (
                  <div key={k} className="flex flex-wrap justify-between gap-x-2 border-b border-[#3D1C08]/20 py-1">
                    <span className="text-[#1a1208]">{k}</span>
                    <span>
                      in {v.promptTokens} / out {v.completionTokens} · {fmtUsd(v.estimatedUsd)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <h4 className="mb-1 mt-4 text-[12px] font-semibold text-[#3D1C08]">モデル別</h4>
            <div className="max-h-[40vh] space-y-1 overflow-y-auto font-mono text-[10px] text-[#3D1C08]/70">
              {modelEntries.length === 0 ? (
                <div>（データなし）</div>
              ) : (
                modelEntries.map(([k, v]) => (
                  <div key={k} className="flex flex-wrap justify-between gap-x-2 border-b border-[#3D1C08]/20 py-1">
                    <span className="max-w-[70%] truncate text-[#1a1208]" title={k}>
                      {k}
                    </span>
                    <span className="shrink-0">
                      in {v.promptTokens} / out {v.completionTokens} · {fmtUsd(v.estimatedUsd)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
