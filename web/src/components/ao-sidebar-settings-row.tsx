"use client";

import { IcoCoinBag, IcoGear } from "@/components/ao-action-icons";

const AO_SIDEBAR_SETTINGS_ICON_BTN_CLASS =
  "inline-flex items-center justify-center rounded-md border-0 bg-transparent p-1 outline-none transition-[transform,opacity] hover:bg-[#8D5400]/[0.08] active:scale-[0.9] active:opacity-90";

const AO_SIDEBAR_SETTINGS_ICON_BTN_DISABLED_CLASS =
  "inline-flex cursor-not-allowed items-center justify-center rounded-md border-0 bg-transparent p-1 opacity-40 outline-none";

/** 機能切替。チャット／ナレッジは第1弾で有効。他は表示のみ */
export const AO_FEATURE_SWITCH_LABELS = [
  { id: "chat", label: "チャット", selectable: true },
  { id: "knowledge", label: "ナレッジ", selectable: true },
  { id: "notebook", label: "ノートブック", selectable: false },
  { id: "news", label: "ニュース", selectable: false },
  { id: "organize", label: "オーガナイズ", selectable: false },
] as const;

export type AoFeatureId = (typeof AO_FEATURE_SWITCH_LABELS)[number]["id"];

type AoSidebarSettingsRowProps = {
  iconSize: number;
  onOpenUsage: () => void;
  /** 未指定時は歯車を無効（機能横断の全体設定は未定） */
  onOpenSettings?: () => void;
  activeFeatureId?: AoFeatureId;
  onSelectFeature?: (id: AoFeatureId) => void;
};

/** 左サイドバー横断枠：機能切替テキスト＋使用量・設定 */
export function AoSidebarSettingsRow({
  iconSize,
  onOpenUsage,
  onOpenSettings,
  activeFeatureId = "chat",
  onSelectFeature,
}: AoSidebarSettingsRowProps) {
  return (
    <div className="flex w-full flex-col items-stretch gap-1 py-1">
      <ul className="m-0 flex list-none flex-col divide-y divide-solid divide-[#3D1C08]/[0.14] p-0" role="list">
        {AO_FEATURE_SWITCH_LABELS.map((f) => {
          const on = f.id === activeFeatureId;
          const selectable = f.selectable;
          return (
            <li key={f.id} className="m-0 p-0">
              {selectable && onSelectFeature ? (
                <button
                  type="button"
                  className={`w-full border-0 px-1 py-1.5 text-center font-serif text-[12px] leading-tight tracking-wide text-[#3D1C08] outline-none ${
                    on
                      ? "bg-black/[0.06] font-semibold shadow-[inset_0_1px_4px_rgba(0,0,0,0.12)]"
                      : "bg-transparent opacity-80 hover:bg-black/[0.04]"
                  }`}
                  aria-current={on ? "page" : undefined}
                  onClick={() => onSelectFeature(f.id)}
                >
                  {f.label}
                </button>
              ) : (
                <div
                  className={`px-1 py-1.5 text-center font-serif text-[12px] leading-tight tracking-wide text-[#3D1C08] ${
                    on
                      ? "bg-black/[0.06] font-semibold shadow-[inset_0_1px_4px_rgba(0,0,0,0.12)]"
                      : "opacity-50"
                  }`}
                  aria-current={on ? "page" : undefined}
                >
                  {f.label}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex w-full items-center justify-center gap-0.5 border-t border-[#3D1C08]/[0.14] pt-1">
        <button
          type="button"
          className={AO_SIDEBAR_SETTINGS_ICON_BTN_CLASS}
          aria-label="AI API 使用量を表示"
          onClick={onOpenUsage}
        >
          <span className="ao-p5-kurultai-ink-icon">
            <IcoCoinBag size={iconSize} />
          </span>
        </button>
        <button
          type="button"
          className={
            onOpenSettings
              ? AO_SIDEBAR_SETTINGS_ICON_BTN_CLASS
              : AO_SIDEBAR_SETTINGS_ICON_BTN_DISABLED_CLASS
          }
          aria-label={onOpenSettings ? "設定を開く" : "全体設定（準備中）"}
          disabled={!onOpenSettings}
          onClick={onOpenSettings}
        >
          <span className="ao-p5-kurultai-ink-icon">
            <IcoGear size={iconSize} />
          </span>
        </button>
      </div>
    </div>
  );
}
