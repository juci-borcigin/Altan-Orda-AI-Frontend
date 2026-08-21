"use client";

import type { CSSProperties, ReactNode } from "react";
import { AO_FRAME_A_SOURCE } from "@/lib/template/ao-frame-tokens";

/**
 * CSS `border-image` 九分割枠。
 *
 * 塗りと枠の前後関係（重要）:
 * - 子要素の塗りレイヤは、親の border-image（枠）より常に手前に描画される。
 * - したがって「枠が上・塗りが下」を実現するには Bubble 成功例と同じく
 *   **画像中央に塗りを焼き込み + border-image-slice: … fill** を使う。
 * - CSS の absolute 塗りはフォールバック用（原則 sliceFill を使う）。
 */
export function AoBorderImageFrame({
  children,
  className,
  style,
  contentClassName,
  contentStyle,
  fillClassName = "",
  /** CSS 一色塗り（フォールバック）。sliceFill 時は null 推奨 */
  fillColor = null,
  /** border-image-slice に fill を付け、画像中央を中身として描画（枠が上） */
  sliceFill = true,
  source = AO_FRAME_A_SOURCE,
  sliceTopPx = 64,
  sliceRightPx = 64,
  sliceBottomPx = 64,
  sliceLeftPx = 64,
  topWidthPx = 18,
  rightWidthPx = 18,
  bottomWidthPx = 18,
  leftWidthPx = 18,
  repeat = "stretch",
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  fillClassName?: string;
  fillColor?: string | null;
  sliceFill?: boolean;
  source?: string;
  sliceTopPx?: number;
  sliceRightPx?: number;
  sliceBottomPx?: number;
  sliceLeftPx?: number;
  topWidthPx?: number;
  rightWidthPx?: number;
  bottomWidthPx?: number;
  leftWidthPx?: number;
  repeat?: "round" | "repeat" | "stretch" | "space";
}) {
  const slice = `${sliceTopPx} ${sliceRightPx} ${sliceBottomPx} ${sliceLeftPx}${
    sliceFill ? " fill" : ""
  }`;

  const frameStyle: CSSProperties = {
    position: "relative",
    boxSizing: "border-box",
    borderStyle: "solid",
    borderTopWidth: topWidthPx,
    borderRightWidth: rightWidthPx,
    borderBottomWidth: bottomWidthPx,
    borderLeftWidth: leftWidthPx,
    borderImageSource: `url('${source}')`,
    borderImageSlice: slice,
    borderImageRepeat: repeat,
    backgroundColor: "transparent",
    backgroundImage: "none",
    ...style,
  };

  return (
    <div className={className} style={frameStyle}>
      {/* フォールバック塗りのみ。sliceFill 時は使わない（枠の下に置けないため） */}
      {fillColor != null && !sliceFill ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: fillColor,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div
        className={`${fillClassName} ${contentClassName ?? ""}`.trim()}
        style={{
          position: "relative",
          zIndex: 1,
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
