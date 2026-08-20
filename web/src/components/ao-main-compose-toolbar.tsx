"use client";

import type { RefObject } from "react";
import { IcoBook, IcoPaperclip, IcoScroll } from "@/components/ao-action-icons";
import { AO_ATTACHMENT_MAX_COUNT } from "@/lib/ao-attachments";

type AoMainComposeToolbarProps = {
  attachInputRef: RefObject<HTMLInputElement | null>;
  composeLocked: boolean;
  pendingAttachmentCount: number;
  onAttachSelected: (files: FileList | null) => void;
  onOpenContext: () => void;
  onOpenChronicle: () => void;
  iconSize: number;
  iconBtnClass: string;
  compactPadding?: boolean;
  accept: string;
};

/** 議事タイトル右：添付・設定（巻物）・年代記 */
export function AoMainComposeToolbar({
  attachInputRef,
  composeLocked,
  pendingAttachmentCount,
  onAttachSelected,
  onOpenContext,
  onOpenChronicle,
  iconSize,
  iconBtnClass,
  compactPadding = false,
  accept,
}: AoMainComposeToolbarProps) {
  const pad = compactPadding ? "p-1.5" : "";
  return (
    <div className="flex shrink-0 items-center justify-center gap-[3px]">
      <input
        ref={attachInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => onAttachSelected(e.target.files)}
      />
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
        aria-label="設定"
        onClick={onOpenContext}
      >
        <span className="ao-p5-kurultai-ink-icon">
          <IcoScroll size={iconSize} />
        </span>
      </button>
      <button
        type="button"
        className={`relative z-30 shrink-0 cursor-pointer touch-manipulation select-none ${iconBtnClass} ${pad}`}
        aria-label="年代記"
        onClick={onOpenChronicle}
      >
        <span className="ao-p5-kurultai-ink-icon">
          <IcoBook size={iconSize} />
        </span>
      </button>
    </div>
  );
}
