"use client";

import type { CSSProperties } from "react";

/** Name_SM 自然サイズ */
const NAME_CNR_NAT = 16;
const NAME_BTM_W_NAT = 8;
const NAME_BTM_H_NAT = 5;
const NAME_RITE_W_NAT = 6;
const NAME_RITE_H_NAT = 8;

/** tight 名札の左右内側余白（`AoP5NameplateSmFrame` と算出関数で共通） */
const TIGHT_NAMEPLATE_PAD_X_PX = 6;

/** PC 僚友：tight の左右パディングを既定の 50%（ドロワー等は既定のまま） */
export const AO_PC_NOKOR_TIGHT_PAD_X_PX = Math.round(TIGHT_NAMEPLATE_PAD_X_PX / 2);

/**
 * tight／非 flush の名札外寸幅（px）。僚友列などで「7文字相当の名札幅」をレイアウトに合わせるとき用。
 * `AoP5NameplateSmFrame` と同じ式であること（定数変更時はここも同期）。
 */
export function aoP5NameplateSmTightPlateOuterWidthPx(opts: {
  bandWidthPx: number;
  nameplateFontSizePx?: number;
  /** 幅の基準とする文字数（僚友は 7） */
  layoutCharCount?: number;
  /** tight 左右パディング（px）。未指定時は `TIGHT_NAMEPLATE_PAD_X_PX` */
  tightPadXPx?: number;
}): number {
  const width = opts.bandWidthPx;
  const charN = Math.max(1, opts.layoutCharCount ?? 7);
  const scale = (width / 60) * 0.5;
  const geomScale = scale * 0.55;
  const riteW = Math.max(3, Math.round(NAME_RITE_W_NAT * geomScale));
  const fontSizePx = opts.nameplateFontSizePx;
  const fontSize = Math.max(7, (fontSizePx ?? Math.max(10, Math.round((11 * width) / 80))) - 3);
  const estTextW = Math.ceil(fontSize * charN * 1.05 + fontSize * 0.055 * Math.max(0, charN - 1));
  const tightPad = opts.tightPadXPx ?? TIGHT_NAMEPLATE_PAD_X_PX;
  const neededW = estTextW + riteW * 2 + 2 + 2 * (tightPad - 1);
  return Math.max(width, neededW);
}

export interface AoP5NameplateSmFrameProps {
  text: string;
  width: number;
  maxChars?: number;
  fontSizePx?: number;
  variant?: "default" | "tight" | "flush";
  /** true の場合、指定 width を最小幅にせず文字幅にフィットさせる */
  fitToText?: boolean;
  /** tight（非 flush）時のテキスト左右パディング（px）。未指定時は既定 6 */
  tightPadXPx?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Name_SM（画像パーツ）
 *
 * - 角 name_sm_cnr: 右下=素、右上=scaleY(-1)、左下=scaleX(-1)、左上=scaleX(-1)scaleY(-1)
 * - 上下 name_sm_btm: 下=素 repeat-x、上=scaleY(-1) repeat-x
 * - 左右 name_sm_rite: 右=素 repeat-y、左=scaleX(-1) repeat-y
 *
 * 内側はベージュ一色で全面敷き（枠と文字の間の白抜けを防ぐ）
 */
export function AoP5NameplateSmFrame({
  text,
  width,
  maxChars = 7,
  fontSizePx,
  variant = "default",
  fitToText = false,
  tightPadXPx,
  className,
  style,
}: AoP5NameplateSmFrameProps) {
  const px = (n: number) => `${Math.round(n)}px`;

  const scale = (width / 60) * 0.5;
  const tight = variant === "tight" || variant === "flush";
  const flush = variant === "flush";
  const tightHorizPad = tight && !flush ? (tightPadXPx ?? TIGHT_NAMEPLATE_PAD_X_PX) : TIGHT_NAMEPLATE_PAD_X_PX;
  const geomScale = tight ? scale * 0.55 : scale;
  const cnr = Math.max(6, Math.round(NAME_CNR_NAT * geomScale));
  const tbH = Math.max(3, Math.round(NAME_BTM_H_NAT * geomScale));
  const tbTileW = Math.max(4, Math.round(NAME_BTM_W_NAT * geomScale));
  const riteW = Math.max(3, Math.round(NAME_RITE_W_NAT * geomScale));
  const riteTileH = Math.max(4, Math.round(NAME_RITE_H_NAT * geomScale));

  /** -2段階（−2px、下限 8） */
  const fontSize = Math.max(7, (fontSizePx ?? Math.max(10, Math.round((11 * width) / 80))) - (tight ? 3 : 2));

  const charN = Math.max(1, Math.min(maxChars, text.length || 1));
  const estTextW = Math.ceil(fontSize * charN * 1.05 + fontSize * 0.055 * Math.max(0, charN - 1));

  const neededW =
    estTextW + riteW * 2 + 2 + (tight && !flush ? 2 * (tightHorizPad - 1) : 0);
  const plateW = fitToText ? Math.max(neededW, cnr * 2 + 2) : Math.max(width, neededW);
  /** tight は tbH と同じく geomScale 基準。scale のままだと inner が過大になり repeat-y の側面タイルが目立つ */
  const innerHDepthScale = tight ? geomScale : scale;
  const innerH = Math.max(fontSize + 2, Math.round(NAME_BTM_H_NAT * innerHDepthScale * 3));
  const plateH = tbH * 2 + innerH;

  const gapX = Math.max(0, plateW - cnr * 2);
  const gapY = Math.max(0, plateH - tbH * 2);

  const seam = 1;

  const edgeBase: CSSProperties = { position: "absolute", pointerEvents: "none", zIndex: 2 };
  const btmBg = "url('/phase5/name_sm_btm.png')";
  const btmSize = `${px(tbTileW)} ${px(tbH)}`;
  const riteBg = "url('/phase5/name_sm_rite.png')";
  const riteSize = `${px(riteW)} ${px(riteTileH)}`;

  const padX = flush ? 0 : tight ? tightHorizPad : riteW + 1;
  const padY = flush ? 0 : tight ? 1 : tbH + 1;

  return (
    <div
      className={`relative shrink-0 ${className ?? ""}`}
      style={{
        width: px(plateW),
        height: px(plateH),
        maxHeight: px(plateH),
        flexShrink: 0,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* 全体ベージュ（枠の内側まで一色に見せる） */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#F1E8D8",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* 上辺（btm + ScaleY(-1)） */}
      {gapX > 0 ? (
        <div
          aria-hidden
          style={{
            ...edgeBase,
            left: px(cnr - seam),
            top: px(0),
            width: px(gapX + seam * 2),
            height: px(tbH),
            backgroundImage: btmBg,
            backgroundRepeat: "repeat-x",
            backgroundSize: btmSize,
            transform: "scaleY(-1)",
            transformOrigin: "center",
          }}
        />
      ) : null}

      {/* 下辺 */}
      {gapX > 0 ? (
        <div
          aria-hidden
          style={{
            ...edgeBase,
            left: px(cnr - seam),
            bottom: px(0),
            width: px(gapX + seam * 2),
            height: px(tbH),
            backgroundImage: btmBg,
            backgroundRepeat: "repeat-x",
            backgroundSize: btmSize,
          }}
        />
      ) : null}

      {/* 左（rite + ScaleX(-1)） */}
      {gapY > 0 ? (
        <div
          aria-hidden
          style={{
            ...edgeBase,
            left: px(-seam),
            top: px(tbH - seam),
            width: px(riteW + seam),
            height: px(gapY + seam * 2),
            backgroundImage: riteBg,
            backgroundRepeat: "repeat-y",
            backgroundSize: riteSize,
            backgroundPosition: "center top",
            transform: "scaleX(-1)",
            transformOrigin: "center",
          }}
        />
      ) : null}

      {/* 右 */}
      {gapY > 0 ? (
        <div
          aria-hidden
          style={{
            ...edgeBase,
            right: px(-seam),
            top: px(tbH - seam),
            width: px(riteW + seam),
            height: px(gapY + seam * 2),
            backgroundImage: riteBg,
            backgroundRepeat: "repeat-y",
            backgroundSize: riteSize,
            backgroundPosition: "center top",
          }}
        />
      ) : null}

      {/* コーナー */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/phase5/name_sm_cnr.png" alt="" aria-hidden style={{ ...edgeBase, zIndex: 3, left: px(0), top: px(0), width: px(cnr), height: px(cnr), transform: "scale(-1,-1)", transformOrigin: "center" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/phase5/name_sm_cnr.png" alt="" aria-hidden style={{ ...edgeBase, zIndex: 3, right: px(0), top: px(0), width: px(cnr), height: px(cnr), transform: "scaleY(-1)", transformOrigin: "center" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/phase5/name_sm_cnr.png" alt="" aria-hidden style={{ ...edgeBase, zIndex: 3, left: px(0), bottom: px(0), width: px(cnr), height: px(cnr), transform: "scaleX(-1)", transformOrigin: "center" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/phase5/name_sm_cnr.png" alt="" aria-hidden style={{ ...edgeBase, zIndex: 3, right: px(0), bottom: px(0), width: px(cnr), height: px(cnr) }} />

      {/* テキスト */}
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
          paddingLeft: px(padX),
          paddingRight: px(padX),
          paddingTop: px(padY),
          paddingBottom: px(padY),
          pointerEvents: "none",
          zIndex: 4,
        }}
      >
        {text}
      </div>
    </div>
  );
}
