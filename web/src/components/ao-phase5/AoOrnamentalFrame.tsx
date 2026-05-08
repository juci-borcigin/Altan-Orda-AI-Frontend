"use client";

import type { CSSProperties, ReactNode } from "react";

/** Frame.png（上下）素サイズ（px） */
const FRAME_NATURAL_W = 44;
const FRAME_NATURAL_H = 14;

/** Frame-side.png（左右・右基準）素サイズ（px） */
const SIDE_FRAME_NATURAL_W = 16;
const SIDE_FRAME_NATURAL_H = 15;

/** Corner.png 素サイズ（px）。画像は右上コーナー向け */
const CORNER_NATURAL_W = 44;
const CORNER_NATURAL_H = 42;

type CornerSlot = "tl" | "tr" | "bl" | "br";

function cornerTransform(slot: CornerSlot): string {
  switch (slot) {
    case "tl":
      return "scaleX(-1)";
    case "tr":
      return "none";
    case "bl":
      return "scale(-1, -1)";
    case "br":
      return "scaleY(-1)";
    default:
      return "none";
  }
}

/**
 * 上下: Frame.png を横繰り。
 * 左右: Frame-side.png を縦繰り（右が素画像、左は 180° 反転）。
 * 四隅: Corner.png
 */
export function AoOrnamentalFrame({
  children,
  scale = 1,
  className,
  style,
  contentClassName,
  contentStyle,
  fillClassName = "ao-p5-parchment-surface",
  fillStyle,
}: {
  children: ReactNode;
  scale?: number;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  /**
   * 枠の内側（インセット余白も含む）を塗るレイヤ。
   * - `ao-p5-parchment-surface` を既定とし、地図背景の透けを防ぐ。
   * - 不要なら空文字を渡す（class を付けない）か、`fillStyle` で透明にする。
   */
  fillClassName?: string;
  fillStyle?: CSSProperties;
}) {
  const fw = FRAME_NATURAL_W * scale;
  const fh = FRAME_NATURAL_H * scale;
  const sideW = SIDE_FRAME_NATURAL_W * scale;
  const sideTileH = SIDE_FRAME_NATURAL_H * scale;
  const cw = CORNER_NATURAL_W * scale;
  const ch = CORNER_NATURAL_H * scale;

  const bgTopBottom = `url('/phase5/Frame.png')`;
  const bgSide = `url('/phase5/Frame-side.png')`;

  /** 上下の fh と左右の sideW の両方を踏まえた内側余白 */
  const insetPad = Math.ceil(Math.max(fh + 12 * scale, sideW + 10 * scale, cw * 0.4));

  const edgeBase: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    zIndex: 1,
  };

  const fwPx = `${fw}px`;
  const fhPx = `${fh}px`;
  const sideWPx = `${sideW}px`;
  const sideTileHPx = `${sideTileH}px`;
  const cwPx = `${cw}px`;
  const chPx = `${ch}px`;
  const insetPadPx = `${insetPad}px`;

  const bgRepeatX: CSSProperties = {
    backgroundImage: bgTopBottom,
    backgroundRepeat: "repeat-x",
    backgroundSize: `${fwPx} ${fhPx}`,
  };

  const bgRepeatYRight: CSSProperties = {
    backgroundImage: bgSide,
    backgroundRepeat: "repeat-y",
    backgroundSize: `${sideWPx} ${sideTileHPx}`,
    backgroundPosition: "top center",
  };

  return (
    <div className={`relative box-border ${className ?? ""}`} style={{ ...style }}>
      {/* 枠の内側（パディング領域も含む）を塗る */}
      <div
        aria-hidden
        className={fillClassName || undefined}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          ...fillStyle,
        }}
      />

      {/* 上辺 */}
      <div
        aria-hidden
        style={{
          ...edgeBase,
          left: 0,
          right: 0,
          top: 0,
          height: fhPx,
          ...bgRepeatX,
        }}
      />

      {/* 下辺（180°） */}
      <div
        aria-hidden
        style={{
          ...edgeBase,
          left: 0,
          right: 0,
          bottom: 0,
          height: fhPx,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            ...bgRepeatX,
            transform: "rotate(180deg)",
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* 左辺：右用画像を 180° 反転して縦繰り */}
      <div
        aria-hidden
        style={{
          ...edgeBase,
          left: 0,
          top: 0,
          bottom: 0,
          width: sideWPx,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            ...bgRepeatYRight,
            transform: "rotate(180deg)",
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* 右辺：素画像を縦繰り */}
      <div
        aria-hidden
        style={{
          ...edgeBase,
          right: 0,
          top: 0,
          bottom: 0,
          width: sideWPx,
          ...bgRepeatYRight,
        }}
      />

      {(["tl", "tr", "bl", "br"] as const).map((slot) => {
        const pos: CSSProperties =
          slot === "tl"
            ? { top: 0, left: 0 }
            : slot === "tr"
              ? { top: 0, right: 0 }
              : slot === "bl"
                ? { bottom: 0, left: 0 }
                : { bottom: 0, right: 0 };

        return (
          // eslint-disable-next-line @next/next/no-img-element -- 装飾・確実なレイヤリング
          <img
            key={slot}
            src="/phase5/Corner.png"
            alt=""
            draggable={false}
            className="pointer-events-none select-none"
            style={{
              position: "absolute",
              width: cwPx,
              height: chPx,
              zIndex: 3,
              transform: cornerTransform(slot),
              ...pos,
            }}
          />
        );
      })}

      <div
        className={`relative z-[2] box-border min-h-0 min-w-0 ${contentClassName ?? ""}`}
        style={{
          padding: insetPadPx,
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
