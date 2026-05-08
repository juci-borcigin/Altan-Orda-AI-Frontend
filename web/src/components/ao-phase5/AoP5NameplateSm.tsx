"use client";

import type { CSSProperties } from "react";

/** nameplate_sm_cnr.png（基準コーナー想定） */
const NP_CNR = 10;
/** nameplate_sm_top.png（上辺タイル） */
const NP_TOP_W = 4;
const NP_TOP_H = 10;
/** nameplate_sm_btm.png（下辺タイル） */
const NP_BTM_W = 4;
const NP_BTM_H = 10;
/** nameplate_sm_side.png（右辺タイル、縦タイル） */
const NP_SIDE_W = 10;
const NP_SIDE_H = 3;

export interface AoP5NameplateSmProps {
  /** プレート全体の最低参照幅（px）。実際はテキスト・最大文字数で広がる */
  width: number;
  text: string;
  className?: string;
  style?: CSSProperties;
  /** 縦方向に見やすくするための係数（>=1、tight 時は無視） */
  heightBoost?: number;
  minFontPx?: number;
  /** 幅算出に使う想定最大文字数（nowrap） */
  maxChars?: number;
  /** 指定時は width 由来の自動計算より優先（AO 本番フォントと一致させる用） */
  fontSizePx?: number;
  /**
   * true: 文字列の実長（最大 maxChars）ぶんの見積もり幅に合わせ、
   * コーナー・辺をそのすぐ外側に寄せる（内側パディング最小）
   */
  tight?: boolean;
}

export function AoP5NameplateSm({
  width,
  text,
  className,
  style,
  heightBoost = 1.15,
  minFontPx = 10,
  maxChars = 7,
  fontSizePx,
  tight = false,
}: AoP5NameplateSmProps) {
  const px = (n: number) => `${Math.round(n)}px`;

  /** アセット縮尺（細かすぎない下限あり）。ポートレート幅に連動 */
  const s = Math.max(0.42, Math.min(1.1, (width / 80) * 0.55));

  const cnr = Math.max(4, Math.round(NP_CNR * s));
  const topTileW = Math.max(2, Math.round(NP_TOP_W * s));
  const topH = Math.max(6, Math.round(NP_TOP_H * s));
  const btmTileW = Math.max(2, Math.round(NP_BTM_W * s));
  const btmH = Math.max(6, Math.round(NP_BTM_H * s));
  const sideW = Math.max(4, Math.round(NP_SIDE_W * s));
  const sideTileH = Math.max(2, Math.round(NP_SIDE_H * s));

  const fontSize =
    fontSizePx ?? Math.max(minFontPx, Math.round((11 * width) / 80));

  /** 1行テキストのおおよその描画幅（Canvas なし・日本語想定） */
  function estimateTextWidthPx(chars: number): number {
    const n = Math.max(1, Math.min(chars, maxChars));
    return Math.ceil(fontSize * n * 1.05 + fontSize * 0.055 * Math.max(0, n - 1));
  }

  const labelLen = Math.max(1, Math.min(text.length, maxChars));

  let plateW: number;
  let plateH: number;
  let textPadL: number;
  let textPadR: number;
  let textPadT: number;
  let textPadB: number;

  if (tight) {
    const innerTextW = estimateTextWidthPx(labelLen);
    const horizFrame = 2 * sideW + 2;
    /** 文字のすぐ外に枠を寄せるため、ポートレート幅より狭くてよい */
    plateW = innerTextW + horizFrame;
    const innerTextH = Math.round(fontSize);
    plateH = topH + btmH + innerTextH + 2;
    textPadL = sideW + 1;
    textPadR = sideW + 1;
    textPadT = topH + 1;
    textPadB = btmH + 1;
  } else {
    const assumedChars = Math.max(1, maxChars);
    const assumedTextW = estimateTextWidthPx(assumedChars);
    const minPlateW = Math.max(cnr * 2 + 8, assumedTextW + cnr * 2);
    plateW = Math.max(width, minPlateW);
    const innerHMin = Math.max(sideTileH * 4, Math.round(fontSize + 8));
    plateH = Math.max(topH + btmH + innerHMin, Math.round((topH + btmH + innerHMin) * heightBoost));
    textPadL = cnr + 2;
    textPadR = cnr + 2;
    textPadT = topH + 1;
    textPadB = btmH + 1;
  }

  const gapX = plateW - cnr * 2;
  const gapY = plateH - topH - btmH;

  const cornerBase: CSSProperties = {
    position: "absolute",
    width: px(cnr),
    height: px(cnr),
    pointerEvents: "none",
    zIndex: 1,
  };

  const edgeBase: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    zIndex: 1,
  };

  return (
    <div
      className={`relative shrink-0 ${className ?? ""}`}
      style={{ width: px(plateW), height: px(plateH), ...style }}
    >
      {/* コーナー: TL scaleX(-1), TR 素, BL scaleX(-1)scaleY(-1), BR scaleY(-1) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phase5/nameplate_sm_cnr.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          ...cornerBase,
          left: px(0),
          top: px(0),
          transform: "scaleX(-1)",
          transformOrigin: "center center",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phase5/nameplate_sm_cnr.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{ ...cornerBase, right: px(0), top: px(0) }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phase5/nameplate_sm_cnr.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          ...cornerBase,
          left: px(0),
          bottom: px(0),
          transform: "scaleX(-1) scaleY(-1)",
          transformOrigin: "center center",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phase5/nameplate_sm_cnr.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          ...cornerBase,
          right: px(0),
          bottom: px(0),
          transform: "scaleY(-1)",
          transformOrigin: "center center",
        }}
      />

      {/* 上辺タイル */}
      {gapX > 0 ? (
        <div
          aria-hidden
          style={{
            ...edgeBase,
            left: px(cnr),
            top: px(0),
            width: px(gapX),
            height: px(topH),
            backgroundImage: "url('/phase5/nameplate_sm_top.png')",
            backgroundRepeat: "repeat-x",
            backgroundSize: `${px(topTileW)} ${px(topH)}`,
          }}
        />
      ) : null}

      {/* 下辺タイル */}
      {gapX > 0 ? (
        <div
          aria-hidden
          style={{
            ...edgeBase,
            left: px(cnr),
            bottom: px(0),
            width: px(gapX),
            height: px(btmH),
            backgroundImage: "url('/phase5/nameplate_sm_btm.png')",
            backgroundRepeat: "repeat-x",
            backgroundSize: `${px(btmTileW)} ${px(btmH)}`,
          }}
        />
      ) : null}

      {/* 左辺：scaleX(-1) のうえで縦タイル */}
      {gapY > 0 ? (
        <div
          aria-hidden
          style={{
            ...edgeBase,
            left: px(0),
            top: px(topH),
            width: px(sideW),
            height: px(gapY),
            backgroundImage: "url('/phase5/nameplate_sm_side.png')",
            backgroundRepeat: "repeat-y",
            backgroundSize: `${px(sideW)} ${px(sideTileH)}`,
            backgroundPosition: "center top",
            transform: "scaleX(-1)",
            transformOrigin: "center center",
          }}
        />
      ) : null}

      {/* 右辺：縦タイル */}
      {gapY > 0 ? (
        <div
          aria-hidden
          style={{
            ...edgeBase,
            right: px(0),
            top: px(topH),
            width: px(sideW),
            height: px(gapY),
            backgroundImage: "url('/phase5/nameplate_sm_side.png')",
            backgroundRepeat: "repeat-y",
            backgroundSize: `${px(sideW)} ${px(sideTileH)}`,
            backgroundPosition: "center top",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, 'Noto Serif JP', serif",
          fontSize: px(fontSize),
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: "#2a1406",
          fontWeight: 800,
          letterSpacing: "0.06em",
          textShadow: "0 1px 0 rgba(255,255,255,0.35)",
          pointerEvents: "none",
          paddingLeft: px(textPadL),
          paddingRight: px(textPadR),
          paddingTop: px(textPadT),
          paddingBottom: px(textPadB),
          zIndex: 2,
        }}
      >
        {text}
      </div>
    </div>
  );
}
