"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { AO_LLM_MODEL_PRESETS } from "@/lib/ao-llm-presets";
import type { AoProjectSettingsDto } from "@/lib/ao-project-settings";
import type { ProjectId } from "@/lib/ao-types";

const AO_INK = "#3D1C08";
const AO_EDIT_SURFACE = "#F4F0E7";
const AO_EDIT_INK = "#141008";
const AO_EDIT_BORDER = "#c9b89e";
const AO_EDIT_BORDER_FOCUS = "#8f7352";

function ReadonlyBlock({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex min-h-0 flex-col gap-0.5">
      <span className="shrink-0 text-[10px] font-semibold text-[#3D1C08]/70">{label}</span>
      <textarea
        readOnly
        value={value}
        className="min-h-[56px] w-full resize-y rounded-sm border border-solid px-1.5 py-1 font-serif text-[12px] leading-relaxed text-[#3D1C08]/90"
        style={{ backgroundColor: "#ebe6dc", borderColor: `${AO_INK}22` }}
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-[#3D1C08]/70">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full rounded-sm border border-solid px-1.5 py-0.5 font-mono text-[11px] outline-none focus:ring-2 focus:ring-[#DBB961]/35"
        style={{ backgroundColor: AO_EDIT_SURFACE, color: AO_EDIT_INK, borderColor: AO_EDIT_BORDER }}
      />
    </label>
  );
}

function emptyDraft(): AoProjectSettingsDto | null {
  return null;
}

type Props = {
  projectId: ProjectId;
  topicLabel: string;
};

export type AoReijitsuOverlayHandle = {
  confirmSave: () => Promise<void>;
};

export const AoReijitsuOverlay = forwardRef<AoReijitsuOverlayHandle, Props>(function AoReijitsuOverlay(
  { projectId, topicLabel },
  ref,
) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envDefaultModel, setEnvDefaultModel] = useState("");
  const [draft, setDraft] = useState<AoProjectSettingsDto | null>(emptyDraft);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/settings/ao-projects?projectId=${encodeURIComponent(projectId)}`);
        const data = (await res.json()) as {
          project?: AoProjectSettingsDto;
          envDefaultModel?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "読込に失敗しました");
        if (cancelled) return;
        if (!data.project) throw new Error("論設定がありません");
        setDraft(data.project);
        setEnvDefaultModel(data.envDefaultModel ?? "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const onConfirm = useCallback(async () => {
    if (!draft || loading) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/ao-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: draft.project_id,
          patch: {
            model_id: draft.model_id,
            rag_enabled: draft.rag_enabled,
            rag_when: draft.rag_when,
            rag_match_count: draft.rag_match_count,
            rag_match_threshold: draft.rag_match_threshold,
            rag_max_chars: draft.rag_max_chars,
            history_max_messages: draft.history_max_messages,
            profile_inject: draft.profile_inject,
            web_search_enabled: draft.web_search_enabled,
            web_search_min_rounds: draft.web_search_min_rounds,
            web_search_max_rounds: draft.web_search_max_rounds,
            web_search_max_per_round: draft.web_search_max_per_round,
            web_search_tavily_max_results: draft.web_search_tavily_max_results,
            web_search_result_max_chars: draft.web_search_result_max_chars,
            web_search_snippet_max_chars: draft.web_search_snippet_max_chars,
            max_completion_tokens: draft.max_completion_tokens,
          },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok) throw new Error([data.error, data.detail].filter(Boolean).join(" — "));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, [draft, loading]);

  useImperativeHandle(ref, () => ({ confirmSave: () => onConfirm() }), [onConfirm]);

  if (loading) {
    return <div className="py-6 text-center text-[12px] text-[#3D1C08]/60">読み込み中…</div>;
  }
  if (!draft) {
    return (
      <div className="py-6 text-center text-[12px] text-red-700/90">
        {error ?? "論設定を読み込めませんでした"}
      </div>
    );
  }

  const modelVal = draft.model_id;
  const presetValues = new Set(AO_LLM_MODEL_PRESETS.map((p) => p.value));
  const showCustom = modelVal !== "" && !presetValues.has(modelVal);
  const effectiveModelId = modelVal.trim() || envDefaultModel.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-1 pb-2">
      {error ? <div className="shrink-0 text-center text-[11px] text-red-700">{error}</div> : null}
      <p className="shrink-0 text-[10px] leading-snug text-[#3D1C08]/75">
        <span className="font-semibold">{topicLabel}</span>
        <span className="text-[#3D1C08]/55"> — 令旨（論設定）。保存先は Supabase </span>
        <code className="rounded bg-black/5 px-0.5 font-mono text-[9px]">ao_projects</code>
      </p>

      <section className="flex flex-col gap-1.5">
        <h3 className="border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
          令旨本文（読取専用・Persona 参照）
        </h3>
        <ReadonlyBlock label="概要" value={draft.summary} />
        <ReadonlyBlock label="備考" value={draft.notes} />
        <ReadonlyBlock label="進行" value={draft.process} />
        <ReadonlyBlock label="口調" value={draft.tone} />
        <p className="text-[10px] text-[#3D1C08]/60">
          主担当: {draft.main_persona_name || "—"}
          {draft.main_persona_key ? ` (${draft.main_persona_key})` : ""}
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
          LLM モデル
        </h3>
        <p className="text-[10px] text-[#3D1C08]/65">
          実効: <span className="font-mono text-[#1a1208]">{effectiveModelId || "（.env 未設定）"}</span>
        </p>
        <select
          aria-label="論別モデル"
          value={showCustom ? "__custom__" : modelVal}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") return;
            setDraft((d) => (d ? { ...d, model_id: v } : d));
          }}
          className="min-h-[26px] w-full rounded-sm border border-solid px-2 py-0.5 font-mono text-[11px] outline-none focus:ring-2 focus:ring-[#DBB961]/35"
          style={{ backgroundColor: AO_EDIT_SURFACE, color: AO_EDIT_INK, borderColor: AO_EDIT_BORDER }}
        >
          <option value="">環境既定（LLM_MODEL）</option>
          {AO_LLM_MODEL_PRESETS.map((p) => (
            <option key={p.label + p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          {showCustom ? <option value="__custom__">その他（現在の値）</option> : null}
        </select>
        {showCustom ? (
          <input
            value={modelVal}
            onChange={(e) => setDraft((d) => (d ? { ...d, model_id: e.target.value } : d))}
            className="w-full rounded-sm border border-solid px-2 py-1 font-mono text-[11px] outline-none focus:ring-2 focus:ring-[#DBB961]/35"
            style={{ backgroundColor: AO_EDIT_SURFACE, color: AO_EDIT_INK, borderColor: AO_EDIT_BORDER }}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
          RAG
        </h3>
        <label className="flex items-center gap-2 text-[11px] text-[#3D1C08]">
          <input
            type="checkbox"
            checked={draft.rag_enabled}
            onChange={(e) => setDraft((d) => (d ? { ...d, rag_enabled: e.target.checked } : d))}
          />
          RAG 有効
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-[#3D1C08]/70">
          検索タイミング
          <select
            value={draft.rag_when}
            onChange={(e) =>
              setDraft((d) =>
                d ? { ...d, rag_when: e.target.value as "first_user" | "every_user" } : d,
              )
            }
            className="rounded-sm border border-solid px-1.5 py-0.5 text-[11px]"
            style={{ borderColor: AO_EDIT_BORDER, backgroundColor: AO_EDIT_SURFACE }}
          >
            <option value="every_user">毎 user ターン</option>
            <option value="first_user">初回 user のみ</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="件数"
            value={draft.rag_match_count}
            min={0}
            max={32}
            onChange={(n) => setDraft((d) => (d ? { ...d, rag_match_count: n } : d))}
          />
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-[#3D1C08]/70">類似度しきい値</span>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={draft.rag_match_threshold}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setDraft((d) => (d ? { ...d, rag_match_threshold: n } : d));
              }}
              className="rounded-sm border border-solid px-1.5 py-0.5 font-mono text-[11px]"
              style={{ borderColor: AO_EDIT_BORDER, backgroundColor: AO_EDIT_SURFACE }}
            />
          </label>
          <NumField
            label="注入最大文字"
            value={draft.rag_max_chars}
            min={0}
            onChange={(n) => setDraft((d) => (d ? { ...d, rag_max_chars: n } : d))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
          履歴
        </h3>
        <NumField
          label="履歴最大メッセージ数"
          value={draft.history_max_messages}
          min={0}
          onChange={(n) => setDraft((d) => (d ? { ...d, history_max_messages: n } : d))}
        />
        <label className="flex items-center gap-2 text-[11px] text-[#3D1C08]">
          <input
            type="checkbox"
            checked={draft.profile_inject}
            onChange={(e) => setDraft((d) => (d ? { ...d, profile_inject: e.target.checked } : d))}
          />
          プロフィール注入（心気論等）
        </label>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
          Web 検索（Tavily）
        </h3>
        <label className="flex items-center gap-2 text-[11px] text-[#3D1C08]">
          <input
            type="checkbox"
            checked={draft.web_search_enabled}
            onChange={(e) => setDraft((d) => (d ? { ...d, web_search_enabled: e.target.checked } : d))}
          />
          Web 検索有効
        </label>
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="最小 user ターン（超えるまでツール無効）"
            value={draft.web_search_min_rounds}
            min={0}
            max={8}
            onChange={(n) => setDraft((d) => (d ? { ...d, web_search_min_rounds: n } : d))}
          />
          <NumField
            label="最大ツールラウンド"
            value={draft.web_search_max_rounds}
            min={0}
            max={8}
            onChange={(n) => setDraft((d) => (d ? { ...d, web_search_max_rounds: n } : d))}
          />
          <NumField
            label="1ラウンドあたり上限"
            value={draft.web_search_max_per_round}
            min={0}
            max={32}
            onChange={(n) => setDraft((d) => (d ? { ...d, web_search_max_per_round: n } : d))}
          />
          <NumField
            label="Tavily 最大件数"
            value={draft.web_search_tavily_max_results}
            min={0}
            max={20}
            onChange={(n) => setDraft((d) => (d ? { ...d, web_search_tavily_max_results: n } : d))}
          />
          <NumField
            label="結果合計最大文字"
            value={draft.web_search_result_max_chars}
            min={0}
            onChange={(n) => setDraft((d) => (d ? { ...d, web_search_result_max_chars: n } : d))}
          />
          <NumField
            label="スニペット最大文字"
            value={draft.web_search_snippet_max_chars}
            min={0}
            onChange={(n) => setDraft((d) => (d ? { ...d, web_search_snippet_max_chars: n } : d))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
          完了トークン
        </h3>
        <label className="flex flex-col gap-0.5 text-[10px] text-[#3D1C08]/70">
          max_completion_tokens（空欄＝環境既定）
          <input
            type="number"
            min={256}
            max={8192}
            value={draft.max_completion_tokens ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      max_completion_tokens: raw === "" ? null : Math.floor(Number(raw)),
                    }
                  : d,
              );
            }}
            className="rounded-sm border border-solid px-1.5 py-0.5 font-mono text-[11px]"
            style={{ borderColor: AO_EDIT_BORDER, backgroundColor: AO_EDIT_SURFACE }}
          />
        </label>
      </section>
      {saving ? <p className="text-center text-[10px] text-[#3D1C08]/50">保存中…</p> : null}
    </div>
  );
});
AoReijitsuOverlay.displayName = "AoReijitsuOverlay";
