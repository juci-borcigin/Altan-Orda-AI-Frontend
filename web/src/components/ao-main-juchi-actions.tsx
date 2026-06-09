"use client";

import type { RefObject } from "react";
import { IcoExecute, IcoPaperclip, IcoScroll } from "@/components/ao-action-icons";
import { AO_ATTACHMENT_ACCEPT, AO_ATTACHMENT_MAX_COUNT } from "@/lib/ao-attachments";

type AoMainJuchiActionsProps = {
  attachInputRef: RefObject<HTMLInputElement | null>;
  composeLocked: boolean;
  pendingAttachmentCount: number;
  onAttachSelected: (files: FileList | null) => void;
  onSend: () => void;
  onOpenContext: () => void;
  iconSize: number;
  sendBtnClass: string;
  iconBtnClass: string;
  compactPadding?: boolean;
};

/** 邦主列：送信（1行目・全幅）＋ 添付・令旨（2行目） */
export function AoMainJuchiActions({
  attachInputRef,
  composeLocked,
  pendingAttachmentCount,
  onAttachSelected,
  onSend,
  onOpenContext,
  iconSize,
  sendBtnClass,
  iconBtnClass,
  compactPadding = false,
}: AoMainJuchiActionsProps) {
  const pad = compactPadding ? "p-1.5" : "";
  return (
    <div className="relative z-30 flex w-full flex-col items-center gap-1 px-0.5 pt-0.5">
      <input
        ref={attachInputRef}
        type="file"
        accept={AO_ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => onAttachSelected(e.target.files)}
      />
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
      <div className="flex w-full items-center justify-center gap-2">
        <button
          type="button"
          disabled={composeLocked || pendingAttachmentCount >= AO_ATTACHMENT_MAX_COUNT}
          onClick={() => attachInputRef.current?.click()}
          aria-label="ファイルを添付"
          className={`relative z-30 shrink-0 cursor-pointer touch-manipulation select-none ${iconBtnClass} ${pad} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <span className="ao-p5-kurultai-ink-icon">
            <IcoPaperclip size={iconSize} />
          </span>
        </button>
        <button
          type="button"
          className={`relative z-30 shrink-0 cursor-pointer touch-manipulation select-none ${iconBtnClass} ${pad}`}
          aria-label="令旨"
          onClick={onOpenContext}
        >
          <span className="ao-p5-kurultai-ink-icon">
            <IcoScroll size={iconSize} />
          </span>
        </button>
      </div>
    </div>
  );
}
