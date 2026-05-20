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
  type AoPromptSectionKey,
} from "@/lib/ao-prompts";
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

export type AoSettingsSubpage = "global" | "header" | "mode" | "allies";

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
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  const ro = props.readOnly === true;
  return (
    <label className="flex min-h-0 flex-col gap-0.5">
      <span className="shrink-0 text-[10px] font-semibold text-[#3D1C08]/70">{props.label}</span>
      <textarea
        readOnly={ro}
        value={props.value}
        onChange={ro ? undefined : (e) => props.onChange?.(e.target.value)}
        spellCheck={false}
        className="min-h-[72px] w-full resize-y rounded-sm border border-solid px-1.5 py-1 font-serif text-[12px] leading-relaxed outline-none ring-0 transition-[box-shadow,border-color] focus:ring-2 focus:ring-[#DBB961]/35"
        style={{
          backgroundColor: ro ? "#ebe6dc" : AO_EDIT_SURFACE,
          color: ro ? "#3D1C08" : AO_EDIT_INK,
          borderColor: ro ? `${AO_INK}22` : AO_EDIT_BORDER,
          boxShadow: ro ? undefined : "inset 0 1px 0 rgba(255,255,255,0.45)",
        }}
        onFocus={
          ro
            ? undefined
            : (e) => {
                e.target.style.borderColor = AO_EDIT_BORDER_FOCUS;
              }
        }
        onBlur={
          ro
            ? undefined
            : (e) => {
                e.target.style.borderColor = AO_EDIT_BORDER;
              }
        }
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
  const [standaloneSubpage, setStandaloneSubpage] = useState<AoSettingsSubpage>("global");
  const [draftSections, setDraftSections] = useState<Record<AoPromptSectionKey, string>>(() => {
    const o = {} as Record<AoPromptSectionKey, string>;
    for (const k of AO_PROMPT_SECTION_KEYS) o[k] = "";
    return o;
  });
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
          projectModels?: Record<string, string>;
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

  /** レガシー prompt_sections は読取専用。論設定は令旨オーバーレイ（ao_projects）へ移行済み */
  const onConfirm = useCallback(async () => {
    setError(null);
    if (loading) return;
    onClose();
  }, [loading, onClose]);

  useImperativeHandle(
    ref,
    () => ({
      confirmSave: () => onConfirm(),
    }),
    [onConfirm],
  );

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
              disabled={saving || loading}
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
            <p className="mb-2 shrink-0 text-[10px] leading-snug text-[#3D1C08]/65">
              表示のみ（編集は Supabase Table Editor または今後の移行 UI）。論別の実行設定はメイン画面の
              <strong className="font-semibold"> 令旨</strong> から保存してください。
            </p>
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
                      readOnly
                      label={SECTION_LABELS[key] ?? key}
                      value={draftSections[key] ?? ""}
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
                      readOnly
                      label={SECTION_LABELS[key] ?? key}
                      value={draftSections[key] ?? ""}
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
                    <PromptTextarea key={key} readOnly label={SECTION_LABELS[key] ?? key} value={draftSections[key] ?? ""} />
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
                    <PromptTextarea key={key} readOnly label={SECTION_LABELS[key] ?? key} value={draftSections[key] ?? ""} />
                  ))}
                </div>
              </section>
            ) : null}
            {activeSubpage === "allies" ? (
              <section className="flex flex-col gap-2" role="tabpanel" aria-label="僚友">
                <h3 className="mb-1 border-b pb-0.5 text-[11px] font-semibold text-[#3D1C08]" style={{ borderColor: `${AO_INK}22` }}>
                  僚友プロンプト（読取専用）
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
                          <PromptTextarea readOnly label={loreKey} value={draftSections[loreKey] ?? ""} />
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
