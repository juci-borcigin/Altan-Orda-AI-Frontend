"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { AO_LLM_MODEL_PRESETS } from "@/lib/ao-llm-presets";
import {
  buildReijitsuBodyLines,
  llmModelDisplayShort,
  type ReijitsuTextSegment,
} from "@/lib/ao-reijitsu-display";
import type { AoProjectSettingsDto } from "@/lib/ao-project-settings";
import type { PersonaExpandRow } from "@/lib/phase5/expand-persona-refs";
import type { ProjectId } from "@/lib/ao-types";

const AO_INK = "#3D1C08";
const AO_EDIT_SURFACE = "#F4F0E7";
const AO_EDIT_INK = "#141008";
const AO_EDIT_BORDER = "#c9b89e";

const REIJITSU_BODY_TEXT_CLASS = "text-[10px] font-semibold leading-snug text-[#3D1C08]/90";

function ReijitsuBodyDisplay({ lines }: { lines: ReijitsuTextSegment[][] }) {
  return (
    <div
      className={`min-h-[10rem] w-full overflow-y-auto rounded-sm border border-solid px-2 py-1.5 font-serif ${REIJITSU_BODY_TEXT_CLASS}`}
      style={{ backgroundColor: "#ebe6dc", borderColor: `${AO_INK}22` }}
      aria-label="令旨本文"
    >
      {lines.map((lineSegs, li) => (
        <p key={li} className={lineSegs.every((s) => s.text === "") ? "min-h-[0.65em]" : "whitespace-pre-wrap"}>
          {lineSegs.map((seg, si) =>
            seg.kind === "resolved" ? (
              <strong key={si} className="font-bold text-[#1a1208]" title={seg.source}>
                {seg.text}
              </strong>
            ) : (
              <span key={si}>{seg.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

const fieldInputClass =
  "rounded-sm border border-solid outline-none focus:ring-2 focus:ring-[#DBB961]/35 font-mono";

const fieldInputStyle = {
  backgroundColor: AO_EDIT_SURFACE,
  color: AO_EDIT_INK,
  borderColor: AO_EDIT_BORDER,
} as const;

const DIGIT_OPTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type RagUiMode = "every" | "first" | "off";

function ragModeFromDraft(d: AoProjectSettingsDto): RagUiMode {
  if (!d.rag_enabled) return "off";
  if (d.rag_when === "first_user") return "first";
  return "every";
}

function applyRagMode(d: AoProjectSettingsDto, mode: RagUiMode): AoProjectSettingsDto {
  if (mode === "off") return { ...d, rag_enabled: false };
  if (mode === "first") return { ...d, rag_enabled: true, rag_when: "first_user" };
  return { ...d, rag_enabled: true, rag_when: "every_user" };
}

function webTurnFromDraft(d: AoProjectSettingsDto): number {
  if (!d.web_search_enabled) return 99;
  return Math.min(5, Math.max(0, Math.floor(d.web_search_min_rounds)));
}

function applyWebTurn(d: AoProjectSettingsDto, v: number): AoProjectSettingsDto {
  if (v === 99) return { ...d, web_search_enabled: false, web_search_min_rounds: 0 };
  return { ...d, web_search_enabled: true, web_search_min_rounds: v };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 text-[11px] font-semibold text-[#3D1C08]">{children}</span>;
}

function SectionRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-0.5 ${className ?? ""}`}
      style={{ borderColor: `${AO_INK}22` }}
    >
      {children}
    </div>
  );
}

function InlineNumField({
  label,
  value,
  onChange,
  widthCh,
  min,
  max,
  step,
  inputPadRem = 1.25,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  widthCh: number;
  min?: number;
  max?: number;
  step?: number;
  /** 入力幅の余白（ch 以外）。RAG 1行化では 0.75 程度 */
  inputPadRem?: number;
}) {
  return (
    <label className="flex min-w-0 items-center gap-1">
      <span className="shrink-0 text-[10px] font-semibold text-[#3D1C08]/70">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`ao-reijitsu-num-input ${fieldInputClass} shrink-0 px-1 py-0.5 text-[11px]`}
        style={{ ...fieldInputStyle, width: `calc(${widthCh}ch + ${inputPadRem}rem)` }}
      />
    </label>
  );
}

function DigitSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  const v = Math.min(9, Math.max(0, Math.floor(value)));
  return (
    <select
      value={v}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${fieldInputClass} shrink-0 px-0.5 py-0.5 text-center text-[11px]`}
      style={{ ...fieldInputStyle, width: "calc(2ch + 1.25rem)" }}
      aria-label={ariaLabel}
    >
      {DIGIT_OPTS.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
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
  { projectId },
  ref,
) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envDefaultModel, setEnvDefaultModel] = useState("");
  const [envDefaultMaxTokens, setEnvDefaultMaxTokens] = useState(4096);
  const [draft, setDraft] = useState<AoProjectSettingsDto | null>(emptyDraft);
  const [personas, setPersonas] = useState<PersonaExpandRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/settings/ao-projects?projectId=${encodeURIComponent(projectId)}`);
        const data = (await res.json()) as {
          project?: AoProjectSettingsDto;
          personas?: PersonaExpandRow[];
          envDefaultModel?: string;
          envDefaultMaxCompletionTokens?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "読込に失敗しました");
        if (cancelled) return;
        if (!data.project) throw new Error("論設定がありません");
        setDraft(data.project);
        setPersonas(Array.isArray(data.personas) ? data.personas : []);
        setEnvDefaultModel(data.envDefaultModel ?? "");
        const envMax = Number(data.envDefaultMaxCompletionTokens);
        setEnvDefaultMaxTokens(Number.isFinite(envMax) ? Math.floor(envMax) : 4096);
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
            history_compress_token_threshold: draft.history_compress_token_threshold,
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

  const bodyLines = useMemo(
    () => (draft ? buildReijitsuBodyLines(draft, personas) : []),
    [draft, personas],
  );

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
  const effectiveModelShort = llmModelDisplayShort(modelVal, envDefaultModel);
  const ragMode = ragModeFromDraft(draft);
  const webTurn = webTurnFromDraft(draft);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-1 pb-2">
      {error ? <div className="shrink-0 text-center text-[11px] text-red-700">{error}</div> : null}

      <ReijitsuBodyDisplay lines={bodyLines} />

      <section className="flex flex-col gap-1.5">
        <SectionRow>
          <SectionTitle>LLM モデル</SectionTitle>
          <span className="font-mono text-[10px] text-[#1a1208]/90">{effectiveModelShort}</span>
          <select
            aria-label="論別モデル"
            value={showCustom ? "__custom__" : modelVal}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") return;
              setDraft((d) => (d ? { ...d, model_id: v } : d));
            }}
            className="min-h-[24px] min-w-0 flex-1 rounded-sm border border-solid px-2 py-0.5 font-mono text-[10px] outline-none focus:ring-2 focus:ring-[#DBB961]/35"
            style={{ backgroundColor: AO_EDIT_SURFACE, color: AO_EDIT_INK, borderColor: AO_EDIT_BORDER }}
          >
            <option value="">環境既定（LLM_MODEL / OPENAI_MODEL）</option>
            {AO_LLM_MODEL_PRESETS.filter((p) => p.value !== "").map((p) => (
              <option key={p.label + p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            {showCustom ? <option value="__custom__">その他</option> : null}
          </select>
        </SectionRow>
        {showCustom ? (
          <input
            value={modelVal}
            onChange={(e) => setDraft((d) => (d ? { ...d, model_id: e.target.value } : d))}
            className="w-full rounded-sm border border-solid px-2 py-1 font-mono text-[10px] outline-none focus:ring-2 focus:ring-[#DBB961]/35"
            style={{ backgroundColor: AO_EDIT_SURFACE, color: AO_EDIT_INK, borderColor: AO_EDIT_BORDER }}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-1.5">
        <SectionRow className="flex-nowrap gap-x-1.5">
          <SectionTitle>RAG</SectionTitle>
          <div className="flex shrink-0 items-center gap-x-1.5 gap-y-0" role="radiogroup" aria-label="RAG">
            <label className="flex cursor-pointer items-center gap-1 text-[10px] text-[#3D1C08]">
              <input
                type="radio"
                name={`rag_mode_${projectId}`}
                checked={ragMode === "every"}
                onChange={() => setDraft((d) => (d ? applyRagMode(d, "every") : d))}
              />
              毎回
            </label>
            <label className="flex cursor-pointer items-center gap-1 text-[10px] text-[#3D1C08]">
              <input
                type="radio"
                name={`rag_mode_${projectId}`}
                checked={ragMode === "first"}
                onChange={() => setDraft((d) => (d ? applyRagMode(d, "first") : d))}
              />
              初回のみ
            </label>
            <label className="flex cursor-pointer items-center gap-1 text-[10px] text-[#3D1C08]">
              <input
                type="radio"
                name={`rag_mode_${projectId}`}
                checked={ragMode === "off"}
                onChange={() => setDraft((d) => (d ? applyRagMode(d, "off") : d))}
              />
              無効
            </label>
          </div>
          <InlineNumField
            label="件数"
            value={draft.rag_match_count}
            widthCh={2}
            inputPadRem={0.75}
            min={0}
            max={32}
            onChange={(n) => setDraft((d) => (d ? { ...d, rag_match_count: n } : d))}
          />
          <InlineNumField
            label="類似度"
            value={draft.rag_match_threshold}
            widthCh={4}
            inputPadRem={0.75}
            min={0}
            max={1}
            step={0.05}
            onChange={(n) => setDraft((d) => (d ? { ...d, rag_match_threshold: n } : d))}
          />
          <InlineNumField
            label="文字数"
            value={draft.rag_max_chars}
            widthCh={4}
            inputPadRem={0.75}
            min={0}
            onChange={(n) => setDraft((d) => (d ? { ...d, rag_max_chars: n } : d))}
          />
        </SectionRow>
      </section>

      <section className="flex flex-col gap-1.5">
        <SectionRow>
          <SectionTitle>履歴</SectionTitle>
          <InlineNumField
            label="最大遡及"
            value={draft.history_max_messages}
            widthCh={3}
            min={0}
            onChange={(n) => setDraft((d) => (d ? { ...d, history_max_messages: n } : d))}
          />
          <InlineNumField
            label="要約閾値"
            value={draft.history_compress_token_threshold}
            widthCh={5}
            min={0}
            onChange={(n) =>
              setDraft((d) => (d ? { ...d, history_compress_token_threshold: n } : d))
            }
          />
          <label className="flex items-center gap-2 text-[10px] text-[#3D1C08]">
            <input
              type="checkbox"
              checked={draft.profile_inject}
              onChange={(e) => setDraft((d) => (d ? { ...d, profile_inject: e.target.checked } : d))}
            />
            プロフィール挿入
          </label>
        </SectionRow>
      </section>

      <section className="flex flex-col gap-1">
        <SectionRow>
          <SectionTitle>Web 検索</SectionTitle>
          <label className="flex items-center gap-1">
            <select
              value={webTurn}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDraft((d) => (d ? applyWebTurn(d, v) : d));
              }}
              className={`${fieldInputClass} shrink-0 px-0.5 py-0.5 text-center text-[11px]`}
              style={{ ...fieldInputStyle, width: "calc(2ch + 1.25rem)" }}
              aria-label="ターンから有効"
            >
              {[0, 1, 2, 3, 4, 5, 99].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-[10px] font-semibold text-[#3D1C08]/70">ターンから有効</span>
          </label>
          <InlineNumField
            label="結果文字数"
            value={draft.web_search_result_max_chars}
            widthCh={6}
            min={0}
            onChange={(n) => setDraft((d) => (d ? { ...d, web_search_result_max_chars: n } : d))}
          />
        </SectionRow>
        <div className={`space-y-1 pl-[2ch] ${REIJITSU_BODY_TEXT_CLASS}`}>
          <p className="flex flex-wrap items-center gap-1">
            <span>・実行：検索</span>
            <DigitSelect
              ariaLabel="1ラウンドあたりの検索件数"
              value={draft.web_search_max_per_round}
              onChange={(n) => setDraft((d) => (d ? { ...d, web_search_max_per_round: n } : d))}
            />
            <span>件を</span>
            <DigitSelect
              ariaLabel="実行回数"
              value={draft.web_search_max_rounds}
              onChange={(n) => setDraft((d) => (d ? { ...d, web_search_max_rounds: n } : d))}
            />
            <span>回ループ</span>
          </p>
          <p className="flex flex-wrap items-center gap-1">
            <span>・結果：一件あたり最大</span>
            <input
              type="number"
              min={0}
              value={draft.web_search_snippet_max_chars}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) {
                  setDraft((d) => (d ? { ...d, web_search_snippet_max_chars: Math.floor(n) } : d));
                }
              }}
              aria-label="一件あたり最大文字"
              className={`ao-reijitsu-num-input ${fieldInputClass} shrink-0 px-1 py-0.5 text-[11px]`}
              style={{ ...fieldInputStyle, width: "calc(4ch + 1.25rem)" }}
            />
            <span>文字の上位</span>
            <DigitSelect
              ariaLabel="採用件数"
              value={draft.web_search_tavily_max_results}
              onChange={(n) => setDraft((d) => (d ? { ...d, web_search_tavily_max_results: n } : d))}
            />
            <span>件</span>
          </p>
        </div>
      </section>

      <section>
        <SectionRow>
          <SectionTitle>総合計トークン</SectionTitle>
          <span className="shrink-0 font-mono text-[10px] text-[#1a1208]/90">{envDefaultMaxTokens}</span>
          <input
            type="number"
            min={256}
            max={8192}
            value={draft.max_completion_tokens ?? ""}
            placeholder="空欄で環境既定"
            aria-label="論別 max_completion_tokens 上書き"
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
            className={`${fieldInputClass} min-w-0 flex-1 px-1.5 py-0.5 text-[11px]`}
            style={fieldInputStyle}
          />
        </SectionRow>
      </section>
      {saving ? <p className="text-center text-[10px] text-[#3D1C08]/50">保存中…</p> : null}
    </div>
  );
});
AoReijitsuOverlay.displayName = "AoReijitsuOverlay";
