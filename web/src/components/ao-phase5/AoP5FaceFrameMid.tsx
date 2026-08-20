"use client";

import type { CSSProperties } from "react";
import { AoTemplateFrame } from "./AoTemplateFrame";
import { AO_FRAME_D_BORDER_PX } from "@/lib/template/ao-frame-tokens";

/** 旧 Face_SM 角 6px（= Frame_D border 幅） */
export const AO_P5_FACE_SM_CORNER_PX = AO_FRAME_D_BORDER_PX;

/** メイン・チャット：顔＋枠内側をこの比率で縮小 */
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
  return {
    outerW: frameW + AO_FRAME_D_BORDER_PX * 2,
    outerH: frameH + AO_FRAME_D_BORDER_PX * 2,
  };
}

export interface AoP5FaceFrameMidProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /**
   * 1=設計寸のまま。
   * 0.7 等では顔と枠の内側矩形を同率で縮める。
   */
  portraitScale?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * 顔グラ枠 = Frame_D（border-image）。
 * 画像の周囲に border 6px をゼロ gap で引く（CSS padding / bleed なし）。
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
  const scale = portraitScale > 0 && portraitScale <= 1 ? portraitScale : 1;
  const innerW = width * scale;
  const innerH = height * scale;
  const { outerW, outerH } = aoP5FaceFrameMidOuterSizePx(width, height, portraitScale);

  return (
    <AoTemplateFrame
      preset="frame_D"
      className={className}
      style={{ width: px(outerW), height: px(outerH), flexShrink: 0, ...style }}
      contentClassName="relative overflow-hidden p-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={innerW}
        height={innerH}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          objectPosition: "top",
          margin: 0,
          padding: 0,
        }}
      />
    </AoTemplateFrame>
  );
}
