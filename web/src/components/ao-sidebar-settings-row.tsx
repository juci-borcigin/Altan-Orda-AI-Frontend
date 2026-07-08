"use client";

import { IcoBook, IcoCoinBag, IcoGear } from "@/components/ao-action-icons";

const AO_SIDEBAR_SETTINGS_ICON_BTN_CLASS =
  "inline-flex items-center justify-center rounded-md border-0 bg-transparent p-1 outline-none transition-[transform,opacity] hover:bg-[#8D5400]/[0.08] active:scale-[0.9] active:opacity-90";

type AoSidebarSettingsRowProps = {
  iconSize: number;
  onOpenChronicle: () => void;
  onOpenUsage: () => void;
  onOpenSettings: () => void;
};

/** 左サイドバー設定エリア：年代記・使用量・設定（3 アイコン横並び） */
export function AoSidebarSettingsRow({
  iconSize,
  onOpenChronicle,
  onOpenUsage,
  onOpenSettings,
}: AoSidebarSettingsRowProps) {
  return (
    <div className="flex w-full items-center justify-center gap-0.5 py-1">
      <button
        type="button"
        className={AO_SIDEBAR_SETTINGS_ICON_BTN_CLASS}
        aria-label="年代記"
        onClick={onOpenChronicle}
      >
        <span className="ao-p5-kurultai-ink-icon">
          <IcoBook size={iconSize} />
        </span>
      </button>
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
        className={AO_SIDEBAR_SETTINGS_ICON_BTN_CLASS}
        aria-label="設定を開く"
        onClick={onOpenSettings}
      >
        <span className="ao-p5-kurultai-ink-icon">
          <IcoGear size={iconSize} />
        </span>
      </button>
    </div>
  );
}
