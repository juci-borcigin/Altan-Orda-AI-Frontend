"use client";

import type { CSSProperties } from "react";

export type AoP5CornerSlot = "tl" | "tr" | "bl" | "br";

/**
 * マスター画像（`/public/phase5/master.png`）からコーナー装飾を「切り出さずに」表示する。
 * まず見た目合わせを最優先するためのプレビュー用。後で最適化（実スライス/軽量化）可能。
 */
export function AoP5CornerMaster({
  slot,
  size,
  className,
  masterWidthPx = 1024,
  masterHeightPx = 682,
}: {
  slot: AoP5CornerSlot;
  size: number;
  className?: string;
  masterWidthPx?: number;
  masterHeightPx?: number;
}) {
  const pos: CSSProperties["backgroundPosition"] =
    slot === "tl"
      ? "left top"
      : slot === "tr"
        ? "right top"
        : slot === "bl"
          ? "left bottom"
          : "right bottom";

  return (
    <div
      className={className}
      aria-hidden
      style={{
        width: size,
        height: size,
        backgroundImage: "url('/phase5/master.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${masterWidthPx}px ${masterHeightPx}px`,
        backgroundPosition: pos,
      }}
    />
  );
}

