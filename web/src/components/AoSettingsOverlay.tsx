"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { IcoArrowLeft, IcoCheck } from "@/components/ao-action-icons";
import {
  ALLY_LORE_SECTION_KEY,
  AO_PROMPT_SECTION_KEYS,
  AO_SETTINGS_GLOBAL_KEYS,
  AO_SETTINGS_HEADER_MODE_KEYS,
  AO_SETTINGS_RULE_KEYS,
  EIGHT_ALLY_NAMES,
  PROJECT_PROMPT_SECTION_KEY,
  type AoPromptSectionKey,
} from "@/lib/ao-prompts";
import { AO_LLM_MODEL_PRESETS } from "@/lib/ao-llm-presets";
import { AO_TOPICS, aoPostingProjectIdForTopic } from "@/lib/ao-topics";
import type { ProjectId } from "@/lib/ao-types";

const AO_SETTINGS_GOLD = "#DBB961";
const AO_SETTINGS_NAVY = "#133D5C";
/** 編集面：チャット AI 吹き出し地と揃えた羊皮紙ベージュ */
const AO_EDIT_SURFACE = "#F4F0E7";
const AO_EDIT_INK = "#141008";
const AO_EDIT_BORDER = "#c9b89e";
const AO_EDIT_BORDER_FOCUS = "#8f7352";
/** 使用量オーバーレイと同系・枠なしアイコンボタン */
const SETTINGS_HDR_BTN_CLASS =
  "flex items-center justify-center rounded-sm border-0 bg-transparent p-1.5 text-[#DBB961] hover:bg-[#143d5e]/80 disabled:opacity-40 disabled:hover:bg-transparent";
const NOKOR_PORTRAIT_W_PX = 52;
const NOKOR_ASPECT_CLASS = "aspect-[4/5]";

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
    <label className="flex min-h-0 flex-col gap-1">
      <span className="shrink-0 text-[11px] font-semibold text-[#c2cad6]">{props.label}</span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        spellCheck={false}
        className="min-h-[88px] w-full resize-y rounded-sm border border-solid px-2 py-1.5 font-serif text-[12px] leading-relaxed outline-none ring-0 transition-[box-shadow,border-color] focus:ring-2 focus:ring-[#DBB961]/35"
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
};

export function AoSettingsOverlay({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);
  const [envDefaultModel, setEnvDefaultModel] = useState("");
  const [draftSections, setDraftSections] = useState<Record<AoPromptSectionKey, string>>(() => {
    const o = {} as Record<AoPromptSectionKey, string>;
    for (const k of AO_PROMPT_SECTION_KEYS) o[k] = "";
    return o;
  });
  const [draftProjectModels, setDraftProjectModels] = useState<Partial<Record<ProjectId, string>>>({});
  const [llmApi, setLlmApi] = useState<{ host: string; isOpenRouter: boolean } | null>(null);

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
        const h = data.llmApi?.host?.trim();
        setLlmApi(
          h
            ? { host: h, isOpenRouter: Boolean(data.llmApi?.isOpenRouter) }
            : null,
        );
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

  async function onConfirm() {
    setError(null);
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
  }

  function setSection(key: AoPromptSectionKey, v: string) {
    setDraftSections((prev) => ({ ...prev, [key]: v }));
  }

  function setProjectModel(pid: ProjectId, v: string) {
    setDraftProjectModels((prev) => ({ ...prev, [pid]: v }));
  }

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[55] flex min-h-0 flex-col box-border px-3 pb-3 pt-1"
      style={{ backgroundColor: AO_SETTINGS_NAVY }}
      role="dialog"
      aria-label="設定"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 pb-2 pt-0">
        <div className="min-w-0 flex-1 space-y-0.5 px-0.5 text-left text-[11px] leading-snug text-[#9eb3c9]">
          <div>
            環境既定モデル（プルダウン「環境既定」時）:{" "}
            <span className="font-mono text-[#c2cad6]">{envDefaultModel || "（未設定）"}</span>
          </div>
          {llmApi ? (
            <div>
              共通 API 接続先（サーバー）: <span className="font-mono text-[#e8d9c4]">{llmApi.host}</span>
              <span className="text-[#9eb3c9]/90">{llmApi.isOpenRouter ? " — OpenRouter" : " — OpenAI 互換"}</span>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <button
            type="button"
            className={SETTINGS_HDR_BTN_CLASS}
            aria-label={saving ? "保存中" : "確定"}
            onClick={() => void onConfirm()}
            disabled={saving || loading || !supabaseConfigured}
          >
            {saving ? (
              <span className="whitespace-nowrap px-0.5 text-[10px] leading-none text-[#DBB961]">保存中…</span>
            ) : (
              <IcoCheck size={18} />
            )}
          </button>
          <button type="button" className={SETTINGS_HDR_BTN_CLASS} aria-label="戻る" onClick={onClose} disabled={saving}>
            <IcoArrowLeft size={18} />
          </button>
        </div>
      </div>

      {!supabaseConfigured ? (
        <div className="shrink-0 px-2 pb-2 text-center text-[12px] text-amber-200/95">
          Supabase（サービスロール）が未設定です。表示のみでき、確定では保存されません。
        </div>
      ) : null}

      {error ? (
        <div className="shrink-0 px-2 pb-2 text-center text-[12px] text-red-300">{error}</div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-y-auto border border-solid [scrollbar-gutter:stable] px-3 py-2"
        style={{ borderColor: AO_SETTINGS_GOLD, borderWidth: 1, backgroundColor: AO_SETTINGS_NAVY }}
      >
        {loading ? (
          <div className="py-8 text-center text-[13px] text-[#c2cad6]">読み込み中…</div>
        ) : (
          <div className="flex flex-col gap-6 pb-6">
            <section>
              <h3 className="mb-2 border-b pb-1 text-[13px] font-semibold text-[#DBB961]" style={{ borderColor: `${AO_SETTINGS_GOLD}55` }}>
                グローバル・共通プロンプト
              </h3>
              <div className="flex flex-col gap-3">
                {AO_SETTINGS_GLOBAL_KEYS.map((key) => (
                  <PromptTextarea
                    key={key}
                    label={SECTION_LABELS[key] ?? key}
                    value={draftSections[key] ?? ""}
                    onChange={(v) => setSection(key, v)}
                  />
                ))}
                <p className="text-[11px] text-[#9eb3c9]">ルール</p>
                {AO_SETTINGS_RULE_KEYS.map((key) => (
                  <PromptTextarea
                    key={key}
                    label={SECTION_LABELS[key] ?? key}
                    value={draftSections[key] ?? ""}
                    onChange={(v) => setSection(key, v)}
                  />
                ))}
                <p className="text-[11px] text-[#9eb3c9]">ヘッダ・モード</p>
                {AO_SETTINGS_HEADER_MODE_KEYS.map((key) => (
                  <PromptTextarea
                    key={key}
                    label={SECTION_LABELS[key] ?? key}
                    value={draftSections[key] ?? ""}
                    onChange={(v) => setSection(key, v)}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 border-b pb-1 text-[13px] font-semibold text-[#DBB961]" style={{ borderColor: `${AO_SETTINGS_GOLD}55` }}>
                論ごとのプロンプト・AI モデル
              </h3>
              <p className="mb-3 text-[11px] leading-snug text-[#b0c4d4]">
                チャット送信時は「共通 API 接続先」のまま、
                <strong className="font-semibold text-[#e8d9c4]"> モデル ID だけ</strong>が論ごとに切り替わります（OpenRouter なら{" "}
                <code className="rounded px-0.5 font-mono text-[10px] text-[#FAF3E6]/90">vendor/model</code>）。
              </p>
              <div className="flex flex-col gap-4">
                {AO_TOPICS.map((tp) => {
                  const pid = aoPostingProjectIdForTopic(tp.id);
                  const sectionKey = PROJECT_PROMPT_SECTION_KEY[pid];
                  const modelVal = draftProjectModels[pid] ?? "";
                  const presetValues = new Set(AO_LLM_MODEL_PRESETS.map((p) => p.value));
                  const showCustom = modelVal !== "" && !presetValues.has(modelVal);
                  const effectiveModelId = modelVal.trim() || envDefaultModel.trim();
                  const modelSourceLabel = modelVal.trim() ? "論別（ao_project_llm）" : "環境既定（LLM_MODEL）";
                  const modelTitle =
                    `${effectiveModelId || "（未設定）"} — ${modelSourceLabel}`;
                  return (
                    <div key={tp.id} className="flex flex-col gap-2 border-b pb-4 last:border-b-0" style={{ borderColor: `${AO_SETTINGS_GOLD}33` }}>
                      {/* 為政論　project_id=plan モデル：＜現在＞ 変更 ＜プルダウン＞ */}
                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-serif text-[11px] leading-snug">
                        <span className="shrink-0 font-semibold tracking-wide text-[#FAF3E6]">
                          {tp.label}
                          {/* U+3000 為政論　project_id=plan */}
                          {"\u3000"}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-[#9eb3c9]">project_id={pid}</span>
                        <span className="shrink-0 text-[#c2cad6]">モデル：</span>
                        <span
                          className="min-w-0 max-w-[10.5rem] shrink truncate font-mono text-[11px] text-[#e8d9c4] sm:max-w-[14rem]"
                          title={modelTitle}
                        >
                          {effectiveModelId || "（.env 未設定）"}
                        </span>
                        <span className="shrink-0 text-[#c2cad6]">変更</span>
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
                          {showCustom ? (
                            <option value="__custom__">その他（現在の値）</option>
                          ) : null}
                        </select>
                      </div>
                      {showCustom ? (
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-[#9eb3c9]">モデル ID（直接入力）</span>
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

            <section>
              <h3 className="mb-2 border-b pb-1 text-[13px] font-semibold text-[#DBB961]" style={{ borderColor: `${AO_SETTINGS_GOLD}55` }}>
                僚友プロンプト（表示のみで顔グラ）
              </h3>
              <div className="flex flex-col gap-4">
                {EIGHT_ALLY_NAMES.map((name) => {
                  const loreKey = ALLY_LORE_SECTION_KEY[name];
                  if (!loreKey) return null;
                  const src = ALLY_AVATAR_SRC[name];
                  return (
                    <div key={name} className="flex gap-3 border-b pb-4 last:border-b-0" style={{ borderColor: `${AO_SETTINGS_GOLD}33` }}>
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <div className={`relative overflow-hidden rounded-none bg-black/15 ${NOKOR_ASPECT_CLASS}`} style={{ width: NOKOR_PORTRAIT_W_PX }}>
                          {src ? (
                            <Image src={src} alt={name} fill sizes={`${NOKOR_PORTRAIT_W_PX}px`} className="object-cover object-top" />
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
          </div>
        )}
      </div>
    </div>
  );
}
