"use client";

import type { CSSProperties } from "react";
import Image from "next/image";

// 濃いめの金（パターンC専用）
const GOLD_C = "#b37b17";
const GOLD_C_LT = "#f0c35a";

export interface AoP5PortraitFrameCProps {
  src: string;
  name: string;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
}

function FrameC({ w, h }: { w: number; h: number }) {
  const gd = Math.max(5, Math.round(w * 0.12)); // corner diamond half-size
  const gd2 = Math.max(4, Math.round(w * 0.07)); // mid diamond half-size

  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as [number, number][];
  const midPts = [
    [w / 2, 0],
    [w / 2, h],
    [0, h / 2],
    [w, h / 2],
  ] as [number, number][];
  const q1 = [
    [w / 4, 0],
    [(w * 3) / 4, 0],
    [w / 4, h],
    [(w * 3) / 4, h],
  ] as [number, number][];
  const q2 = [
    [0, h / 4],
    [0, (h * 3) / 4],
    [w, h / 4],
    [w, (h * 3) / 4],
  ] as [number, number][];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="pointer-events-none absolute inset-0"
    >
      {/* 外枠 */}
      <rect x={1} y={1} width={w - 2} height={h - 2} stroke={GOLD_C} strokeWidth={2} />
      {/* 中間枠 */}
      <rect x={5} y={5} width={w - 10} height={h - 10} stroke={GOLD_C} strokeWidth={0.8} strokeOpacity={0.6} />
      {/* 内枠 */}
      <rect x={11} y={11} width={w - 22} height={h - 22} stroke={GOLD_C} strokeWidth={0.5} strokeOpacity={0.35} />

      {/* コーナー大ダイアモンド */}
      {corners.map(([cx, cy], i) => (
        <g key={i}>
          <polygon
            points={`${cx},${cy - gd} ${cx + gd},${cy} ${cx},${cy + gd} ${cx - gd},${cy}`}
            fill={GOLD_C}
            fillOpacity={0.95}
          />
          <polygon
            points={`${cx},${cy - gd / 2} ${cx + gd / 2},${cy} ${cx},${cy + gd / 2} ${cx - gd / 2},${cy}`}
            fill={GOLD_C_LT}
          />
        </g>
      ))}

      {/* 辺中央ダイアモンド */}
      {midPts.map(([cx, cy], i) => (
        <polygon
          key={i}
          points={`${cx},${cy - gd2} ${cx + gd2},${cy} ${cx},${cy + gd2} ${cx - gd2},${cy}`}
          fill={GOLD_C}
          fillOpacity={0.9}
        />
      ))}

      {/* 4分割位置の小十字 */}
      {[...q1, ...q2].map(([cx, cy], i) => (
        <g key={i}>
          <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={GOLD_C} strokeWidth={1.5} />
          <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke={GOLD_C} strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}

export function AoP5PortraitFrameC({ src, name, width, height, className, style }: AoP5PortraitFrameCProps) {
  return (
    <div className={`inline-flex flex-col items-center ${className ?? ""}`} style={style}>
      <div className="relative" style={{ width, height }}>
        <div className="absolute inset-0 overflow-hidden rounded-none bg-black/10">
          <Image src={src} alt={name} fill sizes={`${width}px`} className="object-cover object-top" />
        </div>
        <FrameC w={width} h={height} />
      </div>
    </div>
  );
}

