"use client";

import { IcoExecute } from "@/components/ao-action-icons";

type AoMainJuchiActionsProps = {
  composeLocked: boolean;
  onSend: () => void;
  iconSize: number;
  sendBtnClass: string;
  compactPadding?: boolean;
};

/** 邦主列：送信のみ（添付・令旨は議事タイトル右へ移動） */
export function AoMainJuchiActions({
  composeLocked,
  onSend,
  iconSize,
  sendBtnClass,
  compactPadding = false,
}: AoMainJuchiActionsProps) {
  return (
    <div className="relative z-30 w-full px-0.5 pt-0.5">
      <button
        type="button"
        disabled={composeLocked}
        onClick={onSend}
        aria-label="送信"
        className={`${sendBtnClass} ${compactPadding ? "px-1.5 py-1" : ""} relative z-30 box-border w-full touch-manipulation select-none disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <span className="ao-p5-kurultai-ink-icon flex w-full items-center justify-center">
          <IcoExecute size={iconSize} />
        </span>
      </button>
    </div>
  );
}
