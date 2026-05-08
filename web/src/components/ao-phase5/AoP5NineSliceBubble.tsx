"use client";

import type { CSSProperties, ReactNode } from "react";

export type AoP5NineSliceBubbleVariant = "user" | "ai";

type SliceSet = {
  lt: string;
  lm: string;
  lb: string;
  rt: string;
  rm: string;
  rb: string;
  tm: string;
  bm: string;
  // dims
  leftW: number;
  rightW: number;
  topH: number;
  bottomH: number;
  // corner heights used by left/right columns
  leftTopH: number;
  leftBottomH: number;
  rightTopH: number;
  rightBottomH: number;
  // mid tile
  midTileW: number;
  midTileH: number;
  sideTileW: number;
  sideTileH: number;
};

// 画像寸法（sips で確認済み）
const USER_SLICES: SliceSet = {
  lt: "/phase5/bubble_user_left_top.png",
  lm: "/phase5/bubble_user_left_mid.png",
  lb: "/phase5/bubble_user_left_btm.png",
  rt: "/phase5/bubble_user_right_top.png",
  rm: "/phase5/bubble_user_right_mid.png",
  rb: "/phase5/bubble_user_right_btm.png",
  tm: "/phase5/bubble_user_top_mid.png",
  bm: "/phase5/bubble_user_btm_mid.png",
  leftW: 18,
  rightW: 48,
  topH: 10,
  bottomH: 10,
  leftTopH: 51,
  leftBottomH: 23,
  rightTopH: 51,
  rightBottomH: 23,
  midTileW: 25,
  midTileH: 10,
  sideTileW: 18,
  sideTileH: 15,
};

const AI_SLICES: SliceSet = {
  lt: "/phase5/bubble_ai_left_top.png",
  lm: "/phase5/bubble_ai_left_mid.png",
  lb: "/phase5/bubble_ai_left_btm.png",
  rt: "/phase5/bubble_ai_right_top.png",
  rm: "/phase5/bubble_ai_right_mid.png",
  rb: "/phase5/bubble_ai_right_btm.png",
  tm: "/phase5/bubble_ai_top_mid.png",
  bm: "/phase5/bubble_ai_btm_mid.png",
  leftW: 48,
  rightW: 18,
  topH: 10,
  bottomH: 10,
  leftTopH: 51,
  leftBottomH: 23,
  rightTopH: 51,
  rightBottomH: 23,
  midTileW: 25,
  midTileH: 10,
  sideTileW: 18,
  sideTileH: 15,
};

function slicesFor(variant: AoP5NineSliceBubbleVariant): SliceSet {
  return variant === "user" ? USER_SLICES : AI_SLICES;
}

export interface AoP5NineSliceBubbleProps {
  variant: AoP5NineSliceBubbleVariant;
  /** 内側背景色。指定がない場合 user=#fff / ai=#F1E8D8 */
  bgColor?: string;
  /** 枠（スライス幅）スケール。1=現状、0.5=半分など */
  frameScale?: number;
  /** 親の高さに合わせて縦に伸ばす（height:100%）。メイン入力などで使用。 */
  fillHeight?: boolean;
  /** コンテンツ左右余白（追加分） */
  contentPadX?: number;
  /** コンテンツ上下余白（追加分） */
  contentPadY?: number;
  /** 最小高さ（px）。未指定なら自動算出 */
  minHeightPx?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * 9-slice の吹き出し（パーツ画像を繰り返して伸縮）。
 * - `*_mid` は repeat-x / repeat-y
 * - 外側は透過、内側だけ `bgColor` で塗る
 */
export function AoP5NineSliceBubble({
  variant,
  bgColor,
  frameScale = 1,
  fillHeight = false,
  contentPadX,
  contentPadY,
  minHeightPx,
  children,
  className,
  style,
}: AoP5NineSliceBubbleProps) {
  const s = slicesFor(variant);
  const fs = Math.max(0.25, Math.min(1, frameScale));
  const d = {
    leftW: Math.max(1, Math.round(s.leftW * fs)),
    rightW: Math.max(1, Math.round(s.rightW * fs)),
    topH: Math.max(1, Math.round(s.topH * fs)),
    bottomH: Math.max(1, Math.round(s.bottomH * fs)),
    leftTopH: Math.max(1, Math.round(s.leftTopH * fs)),
    leftBottomH: Math.max(1, Math.round(s.leftBottomH * fs)),
    rightTopH: Math.max(1, Math.round(s.rightTopH * fs)),
    rightBottomH: Math.max(1, Math.round(s.rightBottomH * fs)),
    midTileW: Math.max(1, Math.round(s.midTileW * fs)),
    midTileH: Math.max(1, Math.round(s.midTileH * fs)),
    sideTileH: Math.max(1, Math.round(s.sideTileH * fs)),
  };
  const fill = bgColor ?? (variant === "user" ? "#FFFFFF" : "#F1E8D8");

  const innerPadX = contentPadX ?? 14;
  const innerPadY = contentPadY ?? 10;

  // 低い高さだと上/下角や左右midが潰れるので最低高さを保証する
  // 1行メッセージでも「大きい吹き出し相当」の器を確保する意図。
  const minHDefault =
    Math.max(d.leftTopH + d.leftBottomH, d.rightTopH + d.rightBottomH) +
    Math.max(d.topH + d.bottomH, d.sideTileH) +
    70;
  const minH = minHeightPx ?? minHDefault;

  return (
    <div
      className={`relative block ${className ?? ""}`}
      style={{
        ...(fillHeight ? { height: "100%", minHeight: 0 } : { minHeight: `${minH}px` }),
        ...style,
      }}
    >
      {/* 内側塗り（外側は透過） */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: d.leftW,
          right: d.rightW,
          top: d.topH,
          bottom: d.bottomH,
          background: fill,
        }}
      />

      {/* 上中 */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: d.leftW,
          right: d.rightW,
          top: 0,
          height: d.topH,
          backgroundImage: `url('${s.tm}')`,
          backgroundRepeat: "repeat-x",
          backgroundSize: `${d.midTileW}px ${d.midTileH}px`,
        }}
      />

      {/* 下中 */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: d.leftW,
          right: d.rightW,
          bottom: 0,
          height: d.bottomH,
          backgroundImage: `url('${s.bm}')`,
          backgroundRepeat: "repeat-x",
          backgroundSize: `${d.midTileW}px ${d.midTileH}px`,
        }}
      />

      {/* 左中 */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: 0,
          width: d.leftW,
          top: d.leftTopH,
          bottom: d.leftBottomH,
          backgroundImage: `url('${s.lm}')`,
          backgroundRepeat: "repeat-y",
          backgroundSize: `${d.leftW}px ${d.sideTileH}px`,
        }}
      />

      {/* 右中 */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          right: 0,
          width: d.rightW,
          top: d.rightTopH,
          bottom: d.rightBottomH,
          backgroundImage: `url('${s.rm}')`,
          backgroundRepeat: "repeat-y",
          backgroundSize: `${d.rightW}px ${d.sideTileH}px`,
        }}
      />

      {/* 角（img） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.lt} alt="" aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ width: d.leftW, height: d.leftTopH }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.lb} alt="" aria-hidden="true" className="pointer-events-none absolute left-0 bottom-0" style={{ width: d.leftW, height: d.leftBottomH }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.rt} alt="" aria-hidden="true" className="pointer-events-none absolute right-0 top-0" style={{ width: d.rightW, height: d.rightTopH }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.rb} alt="" aria-hidden="true" className="pointer-events-none absolute right-0 bottom-0" style={{ width: d.rightW, height: d.rightBottomH }} />

      {/* コンテンツ */}
      <div
        className="relative z-10 flex min-h-0 h-full flex-col font-serif text-[13px] leading-relaxed text-[#1a0d04]"
        style={{
          paddingLeft: d.leftW + innerPadX,
          paddingRight: d.rightW + innerPadX,
          paddingTop: d.topH + innerPadY,
          paddingBottom: d.bottomH + innerPadY,
        }}
      >
        {children}
      </div>
    </div>
  );
}

