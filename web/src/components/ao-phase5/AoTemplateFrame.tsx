"use client";

import type { CSSProperties, ReactNode } from "react";
import { AoBorderImageFrame } from "./AoBorderImageFrame";
import {
  AO_FRAME_A_SLICE_PX,
  AO_FRAME_ASSET_VER,
  AO_FRAME_PRESETS,
  AO_SURFACE_FILL,
  aoFrameAOverlayInsets,
  type AoFramePresetId,
} from "@/lib/template/ao-frame-tokens";

export function AoTemplateFrame({
  preset,
  children,
  className,
  style,
  contentClassName,
  contentStyle,
  fillColor,
  scale,
  contentPullPx,
  overlayDropShadow,
  overlayDropShadowExtentPx,
}: {
  preset: AoFramePresetId;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  /** プリセット既定を上書き */
  fillColor?: string | null;
  /**
   * 描画幅だけを掛ける（slice は維持）。
   */
  scale?: number;
  /** 中身を装飾内側へ寄せる negative margin（px）。overlay 時は無視 */
  contentPullPx?: number;
  /**
   * overlay 時、金フレーム＋内塗りの輪郭に drop-shadow を付ける。
   * 本文には掛けない。矩形 box-shadow（border-box）は使わない。
   */
  overlayDropShadow?: string;
  /** overlayDropShadow 時、合成レイヤを外周へ伸ばす幅（px）。金・内塗りは伸ばさない。 */
  overlayDropShadowExtentPx?: number;
}) {
  const cfg = AO_FRAME_PRESETS[preset];
  const source = `${cfg.source}?v=${AO_FRAME_ASSET_VER}`;
  const k = scale != null && scale > 0 ? scale : 1;
  const w = (px: number) => Math.max(1, Math.round(px * k));
  const topW = w(cfg.topWidthPx);
  const rightW = w(cfg.rightWidthPx);
  const bottomW = w(cfg.bottomWidthPx);
  const leftW = w(cfg.leftWidthPx);

  if (cfg.overlay) {
    const displayScale = topW / AO_FRAME_A_SLICE_PX;
    const textPad = Math.max(0, Math.round((cfg.textPadPx ?? 0) * k));
    const { beige, content } = aoFrameAOverlayInsets(displayScale, textPad);

    const shadowExtent = overlayDropShadow ? Math.max(0, overlayDropShadowExtentPx ?? 0) : 0;
    const renderGold = (box: CSSProperties = { inset: 0 }) => (
      <AoBorderImageFrame
        source={source}
        sliceTopPx={cfg.sliceTopPx}
        sliceRightPx={cfg.sliceRightPx}
        sliceBottomPx={cfg.sliceBottomPx}
        sliceLeftPx={cfg.sliceLeftPx}
        topWidthPx={topW}
        rightWidthPx={rightW}
        bottomWidthPx={bottomW}
        leftWidthPx={leftW}
        repeat={cfg.repeat}
        fillColor={null}
        sliceFill={false}
        className="pointer-events-none"
        style={{ position: "absolute", ...box }}
        contentStyle={{ padding: 0, height: "100%" }}
      />
    );
    const renderBeige = (insetExtra = 0) => (
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: beige.top + insetExtra,
          right: beige.right + insetExtra,
          bottom: beige.bottom + insetExtra,
          left: beige.left + insetExtra,
          backgroundColor: fillColor !== undefined && fillColor != null ? fillColor : AO_SURFACE_FILL,
          pointerEvents: "none",
        }}
      />
    );

    return (
      <div
        className={className}
        style={{
          position: "relative",
          boxSizing: "border-box",
          overflow: "visible",
          ...style,
        }}
      >
        {overlayDropShadow ? (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              zIndex: 0,
              top: -shadowExtent,
              left: -shadowExtent,
              right: -shadowExtent,
              bottom: -shadowExtent,
              filter: overlayDropShadow,
            }}
          >
            {renderBeige(shadowExtent)}
            {renderGold({
              top: shadowExtent,
              right: shadowExtent,
              bottom: shadowExtent,
              left: shadowExtent,
            })}
          </div>
        ) : (
          renderBeige()
        )}
        <div
          className={contentClassName}
          style={{
            position: "relative",
            zIndex: 1,
            boxSizing: "border-box",
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            width: "100%",
            backgroundColor: "transparent",
            ...contentStyle,
            paddingTop: content.top,
            paddingRight: content.right,
            paddingBottom: content.bottom,
            paddingLeft: content.left,
          }}
        >
          {children}
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 2 }} aria-hidden>
          {renderGold()}
        </div>
      </div>
    );
  }

  const pull = contentPullPx ?? cfg.contentPullPx ?? 0;
  const pullPx = Math.max(0, pull);

  const mergedContentStyle: CSSProperties = {
    padding: 0,
    ...(pullPx > 0
      ? {
          margin: `-${pullPx}px`,
          width: `calc(100% + ${pullPx * 2}px)`,
          height: `calc(100% + ${pullPx * 2}px)`,
        }
      : {}),
    ...contentStyle,
  };

  return (
    <AoBorderImageFrame
      source={source}
      sliceTopPx={cfg.sliceTopPx}
      sliceRightPx={cfg.sliceRightPx}
      sliceBottomPx={cfg.sliceBottomPx}
      sliceLeftPx={cfg.sliceLeftPx}
      topWidthPx={topW}
      rightWidthPx={rightW}
      bottomWidthPx={bottomW}
      leftWidthPx={leftW}
      repeat={cfg.repeat}
      fillColor={fillColor !== undefined ? fillColor : cfg.fillColor}
      sliceFill={cfg.sliceFill !== false}
      className={className}
      style={style}
      contentClassName={contentClassName}
      contentStyle={mergedContentStyle}
    >
      {children}
    </AoBorderImageFrame>
  );
}
