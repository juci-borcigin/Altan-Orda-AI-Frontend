"use client";

import type { CSSProperties, ReactNode } from "react";
import { AoP5Corner } from "./AoP5Corner";

type Props = {
  children: ReactNode;
  /** コーナー SVG の一辺（px）。狭い画面は親側から小さく渡す */
  cornerSizePx?: number;
  /** コーナーがコンテンツにかぶらないよう内側へオフセット（px） */
  insetPx?: number;
  className?: string;
  style?: CSSProperties;
  /** true のときコーナーを描画しない（モバイル等でレイヤーを削る） */
  cornersHidden?: boolean;
};

/**
 * 四隅コーナーを載せるだけの軽量フレーム。
 * 横縦の「連続オーナメント帯」は後続パーツで追加する。
 */
export function AoP5DecorativeFrame({
  children,
  cornerSizePx = 36,
  insetPx = 2,
  className,
  style,
  cornersHidden = false,
}: Props) {
  const inset = `${insetPx}px`;

  return (
    <div className={`relative ${className ?? ""}`} style={style}>
      {/* 中身を先に描画し、コーナーを最後に重ねると不透明な main に埋もれない */}
      <div className="relative z-[1] min-h-0 min-w-0 flex flex-1 flex-col">{children}</div>
      {!cornersHidden ? (
        <>
          <span className="pointer-events-none absolute z-[3]" style={{ top: inset, left: inset }}>
            <AoP5Corner slot="tl" size={cornerSizePx} />
          </span>
          <span className="pointer-events-none absolute z-[3]" style={{ top: inset, right: inset }}>
            <AoP5Corner slot="tr" size={cornerSizePx} />
          </span>
          <span className="pointer-events-none absolute z-[3]" style={{ bottom: inset, left: inset }}>
            <AoP5Corner slot="bl" size={cornerSizePx} />
          </span>
          <span className="pointer-events-none absolute z-[3]" style={{ bottom: inset, right: inset }}>
            <AoP5Corner slot="br" size={cornerSizePx} />
          </span>
        </>
      ) : null}
    </div>
  );
}
