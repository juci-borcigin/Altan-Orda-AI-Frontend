"use client";

import Image from "next/image";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { IcoArrowLeft, IcoCheck } from "@/components/ao-action-icons";
import {
  ALLY_LORE_SECTION_KEY,
  AO_PROMPT_SECTION_KEYS,
  AO_SETTINGS_GLOBAL_KEYS,
  AO_SETTINGS_HEADER_KEYS,
  AO_SETTINGS_MODE_KEYS,
  AO_SETTINGS_RULE_KEYS,
  EIGHT_ALLY_NAMES,
  PROJECT_PROMPT_SECTION_KEY,
  type AoPromptSectionKey,
} from "@/lib/ao-prompts";
import { AO_LLM_MODEL_PRESETS } from "@/lib/ao-llm-presets";
import { AO_TOPICS, aoPostingProjectIdForTopic } from "@/lib/ao-topics";
import type { ProjectId } from "@/lib/ao-types";
import { AO_PORTRAIT_LAYOUT_W_PX } from "@/lib/ao-portrait";

const AO_SETTINGS_GOLD = "#DBB961";
const AO_SETTINGS_NAVY = "#133D5C";
const AO_PARCHMENT = "#f6f4ee";
const AO_INK = "#3D1C08";
/** 編集面：チャット AI 吹き出し地と揃えた羊皮紙ベージュ */
const AO_EDIT_SURFACE = "#F4F0E7";
const AO_EDIT_INK = "#141008";
const AO_EDIT_BORDER = "#c9b89e";
const AO_EDIT_BORDER_FOCUS = "#8f7352";
/** 使用量オーバーレイと同系・枠なしアイコンボタン */
const SETTINGS_HDR_BTN_CLASS =
  "flex items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-[#3D1C08] hover:bg-black/5 disabled:opacity-40 disabled:hover:bg-transparent";
const ALLY_AVATAR_SRC: Record<string, string> = {
  フナン: "/personas/AO_Char_Hunan.png",
  モンケウール: "/personas/AO_Char_Mongkeur.png",
  ケテ: "/personas/AO_Char_Qete.png",
  バイジュ: "/personas/AO_Char_Baiju.png",
  "クドゥカ・ベキ": "/personas/AO_Char_QudukaBeki.png",
  "タタ・トゥンガ": "/personas/AO_Char_TataTunga.png",
  "チン・テムール": "/personas/AO_Char_ChinTemur.png",
  コルグズ: "/personas/AO_Char_Qorguz.png",
};

export type AoSettingsSubpage = "global" | "header" | "mode" | "ron" | "allies";

const AO_SETTINGS_SUBPAGE_TAB_INACTIVE =
  "rounded-sm border border-transparent px-1 py-0 text-[10px] font-semibold leading-tight text-[#6A3F0A] outline-none transition-colors hover:bg-black/5 hover:text-[#3D1C08]";
const AO_SETTINGS_SUBPAGE_TAB_ACTIVE =
  "rounded-sm border border-[#3D1C08]/35 bg-[#fffaf0] px-1 py-0 text-[10px] font-semibold leading-tight text-[#3D1C08] outline-none";

/** 設定ページ内サブ切替（帯「設　定」行 or 単体オーバーレイヘッダで使用） */
export function AoSettingsSubpageTabs({
  active,
  onChange,
  className = "",
}: {
  active: AoSettingsSubpage;
  onChange: (t: AoSettingsSubpage) => void;
  className?: string;
}) {
  const items: { id: AoSettingsSubpage; label: string }[] = [
    { id: "global", label: "グローバル" },
    { id: "header", label: "ヘッダ" },
    { id: "mode", label: "モード" },
    { id: "ron", label: "論" },
    { id: "allies", label: "僚友" },
  ];
  return (
    <div role="tablist" aria-orientation="horizontal" className={`flex flex-wrap items-center gap-px ${className}`}>
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={active === id ? AO_SETTINGS_SUBPAGE_TAB_ACTIVE : AO_SETTINGS_SUBPAGE_TAB_INACTIVE}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const SECTION_LABELS: Partial<Record<AoPromptSectionKey, string>> = {
  global_system: "global_system — API コール元・システム概要",
  global_world: "global_world — 世界観",
  global_glossary: "global_glossary — 用語",
  global_summary_persona: "global_summary_persona — ペルソナ要約",
  global_summary_project: "global_summary_project — 論（プロジェクト）要約",
  rule_general: "rule_general — 対話ルール（一般）",
  rule_detail: "rule_detail — 対話ルール（詳細）",
  rule_format: "rule_format — 出力形式",
  header_profile: "header_profile — プロフィール注入（初回等）",
  header_thinking: "header_thinking — 思考ヘッダ",
  mode_casual: "mode_casual — 雑談モード",
  mode_designate: "mode_designate — 名指しモード",
};

function PromptTextarea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-h-0 flex-col gap-0.5">
      <span className="shrink-0 text-[10px] font-semibold text-[#3D1C08]/70">{props.label}</span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        spellCheck={false}
        className="min-h-[72px] w-full resize-y rounded-sm border border-solid px-1.5 py-1 font-serif text-[12px] leading-relaxed outline-none ring-0 transition-[box-shadow,border-color] focus:ring-2 focus:ring-[#DBB961]/35"
        style={{
          backgroundColor: AO_EDIT_SURFACE,
          color: AO_EDIT_INK,
          borderColor: AO_EDIT_BORDER,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = AO_EDIT_BORDER_FOCUS;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = AO_EDIT_BORDER;
        }}
      />
    </label>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** メイン帯に埋め込むとき true（absolute 全画面ラッパーを付けない） */
  embedded?: boolean;
  /** embedded 時：帯ヘッダのタブと同期 */
  embeddedSubpage?: AoSettingsSubpage;
  onEmbeddedSubpageChange?: (v: AoSettingsSubpage) => void;
};

export type AoSettingsOverlayHandle = {
  /** 確定（保存）。embedded 時は帯ヘッダのチェックから呼ぶ */
  confirmSave: () => Promise<void>;
};

export const AoSettingsOverlay = forwardRef<AoSettingsOverlayHandle, Props>(function AoSettingsOverlay(
  { open, onClose, embedded = false, embeddedSubpage, onEmbeddedSubpageChange },
  ref,
) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);
  const [envDefaultModel, setEnvDefaultModel] = useState("");
  const [standaloneSubpage, setStandaloneSubpage] = useState<AoSettingsSubpage>("global");
  const [draftSections, setDraftSections] = useState<Record<AoPromptSectionKey, string>>(() => {
    const o = {} as Record<AoPromptSectionKey, string>;
    for (const k of AO_PROMPT_SECTION_KEYS) o[k] = "";
    return o;
  });
  const [draftProjectModels, setDraftProjectModels] = useState<Partial<Record<ProjectId, string>>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/settings/prompts");
        const data = (await res.json()) as {
          sections?: Record<string, string>;
          projectModels?: Partial<Record<ProjectId, string>>;
          envDefaultModel?: string;
          llmApi?: { host?: string; isOpenRouter?: boolean };
          supabaseConfigured?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "設定の読み込みに失敗しました");
        if (cancelled) return;
        const nextS = {} as Record<AoPromptSectionKey, string>;
        for (const k of AO_PROMPT_SECTION_KEYS) {
          nextS[k] = typeof data.sections?.[k] === "string" ? data.sections[k] : "";
        }
        setDraftSections(nextS);
        const pm: Partial<Record<ProjectId, string>> = {};
        for (const tp of AO_TOPICS) {
          const pid = aoPostingProjectIdForTopic(tp.id);
          pm[pid] = data.projectModels?.[pid] ?? "";
        }
        setDraftProjectModels(pm);
        setEnvDefaultModel(data.envDefaultModel ?? "");
        setSupabaseConfigured(data.supabaseConfigured !== false);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setStandaloneSubpage("global");
  }, [open]);

  const activeSubpage: AoSettingsSubpage = embedded ? (embeddedSubpage ?? "global") : standaloneSubpage;

  function setActiveSubpage(v: AoSettingsSubpage) {
    if (embedded) {
      onEmbeddedSubpageChange?.(v);
    } else {
      setStandaloneSubpage(v);
    }
  }

  const onConfirm = useCallback(async () => {
    setError(null);
    if (loading) return;
    if (!supabaseConfigured) {
      setError("Supabase が未設定のため保存できません。");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: draftSections,
          projectModels: draftProjectModels,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok) {
        throw new Error([data.error, data.detail].filter(Boolean).join(" — "));
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [loading, supabaseConfigured, draftSections, draftProjectModels, onClose]);

  useImperativeHandle(
    ref,
    () => ({
      confirmSave: () => onConfirm(),
    }),
    [onConfirm],
  );

  function setSection(key: AoPromptSectionKey, v: string) {
    setDraftSections((prev) => ({ ...prev, [key]: v }));
  }

  function setProjectModel(pid: ProjectId, v: string) {
    setDraftProjectModels((prev) => ({ ...prev, [pid]: v }));
  }

  if (!open) return null;

  const rootClass = embedded
    ? "flex min-h-0 min-w-0 flex-1 flex-col box-border overflow-x-hidden px-1.5 pb-1 pt-0 ao-p5-parchment-surface"
    : "absolute inset-0 z-[55] flex min-h-0 min-w-0 flex-col box-border overflow-x-hidden px-2 pb-2 pt-0.5 ao-p5-parchment-surface";

  return (
    <div className={rootClass} style={{ backgroundColor: AO_PARCHMENT }} role="dialog" aria-label="設定">
      {!embedded ? (
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1 border-b border-[#3D1C08]/15 px-2 pb-1.5 pt-1">
          <div className="min-w-0 shrink-0" aria-hidden />
          <div className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
            <span className="shrink-0 font-serif text-[14px] font-semibold tracking-[0.12em] text-[#3D1C08]">設　定</span>
            <AoSettingsSubpageTabs active={activeSubpage} onChange={setActiveSubpage} />
          </div>
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-1">
            <button
              type="button"
              className={SETTINGS_HDR_BTN_CLASS}
              aria-label={saving ? "保存中" : "確定"}
              onClick={() => void onConfirm()}
              disabled={saving || loading || !supabaseConfigured}
            >
              {saving ? (
                <span className="whitespace-nowrap px-0.5 text-[9px] leading-none text-[#DBB961]">保存中…</span>
              ) : (
                <IcoCheck size={14} />
              )}
            </button>
            <button type="button" className={SETTINGS_HDR_BTN_CLASS} aria-label="戻る" onClick={onClose} disabled={saving}>
              <IcoArrowLeft size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {!supabaseConfigured ? (
        <div className="shrink-0 px-2 pb-2 text-center text-[12px] text-amber-200/95">
          Supabase（サービスロール）が未設定です。表示のみでき、確定では保存されません。
        </div>
      ) : null}

      {error ? (
        <div className="shrink-0 px-2 pb-2 text-center text-[12px] text-red-300">{error}</div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-y-auto border border-solid [scrollbar-gutter:stable] px-2 py-1"
        style={{ borderColor: AO_INK, borderWidth: 1, backgroundColor: "#faf6ee" }}
      >
        {loading ? (
          <div className="py-6 text-center text-[12px] text-[#3D1C08]/60">読み込み中…</div>
        ) : (
          <div className="min-h-0 flex-1 pb-2">
            {activeSubpage === "global" ? (
              <section className="flex flex-col gap-2" role="tabpanel" aria-label="グローバル">
                <h3
                  className="mb-0.5 border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]"
                  style={{ borderColor: `${AO_INK}22` }}
                >
                  Global
                </h3>
                <div className="flex flex-col gap-2">
                  {AO_SETTINGS_GLOBAL_KEYS.map((key) => (
                    <PromptTextarea
                      key={key}
                      label={SECTION_LABELS[key] ?? key}
                      value={draftSections[key] ?? ""}
                      onChange={(v) => setSection(key, v)}
                    />
                  ))}
                </div>
                <h3
                  className="mb-0.5 mt-2 border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]"
                  style={{ borderColor: `${AO_INK}22` }}
                >
                  Rules
                </h3>
                <div className="flex flex-col gap-2">
                  {AO_SETTINGS_RULE_KEYS.map((key) => (
                    <PromptTextarea
                      key={key}
                      label={SECTION_LABELS[key] ?? key}
                      value={draftSections[key] ?? ""}
                      onChange={(v) => setSection(key, v)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {activeSubpage === "header" ? (
              <section className="flex flex-col gap-2" role="tabpanel" aria-label="ヘッダ">
                <h3 className="mb-1 border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
                  ヘッダ
                </h3>
                <div className="flex flex-col gap-2">
                  {AO_SETTINGS_HEADER_KEYS.map((key) => (
                    <PromptTextarea
                      key={key}
                      label={SECTION_LABELS[key] ?? key}
                      value={draftSections[key] ?? ""}
                      onChange={(v) => setSection(key, v)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {activeSubpage === "mode" ? (
              <section className="flex flex-col gap-2" role="tabpanel" aria-label="モード">
                <h3 className="mb-1 border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
                  モード
                </h3>
                <div className="flex flex-col gap-2">
                  {AO_SETTINGS_MODE_KEYS.map((key) => (
                    <PromptTextarea
                      key={key}
                      label={SECTION_LABELS[key] ?? key}
                      value={draftSections[key] ?? ""}
                      onChange={(v) => setSection(key, v)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {activeSubpage === "ron" ? (
              <section className="flex flex-col gap-2" role="tabpanel" aria-label="論">
                <h3 className="mb-1 border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
                  論ごとのプロンプト・AI モデル
                </h3>
                <p className="mb-2 text-[10px] leading-snug text-[#3D1C08]/70">
                  チャット送信時は「共通 API 接続先」のまま、
                  <strong className="font-semibold text-[#1a1208]"> モデル ID だけ</strong>が論ごとに切り替わります（OpenRouter なら{" "}
                  <code className="rounded bg-black/5 px-0.5 font-mono text-[10px] text-[#1a1208]/90">vendor/model</code>）。
                </p>
                <div className="flex flex-col gap-2.5">
                  {AO_TOPICS.map((tp) => {
                    const pid = aoPostingProjectIdForTopic(tp.id);
                    const sectionKey = PROJECT_PROMPT_SECTION_KEY[pid];
                    const modelVal = draftProjectModels[pid] ?? "";
                    const presetValues = new Set(AO_LLM_MODEL_PRESETS.map((p) => p.value));
                    const showCustom = modelVal !== "" && !presetValues.has(modelVal);
                    const effectiveModelId = modelVal.trim() || envDefaultModel.trim();
                    const modelSourceLabel = modelVal.trim() ? "論別（ao_projects.model_id）" : "環境既定（LLM_MODEL）";
                    const modelTitle = `${effectiveModelId || "（未設定）"} — ${modelSourceLabel}`;
                    return (
                      <div key={tp.id} className="flex flex-col gap-1.5 border-b pb-2 last:border-b-0" style={{ borderColor: `${AO_INK}22` }}>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-serif text-[11px] leading-snug text-[#3D1C08]">
                          <span className="shrink-0 font-semibold tracking-wide text-[#3D1C08]">
                            {tp.label}
                            {"\u3000"}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-[#3D1C08]/60">project_id={pid}</span>
                          <span className="shrink-0 text-[#3D1C08]/70">モデル：</span>
                          <span
                            className="min-w-0 max-w-[10.5rem] shrink truncate font-mono text-[11px] text-[#1a1208] sm:max-w-[14rem]"
                            title={modelTitle}
                          >
                            {effectiveModelId || "（.env 未設定）"}
                          </span>
                          <span className="shrink-0 text-[#3D1C08]/70">変更</span>
                          <select
                            aria-label={`${tp.label} のモデル`}
                            value={showCustom ? "__custom__" : modelVal}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "__custom__") return;
                              setProjectModel(pid, v);
                            }}
                            className="min-h-[26px] min-w-0 max-w-[min(100%,240px)] shrink rounded-sm border border-solid px-2 py-0.5 font-mono text-[11px] outline-none focus:ring-2 focus:ring-[#DBB961]/35"
                            style={{
                              backgroundColor: AO_EDIT_SURFACE,
                              color: AO_EDIT_INK,
                              borderColor: AO_EDIT_BORDER,
                            }}
                          >
                            {AO_LLM_MODEL_PRESETS.map((p) => (
                              <option key={p.label + p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                            {showCustom ? <option value="__custom__">その他（現在の値）</option> : null}
                          </select>
                        </div>
                        {showCustom ? (
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-[#3D1C08]/60">モデル ID（直接入力）</span>
                            <input
                              value={modelVal}
                              onChange={(e) => setProjectModel(pid, e.target.value)}
                              className="w-full rounded-sm border border-solid px-2 py-1 font-mono text-[11px] outline-none focus:ring-2 focus:ring-[#DBB961]/35"
                              style={{
                                backgroundColor: AO_EDIT_SURFACE,
                                color: AO_EDIT_INK,
                                borderColor: AO_EDIT_BORDER,
                              }}
                            />
                          </label>
                        ) : null}
                        <PromptTextarea
                          label={`${sectionKey}（${tp.label}）`}
                          value={draftSections[sectionKey] ?? ""}
                          onChange={(v) => setSection(sectionKey, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {activeSubpage === "allies" ? (
              <section className="flex flex-col gap-2" role="tabpanel" aria-label="僚友">
                <h3 className="mb-1 border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
                  僚友プロンプト（表示のみで顔グラ）
                </h3>
                <div className="flex flex-col gap-2">
                  {EIGHT_ALLY_NAMES.map((name) => {
                    const loreKey = ALLY_LORE_SECTION_KEY[name];
                    if (!loreKey) return null;
                    const src = ALLY_AVATAR_SRC[name];
                    return (
                      <div key={name} className="flex gap-2 border-b pb-2 last:border-b-0" style={{ borderColor: `${AO_SETTINGS_GOLD}33` }}>
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <div className="ao-portrait-frame overflow-hidden rounded-none bg-black/15">
                            {src ? (
                              <Image src={src} alt={name} fill sizes={`${AO_PORTRAIT_LAYOUT_W_PX}px`} className="object-cover object-top" />
                            ) : null}
                          </div>
                          <span className="max-w-[72px] text-center text-[10px] font-semibold leading-tight text-[#DBB961]">{name}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <PromptTextarea label={loreKey} value={draftSections[loreKey] ?? ""} onChange={(v) => setSection(loreKey, v)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
});
AoSettingsOverlay.displayName = "AoSettingsOverlay";
