"use client";

import type { CSSProperties, ReactNode } from "react";
import { AoTemplateFrame } from "./AoTemplateFrame";
import {
  AO_FRAME_AL_OVERLAY_DROP_SHADOW,
  AO_FRAME_AL_OVERLAY_SHADOW_EXTENT_PX,
} from "@/lib/template/ao-chrome";

/**
 * メインカラムを包む既定の大枠（Frame_AL）。
 * 影は金＋内塗りの輪郭から外へ。チャットの令旨パネルと同じ。
 */
export function AoMainColumnFrame({
  children,
  className,
  style,
  contentClassName,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
}) {
  return (
    <AoTemplateFrame
      preset="frame_AL"
      className={className}
      style={style}
      contentClassName={contentClassName}
      overlayDropShadow={AO_FRAME_AL_OVERLAY_DROP_SHADOW}
      overlayDropShadowExtentPx={AO_FRAME_AL_OVERLAY_SHADOW_EXTENT_PX}
    >
      {children}
    </AoTemplateFrame>
  );
}
