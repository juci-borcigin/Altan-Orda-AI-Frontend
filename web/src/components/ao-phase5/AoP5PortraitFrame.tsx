"use client";

import type { CSSProperties } from "react";

/**
 * 基準スケール: portrait width = 80px のとき
 *   cnr = 20px, side = 8px, tile = 20px, npEnd = 28px, npH = 14px
 * 顔グラ幅に比例して各パーツを縮小する。
 */
const BASE_W = 80;
const BASE_CNR = 20;
// TB: 20×8（上下枠）
const BASE_TB_H = 8;
const BASE_TB_TILE_W = 20;
// LR: 10×5（左右枠）
const BASE_LR_W = 10;
const BASE_LR_TILE_H = 5;
const BASE_NP_END_W = 28;
const BASE_NP_H = 14;
const BASE_FONT = 11;

export interface AoP5PortraitFrameProps {
  src: string;
  name: string;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
}

function AoP5PortraitFrameLrSide({
  side,
  cnr,
  lrW,
  lrTileH,
  sideGapH,
  base,
}: {
  side: "left" | "right";
  cnr: number;
  lrW: number;
  lrTileH: number;
  sideGapH: number;
  base: CSSProperties;
}) {
  if (sideGapH <= 0) return null;
  return (
    <div
      aria-hidden
      style={{
        ...base,
        top: `${cnr}px`,
        [side]: "0px",
        width: `${lrW}px`,
        height: `${sideGapH}px`,
        backgroundImage: "url('/phase5/photoframe_sm_LR.png')",
        backgroundRepeat: "repeat-y",
        backgroundSize: `${lrW}px ${lrTileH}px`,
        transform: side === "left" ? "scaleX(-1)" : "none",
        transformOrigin: "center center",
      }}
    />
  );
}

/**
 * 顔グラ + 画像ベース額縁 + ネームプレート カード。
 * 枠サイズは portrait width に比例してスケール（基準 80px）。
 */
export function AoP5PortraitFrame({
  src,
  name,
  width,
  height,
  className,
  style,
}: AoP5PortraitFrameProps) {
  const scale = width / BASE_W;

  const cnr      = Math.max(4, Math.round(BASE_CNR    * scale));
  const tbH      = Math.max(2, Math.round(BASE_TB_H * scale));
  const tbTileW  = Math.max(4, Math.round(BASE_TB_TILE_W * scale));
  const lrW      = Math.max(2, Math.round(BASE_LR_W * scale));
  const lrTileH  = Math.max(2, Math.round(BASE_LR_TILE_H * scale));
  const npEndW   = Math.max(8, Math.round(BASE_NP_END_W * scale));
  const npH      = Math.max(5, Math.round(BASE_NP_H   * scale));
  const fontSize = Math.max(7, Math.round(BASE_FONT   * scale));

  const sideGapW = width  - cnr * 2;   // 上下サイドのコーナー間幅
  const sideGapH = height - cnr * 2;   // 左右サイドのコーナー間高さ

  const nameplateW     = Math.max(width, npEndW * 2);
  const nameplateCenterW = nameplateW - npEndW * 2;

  const px = (n: number) => `${n}px`;

  const base: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    zIndex: 1,
  };

  return (
    <div className={`flex flex-col items-center ${className ?? ""}`} style={style}>

      {/* ── 顔グラ + 額縁オーバーレイ ── */}
      <div className="relative" style={{ width: px(width), height: px(height) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          style={{
            display: "block",
            width: px(width),
            height: px(height),
            objectFit: "cover",
            objectPosition: "top",
          }}
        />

        {/* 上辺：上下反転 */}
        {sideGapW > 0 && (
          <div
            aria-hidden
            style={{
              ...base,
              top: px(0),
              left: px(cnr),
              width: px(sideGapW),
              height: px(tbH),
              overflow: "hidden",
            }}
          >
            <div style={{
              width: "100%", height: "100%",
              backgroundImage: "url('/phase5/photoframe_sm_TB.png')",
              backgroundRepeat: "repeat-x",
              backgroundSize: `${px(tbTileW)} ${px(tbH)}`,
              transform: "scaleY(-1)",
            }} />
          </div>
        )}

        {/* 下辺：そのまま */}
        {sideGapW > 0 && (
          <div aria-hidden style={{
            ...base, bottom: px(0), left: px(cnr), width: px(sideGapW), height: px(tbH),
            backgroundImage: "url('/phase5/photoframe_sm_TB.png')",
            backgroundRepeat: "repeat-x",
            backgroundSize: `${px(tbTileW)} ${px(tbH)}`,
          }} />
        )}

        {/* 左右枠（LR） */}
        <AoP5PortraitFrameLrSide side="left" cnr={cnr} lrW={lrW} lrTileH={lrTileH} sideGapH={sideGapH} base={base} />
        <AoP5PortraitFrameLrSide side="right" cnr={cnr} lrW={lrW} lrTileH={lrTileH} sideGapH={sideGapH} base={base} />

        {/* ── コーナー ── */}
        {/* 左上：180° */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/phase5/photoframe_sm_cnr.png" alt="" aria-hidden draggable={false}
          style={{ ...base, zIndex: 2, top: px(0), left: px(0), width: px(cnr), height: px(cnr), transform: "rotate(180deg)" }}
        />
        {/* 右上：ScaleY(-1) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/phase5/photoframe_sm_cnr.png" alt="" aria-hidden draggable={false}
          style={{ ...base, zIndex: 2, top: px(0), right: px(0), width: px(cnr), height: px(cnr), transform: "scaleY(-1)" }}
        />
        {/* 左下：ScaleX(-1) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/phase5/photoframe_sm_cnr.png" alt="" aria-hidden draggable={false}
          style={{ ...base, zIndex: 2, bottom: px(0), left: px(0), width: px(cnr), height: px(cnr), transform: "scaleX(-1)" }}
        />
        {/* 右下：そのまま */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/phase5/photoframe_sm_cnr.png" alt="" aria-hidden draggable={false}
          style={{ ...base, zIndex: 2, bottom: px(0), right: px(0), width: px(cnr), height: px(cnr) }}
        />
      </div>

      {/* ── ネームプレート ── */}
      <div style={{ position: "relative", width: px(nameplateW), height: px(npH), display: "flex", flexShrink: 0 }}>
        {/* 左端キャップ：scaleX(-1) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/phase5/nameplate_sm.png" alt="" aria-hidden
          style={{ width: px(npEndW), height: px(npH), flexShrink: 0, transform: "scaleX(-1)" }}
        />
        {/* 中央タイル */}
        {nameplateCenterW > 0 && (
          <div style={{
            width: px(nameplateCenterW), height: px(npH), flexShrink: 0,
            backgroundImage: "url('/phase5/nameplate_mid.png')",
            backgroundRepeat: "repeat-x",
            backgroundSize: `auto ${px(npH)}`,
          }} />
        )}
        {/* 右端キャップ：そのまま（no transform） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/phase5/nameplate_sm.png" alt="" aria-hidden
          style={{ width: px(npEndW), height: px(npH), flexShrink: 0 }}
        />
        {/* 名前テキスト */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Georgia, 'Noto Serif JP', serif",
          fontSize,
          color: "#3a1f05",
          fontWeight: "bold",
          letterSpacing: "0.06em",
          pointerEvents: "none",
        }}>
          {name}
        </div>
      </div>
    </div>
  );
}
