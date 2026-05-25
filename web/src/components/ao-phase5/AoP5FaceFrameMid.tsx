"use client";

import type { CSSProperties } from "react";

/** Face_SM: face_sm_cnr 素 6×6（外周 +12px = 角×2） */
export const AO_P5_FACE_SM_CORNER_PX = 6;
const FACE_CNR = AO_P5_FACE_SM_CORNER_PX;
/** Face_SM: frame_sm_btm 素（実ファイル名）— 上下タイル 6×6 */
const FACE_TB_TILE = 6;
/** Face_SM: frame_sm_rite 素（実ファイル名）— 左右タイル 6×6 */
const FACE_RITE_TILE = 6;

/** メイン・チャット：顔＋枠内側をこの比率で縮小（角・辺タイルの画像 px は不変） */
export const AO_MAIN_CHAT_FACE_PORTRAIT_SCALE = 0.7;

/** 顔枠コンポーネントの外寸（width/height は設計寸・portraitScale で内側を縮小） */
export function aoP5FaceFrameMidOuterSizePx(
  width: number,
  height: number,
  portraitScale = 1,
): { outerW: number; outerH: number } {
  const scale = portraitScale > 0 && portraitScale <= 1 ? portraitScale : 1;
  const frameW = width * scale;
  const frameH = height * scale;
  return { outerW: frameW + FACE_CNR * 2, outerH: frameH + FACE_CNR * 2 };
}

export interface AoP5FaceFrameMidProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /**
   * 1=設計寸のまま。
   * 0.7 等では顔と枠の内側矩形を同率で縮め、角・辺タイルの backgroundSize は維持。
   */
  portraitScale?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Face_SM（画像パーツ）・枠は顔グラ外側のみ・余白0。
 *
 * - 角 face_sm_cnr: 右下=素、右上=scaleY(-1)、左下=scaleX(-1)、左上=scaleX(-1)scaleY(-1)
 * - 上下 frame_sm_btm: 下=素 repeat-x、上=scaleY(-1) repeat-x
 * - 左右 frame_sm_rite: 右=素 repeat-y、左=scaleX(-1) repeat-y
 *
 * （フォルダ上のファイル名は `frame_sm_btm.png` / `frame_sm_rite.png`）
 */
export function AoP5FaceFrameMid({
  src,
  alt,
  width,
  height,
  portraitScale = 1,
  className,
  style,
}: AoP5FaceFrameMidProps) {
  const px = (n: number) => `${n}px`;

  const cnr = FACE_CNR;
  const tbBand = FACE_TB_TILE;
  const sideW = FACE_RITE_TILE;

  const scale = portraitScale > 0 && portraitScale <= 1 ? portraitScale : 1;
  const frameW = width * scale;
  const frameH = height * scale;

  const outerW = frameW + cnr * 2;
  const outerH = frameH + cnr * 2;
  const gapX = Math.max(0, frameW);
  const gapY = Math.max(0, frameH);

  /** 角・枠の継ぎ目のすき間対策 */
  const seam = 1;

  const base: CSSProperties = { position: "absolute", pointerEvents: "none", zIndex: 2 };
  const tbBg = "url('/phase5/frame_sm_btm.png')";
  const tbSize = `${px(FACE_TB_TILE)} ${px(FACE_TB_TILE)}`;
  const riteBg = "url('/phase5/frame_sm_rite.png')";
  const riteSize = `${px(FACE_RITE_TILE)} ${px(FACE_RITE_TILE)}`;

  return (
    <div className={`relative ${className ?? ""}`} style={{ width: px(outerW), height: px(outerH), ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          position: "absolute",
          left: px(cnr),
          top: px(cnr),
          width: px(frameW),
          height: px(frameH),
          objectFit: "cover",
          objectPosition: "top",
          zIndex: 1,
        }}
      />

      {/* 上辺 */}
      {gapX > 0 ? (
        <div
          aria-hidden
          style={{
            ...base,
            left: px(cnr - seam),
            top: px(cnr - tbBand),
            width: px(gapX + seam * 2),
            height: px(tbBand),
            backgroundImage: tbBg,
            backgroundRepeat: "repeat-x",
            backgroundSize: tbSize,
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
            ...base,
            left: px(cnr - seam),
            top: px(cnr + frameH),
            width: px(gapX + seam * 2),
            height: px(tbBand),
            backgroundImage: tbBg,
            backgroundRepeat: "repeat-x",
            backgroundSize: tbSize,
          }}
        />
      ) : null}

      {/* 左辺 */}
      {gapY > 0 ? (
        <div
          aria-hidden
          style={{
            ...base,
            left: px(cnr - sideW),
            top: px(cnr - seam),
            width: px(sideW),
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

      {/* 右辺 */}
      {gapY > 0 ? (
        <div
          aria-hidden
          style={{
            ...base,
            left: px(cnr + frameW),
            top: px(cnr - seam),
            width: px(sideW),
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
      <img
        src="/phase5/face_sm_cnr.png"
        alt=""
        aria-hidden
        style={{ ...base, zIndex: 3, left: px(0), top: px(0), width: px(cnr), height: px(cnr), transform: "scale(-1,-1)", transformOrigin: "center" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phase5/face_sm_cnr.png"
        alt=""
        aria-hidden
        style={{ ...base, zIndex: 3, left: px(cnr + frameW), top: px(0), width: px(cnr), height: px(cnr), transform: "scaleY(-1)", transformOrigin: "center" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phase5/face_sm_cnr.png"
        alt=""
        aria-hidden
        style={{ ...base, zIndex: 3, left: px(0), top: px(cnr + frameH), width: px(cnr), height: px(cnr), transform: "scaleX(-1)", transformOrigin: "center" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/phase5/face_sm_cnr.png" alt="" aria-hidden style={{ ...base, zIndex: 3, left: px(cnr + frameW), top: px(cnr + frameH), width: px(cnr), height: px(cnr) }} />
    </div>
  );
}
