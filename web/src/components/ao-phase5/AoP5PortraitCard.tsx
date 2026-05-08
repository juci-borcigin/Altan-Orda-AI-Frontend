"use client";

import Image from "next/image";

/* ── カラー定数 ─────────────────────────────── */
const GOLD      = "#c9922a";
const GOLD_LT   = "#e8b84a";
const GOLD_DK   = "#8a6415";
const GOLD_TEXT = "#DBB961";

export type PortraitCardVariant = "A" | "B" | "C";

export interface AoP5PortraitCardProps {
  /** ポートレート画像パス */
  src: string;
  /** キャラクター名 */
  name: string;
  /** サブテキスト（役職など） */
  caption?: string;
  /** 額縁デザイン A=シンプル軍事 / B=羊皮紙風 / C=重厚紋章 */
  variant: PortraitCardVariant;
  /** ポートレート表示幅 (px) */
  width?: number;
  /** ポートレート表示高 (px) */
  height?: number;
}

/* ══════════════════════════════════════════════
   パターンA：シンプル軍事 — L字コーナー金属ブラケット
   ══════════════════════════════════════════════ */
function FrameA({ w, h }: { w: number; h: number }) {
  const cs = 20;   // bracket reach
  const g  = 5;    // corner diamond half-size
  const mid = 6;   // mid-edge diamond half-size

  const corners = [
    [0, 0], [w, 0], [0, h], [w, h],
  ] as [number, number][];

  const midPts = [
    [w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2],
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
      <rect x={1.5} y={1.5} width={w - 3} height={h - 3} stroke={GOLD} strokeWidth={2} />
      {/* 内枠アクセント */}
      <rect x={8} y={8} width={w - 16} height={h - 16} stroke={GOLD} strokeWidth={0.7} strokeOpacity={0.6} />
      {/* L字ブラケット（コーナー） */}
      {corners.map(([cx, cy], i) => {
        const sx = cx === 0 ? cs : -cs;
        const sy = cy === 0 ? cs : -cs;
        return (
          <path
            key={i}
            d={`M ${cx + sx},${cy} L ${cx},${cy} L ${cx},${cy + sy}`}
            stroke={GOLD_LT}
            strokeWidth={3}
            strokeLinecap="square"
          />
        );
      })}
      {/* コーナー小ダイアモンド */}
      {corners.map(([cx, cy], i) => (
        <polygon
          key={i}
          points={`${cx},${cy - g} ${cx + g},${cy} ${cx},${cy + g} ${cx - g},${cy}`}
          fill={GOLD_LT}
        />
      ))}
      {/* 辺中央ダイアモンド */}
      {midPts.map(([cx, cy], i) => (
        <polygon
          key={i}
          points={`${cx},${cy - mid} ${cx + mid},${cy} ${cx},${cy + mid} ${cx - mid},${cy}`}
          fill={GOLD}
          fillOpacity={0.75}
        />
      ))}
    </svg>
  );
}

function PlateA({ name, caption, w }: { name: string; caption?: string; w: number }) {
  const ph = caption ? 38 : 28;
  return (
    <svg viewBox={`0 0 ${w} ${ph}`} width={w} height={ph} xmlns="http://www.w3.org/2000/svg">
      {/* 背景（暗い羊皮紙 */}
      <rect x={0} y={0} width={w} height={ph} fill="#1a0d04" />
      {/* 上部金線 */}
      <line x1={0} y1={0} x2={w} y2={0} stroke={GOLD} strokeWidth={1.5} />
      {/* 下部金線 */}
      <line x1={0} y1={ph} x2={w} y2={ph} stroke={GOLD} strokeWidth={1.5} />
      {/* サイドノッチ */}
      <polygon points={`0,${ph / 2 - 5} 6,${ph / 2} 0,${ph / 2 + 5}`} fill={GOLD_LT} />
      <polygon points={`${w},${ph / 2 - 5} ${w - 6},${ph / 2} ${w},${ph / 2 + 5}`} fill={GOLD_LT} />
      {/* 名前 */}
      <text
        x={w / 2}
        y={caption ? 17 : ph / 2 + 5}
        textAnchor="middle"
        fontFamily="serif"
        fontSize={caption ? 13 : 14}
        fontWeight="bold"
        fill={GOLD_TEXT}
        letterSpacing="0.08em"
      >
        {name}
      </text>
      {caption && (
        <text
          x={w / 2}
          y={31}
          textAnchor="middle"
          fontFamily="serif"
          fontSize={10}
          fill={GOLD}
          fillOpacity={0.75}
        >
          {caption}
        </text>
      )}
    </svg>
  );
}

/* ══════════════════════════════════════════════
   パターンB：羊皮紙風 — 八角形コーナー・細い優雅枠
   ══════════════════════════════════════════════ */
function FrameB({ w, h }: { w: number; h: number }) {
  const cs = 12; // octagonal corner cut

  const outer = `M ${cs},0 L ${w - cs},0 L ${w},${cs} L ${w},${h - cs} L ${w - cs},${h} L ${cs},${h} L 0,${h - cs} L 0,${cs} Z`;
  const inner = `M ${cs + 6},5 L ${w - cs - 6},5 L ${w - 5},${cs + 6} L ${w - 5},${h - cs - 6} L ${w - cs - 6},${h - 5} L ${cs + 6},${h - 5} L 5,${h - cs - 6} L 5,${cs + 6} Z`;

  const circPts = [
    [cs, cs], [w - cs, cs], [cs, h - cs], [w - cs, h - cs],
  ] as [number, number][];

  const midMarks = [
    [w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2],
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
      {/* 外枠（八角形） */}
      <path d={outer} stroke={GOLD} strokeWidth={1.8} />
      {/* 内枠 */}
      <path d={inner} stroke={GOLD} strokeWidth={0.7} strokeOpacity={0.65} />
      {/* コーナー円 */}
      {circPts.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={5} stroke={GOLD} strokeWidth={1.2} fill={GOLD} fillOpacity={0.18} />
          <circle cx={cx} cy={cy} r={2} fill={GOLD_LT} />
        </g>
      ))}
      {/* 辺中央アクセント線 */}
      {midMarks.map(([cx, cy], i) => {
        const isH = i < 2;
        return (
          <line
            key={i}
            x1={isH ? cx - 10 : cx}
            y1={isH ? cy : cy - 10}
            x2={isH ? cx + 10 : cx}
            y2={isH ? cy : cy + 10}
            stroke={GOLD_LT}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function PlateB({ name, caption, w }: { name: string; caption?: string; w: number }) {
  const pw = w + 14;
  const ph = caption ? 38 : 28;
  const ox = 7;
  const cs = 5;

  const shape = `M ${ox + cs},0 L ${pw - cs},0 L ${pw},${cs} L ${pw},${ph - cs} L ${pw - cs},${ph} L ${ox + cs},${ph} L ${ox},${ph - cs} L ${ox},${cs} Z`;

  return (
    <div style={{ marginLeft: -7, marginRight: -7, position: "relative" }}>
      <svg viewBox={`0 0 ${pw} ${ph}`} width={pw} height={ph} xmlns="http://www.w3.org/2000/svg">
        {/* 羊皮紙背景 */}
        <path d={shape} fill="#f0e6cc" />
        <path d={shape} stroke={GOLD} strokeWidth={1.5} fill="none" />
        {/* 細内線 */}
        <path
          d={`M ${ox + cs + 3},3 L ${pw - cs - 3},3 L ${pw - 3},${cs + 3} L ${pw - 3},${ph - cs - 3} L ${pw - cs - 3},${ph - 3} L ${ox + cs + 3},${ph - 3} L ${ox + 3},${ph - cs - 3} L ${ox + 3},${cs + 3} Z`}
          stroke={GOLD}
          strokeWidth={0.6}
          strokeOpacity={0.55}
          fill="none"
        />
        <text
          x={pw / 2}
          y={caption ? 17 : ph / 2 + 5}
          textAnchor="middle"
          fontFamily="serif"
          fontSize={caption ? 13 : 14}
          fontWeight="bold"
          fill="#2a1406"
          letterSpacing="0.08em"
        >
          {name}
        </text>
        {caption && (
          <text
            x={pw / 2}
            y={31}
            textAnchor="middle"
            fontFamily="serif"
            fontSize={10}
            fill={GOLD_DK}
          >
            {caption}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════
   パターンC：重厚紋章 — 二重枠・大ダイアモンドコーナー
   ══════════════════════════════════════════════ */
function FrameC({ w, h }: { w: number; h: number }) {
  const gd  = 10; // corner diamond half-size
  const gd2 = 6;  // mid diamond half-size

  const corners  = [[0, 0], [w, 0], [0, h], [w, h]] as [number, number][];
  const midPts   = [[w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2]] as [number, number][];
  const q1 = [[w / 4, 0], [w * 3 / 4, 0], [w / 4, h], [w * 3 / 4, h]] as [number, number][];
  const q2 = [[0, h / 4], [0, h * 3 / 4], [w, h / 4], [w, h * 3 / 4]] as [number, number][];

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
      <rect x={1} y={1} width={w - 2} height={h - 2} stroke={GOLD} strokeWidth={2} />
      {/* 中間枠 */}
      <rect x={5} y={5} width={w - 10} height={h - 10} stroke={GOLD} strokeWidth={0.8} strokeOpacity={0.55} />
      {/* 内枠 */}
      <rect x={11} y={11} width={w - 22} height={h - 22} stroke={GOLD} strokeWidth={0.5} strokeOpacity={0.35} />
      {/* コーナー大ダイアモンド */}
      {corners.map(([cx, cy], i) => (
        <g key={i}>
          <polygon
            points={`${cx},${cy - gd} ${cx + gd},${cy} ${cx},${cy + gd} ${cx - gd},${cy}`}
            fill={GOLD}
            fillOpacity={0.9}
          />
          <polygon
            points={`${cx},${cy - gd / 2} ${cx + gd / 2},${cy} ${cx},${cy + gd / 2} ${cx - gd / 2},${cy}`}
            fill={GOLD_LT}
          />
        </g>
      ))}
      {/* 辺中央ダイアモンド */}
      {midPts.map(([cx, cy], i) => (
        <polygon
          key={i}
          points={`${cx},${cy - gd2} ${cx + gd2},${cy} ${cx},${cy + gd2} ${cx - gd2},${cy}`}
          fill={GOLD}
          fillOpacity={0.85}
        />
      ))}
      {/* 4分割位置の小十字 */}
      {[...q1, ...q2].map(([cx, cy], i) => (
        <g key={i}>
          <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={GOLD} strokeWidth={1.5} />
          <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke={GOLD} strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}

function PlateC({ name, caption, w }: { name: string; caption?: string; w: number }) {
  const ph = caption ? 40 : 30;
  const cs = 6;

  const shape = `M ${cs},0 L ${w - cs},0 L ${w},${cs} L ${w},${ph - cs} L ${w - cs},${ph} L ${cs},${ph} L 0,${ph - cs} L 0,${cs} Z`;
  const innerShape = `M ${cs + 4},3 L ${w - cs - 4},3 L ${w - 3},${cs + 4} L ${w - 3},${ph - cs - 4} L ${w - cs - 4},${ph - 3} L ${cs + 4},${ph - 3} L 3,${ph - cs - 4} L 3,${cs + 4} Z`;

  const pts = [
    [0, 0], [w, 0], [0, ph], [w, ph],
  ] as [number, number][];

  return (
    <svg viewBox={`0 0 ${w} ${ph}`} width={w} height={ph} xmlns="http://www.w3.org/2000/svg">
      {/* 暗い背景 */}
      <path d={shape} fill="#0d0703" />
      {/* 外枠金 */}
      <path d={shape} stroke={GOLD} strokeWidth={1.6} fill="none" />
      {/* 内枠金 */}
      <path d={innerShape} stroke={GOLD} strokeWidth={0.6} strokeOpacity={0.55} fill="none" />
      {/* コーナーダイアモンド */}
      {pts.map(([cx, cy], i) => (
        <polygon
          key={i}
          points={`${cx},${cy - 5} ${cx + 5},${cy} ${cx},${cy + 5} ${cx - 5},${cy}`}
          fill={GOLD_LT}
        />
      ))}
      {/* テキスト */}
      <text
        x={w / 2}
        y={caption ? 18 : ph / 2 + 5}
        textAnchor="middle"
        fontFamily="serif"
        fontSize={caption ? 13 : 14}
        fontWeight="bold"
        fill={GOLD_TEXT}
        letterSpacing="0.12em"
      >
        {name}
      </text>
      {caption && (
        <text
          x={w / 2}
          y={33}
          textAnchor="middle"
          fontFamily="serif"
          fontSize={10}
          fill={GOLD}
          fillOpacity={0.7}
        >
          {caption}
        </text>
      )}
    </svg>
  );
}

/* ══════════════════════════════════════════════
   メインコンポーネント
   ══════════════════════════════════════════════ */
const FRAME_MAP = { A: FrameA, B: FrameB, C: FrameC };
const PLATE_MAP = { A: PlateA, B: PlateB, C: PlateC };

const LABEL: Record<PortraitCardVariant, string> = {
  A: "A: シンプル軍事",
  B: "B: 羊皮紙風",
  C: "C: 重厚紋章",
};

export function AoP5PortraitCard({
  src,
  name,
  caption,
  variant,
  width = 80,
  height = 100,
}: AoP5PortraitCardProps) {
  const FrameSvg = FRAME_MAP[variant];
  const Plate    = PLATE_MAP[variant];

  return (
    <div className="inline-flex flex-col items-center" style={{ gap: 0 }}>
      {/* 額縁付きポートレート */}
      <div className="relative" style={{ width, height }}>
        <div className="absolute inset-0 overflow-hidden rounded-none bg-black/10">
          <Image
            src={src}
            alt={name}
            fill
            sizes={`${width}px`}
            className="object-cover object-top"
          />
        </div>
        <FrameSvg w={width} h={height} />
      </div>
      {/* 名前プレート */}
      <Plate name={name} caption={caption} w={width} />
    </div>
  );
}
