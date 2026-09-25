"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* ── デザイン定数 ─────────────────────────────────── */
const C_OUT  = "#b8781a";   // 外枠ゴールド
const C_IN   = "#8a5c10";   // 内枠（やや暗め）
const C_DECO = "#b8781a";   // コーナー飾り
const SW_O   = 1.6;
const SW_I   = 0.9;

const CC  = 9;   // 外枠コーナーカット
const ICC = 6;   // 内枠コーナーカット
const IN  = 5;   // 外枠→内枠インセット
const PAD = 8;   // 内枠→コンテンツ余白

/** ポインタ（突き出し）デフォルト */
const PD   = 15;  // 突き出し深さ（横方向）
const PH   = 24;  // 縦幅
const PY   = 28;  // 先端の Y 位置（本体上端から）

export type PointerSide = "left" | "right";

/* ── ウェービーセグメント ──────────────────────────
   直線 (x1,y1)→(x2,y2) を正弦波でゆらした折れ線に変換。
   端点は変えない。s = 位相オフセット（辺ごとに変える）。 */
function ws(
  x1: number, y1: number,
  x2: number, y2: number,
  s: number, n = 5, amp = 1.8,
): string {
  const dx = x2 - x1, dy = y2 - y1;
  const L  = Math.sqrt(dx * dx + dy * dy);
  if (L < 2) return ` L ${x2.toFixed(2)},${y2.toFixed(2)}`;
  const nx = -dy / L, ny = dx / L;
  let r = "";
  for (let i = 1; i <= n; i++) {
    const t    = i / n;
    const fade = 1 - Math.abs(t - 0.5) * 0.5; // 端点近くは振幅を落とす
    const a    = i < n ? Math.sin(i * 2.5 + s) * amp * fade : 0;
    r += ` L ${(x1 + dx * t + nx * a).toFixed(2)},${(y1 + dy * t + ny * a).toFixed(2)}`;
  }
  return r;
}

/* ── 外枠パス ─────────────────────────────────────── */

function leftOuterPath(W: number, H: number, pY: number): string {
  const ph2 = PH / 2;
  return [
    `M ${PD + CC},0`,
    ws(PD + CC, 0, W - CC, 0, 1.0),        // 上辺
    `L ${W},${CC}`,
    ws(W, CC, W, H - CC, 2.0),             // 右辺
    `L ${W - CC},${H}`,
    ws(W - CC, H, PD + CC, H, 3.0),        // 下辺
    `L ${PD},${H - CC}`,
    ws(PD, H - CC, PD, pY + ph2, 4.0, 3), // 左辺・下部
    `L 0,${pY}`,                            // ← ポインタ先端
    `L ${PD},${pY - ph2}`,                 // ポインタ戻り
    ws(PD, pY - ph2, PD, CC, 4.5, 3),     // 左辺・上部
    `L ${PD + CC},0`,                       // 左上コーナーカット
    "Z",
  ].join("");
}

function rightOuterPath(W: number, H: number, pY: number): string {
  const ex  = W - PD;
  const ph2 = PH / 2;
  return [
    `M 0,${CC}`,
    `L ${CC},0`,
    ws(CC, 0, ex - CC, 0, 1.0),             // 上辺
    `L ${ex},${CC}`,
    ws(ex, CC, ex, pY - ph2, 2.0, 3),      // 右辺・上部
    `L ${W},${pY}`,                          // → ポインタ先端
    `L ${ex},${pY + ph2}`,                  // ポインタ戻り
    ws(ex, pY + ph2, ex, H - CC, 2.5, 3), // 右辺・下部
    `L ${ex - CC},${H}`,
    ws(ex - CC, H, CC, H, 3.0),            // 下辺
    `L 0,${H - CC}`,
    ws(0, H - CC, 0, CC, 4.0),             // 左辺
    "Z",
  ].join("");
}

/* ── 内枠パス（ポインタなし、本体のみ） ──────────── */

function leftInnerPath(W: number, H: number): string {
  const n = IN, ic = ICC, bx = PD + n;
  return [
    `M ${bx},${ic + n}`,
    `L ${bx + ic},${n}`,
    ws(bx + ic, n, W - ic - n, n, 1.1, 4, 1.0),
    `L ${W - n},${ic + n}`,
    ws(W - n, ic + n, W - n, H - ic - n, 2.1, 4, 1.0),
    `L ${W - ic - n},${H - n}`,
    ws(W - ic - n, H - n, bx + ic, H - n, 3.1, 4, 1.0),
    `L ${bx},${H - ic - n}`,
    ws(bx, H - ic - n, bx, ic + n, 4.1, 3, 1.0),
    "Z",
  ].join("");
}

function rightInnerPath(W: number, H: number): string {
  const n = IN, ic = ICC, ex = W - PD - n;
  return [
    `M ${n},${ic + n}`,
    `L ${n + ic},${n}`,
    ws(n + ic, n, ex - ic, n, 1.1, 4, 1.0),
    `L ${ex},${ic + n}`,
    ws(ex, ic + n, ex, H - ic - n, 2.1, 4, 1.0),
    `L ${ex - ic},${H - n}`,
    ws(ex - ic, H - n, n + ic, H - n, 3.1, 4, 1.0),
    `L ${n},${H - ic - n}`,
    ws(n, H - ic - n, n, ic + n, 4.1, 3, 1.0),
    "Z",
  ].join("");
}

/* ── 背景クリップパス（CSS polygon） ─────────────── */

function bgClipPath(W: number, H: number, side: PointerSide): string {
  if (side === "left") {
    const bx = PD;
    return [
      `polygon(`,
      `${bx}px ${CC}px,`,
      `${bx + CC}px 0,`,
      `${W - CC}px 0,`,
      `${W}px ${CC}px,`,
      `${W}px ${H - CC}px,`,
      `${W - CC}px ${H}px,`,
      `${bx + CC}px ${H}px,`,
      `${bx}px ${H - CC}px)`,
    ].join(" ");
  } else {
    const ex = W - PD;
    return [
      `polygon(`,
      `0 ${CC}px,`,
      `${CC}px 0,`,
      `${ex - CC}px 0,`,
      `${ex}px ${CC}px,`,
      `${ex}px ${H - CC}px,`,
      `${ex - CC}px ${H}px,`,
      `${CC}px ${H}px,`,
      `0 ${H - CC}px)`,
    ].join(" ");
  }
}

/* ── コンポーネント ───────────────────────────────── */

export interface AoP5BubbleProps {
  children:   ReactNode;
  /**
   * ポインタの向き。
   * "left"  = AI 側（左向き）
   * "right" = ユーザー側（右向き）
   */
  side?:      PointerSide;
  /**
   * バブル内側の背景色。
   * 省略時は透過（呼び出し元が className で設定できる）。
   */
  bgColor?:   string;
  /** ポインタ先端の Y 位置（デフォルト 28）*/
  pointerY?:  number;
  className?: string;
  style?:     CSSProperties;
}

/**
 * 羊皮紙調の吹き出し。
 * - ポインタは左右（AI=左向き、ユーザー=右向き）
 * - 外枠は小刻みなウェービーで "古びた" 風合い
 * - SVG 自体は fill なし（透過）。bgColor prop で内側の色を指定
 */
export function AoP5Bubble({
  children,
  side     = "left",
  bgColor,
  pointerY = PY,
  className,
  style,
}: AoP5BubbleProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const m = () => setSz({ w: el.offsetWidth, h: el.offsetHeight });
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // パディング：ポインタ側はその分内側に
  const padL = side === "left"  ? PD + IN + PAD : IN + PAD;
  const padR = side === "right" ? PD + IN + PAD : IN + PAD;

  // 内枠コーナーのダイアモンド装飾座標
  const decoPoints = sz
    ? (() => {
        const n  = IN + 1;
        const s  = 3.2;
        const bx = side === "left"  ? PD + n : n;
        const ex = side === "right" ? sz.w - PD - n : sz.w - n;
        return [
          [bx + ICC + 1, n],
          [ex - ICC - 1, n],
          [bx + ICC + 1, sz.h - n],
          [ex - ICC - 1, sz.h - n],
        ].map(([cx, cy]) =>
          `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`
        );
      })()
    : [];

  return (
    <div
      ref={wrapRef}
      className={`relative ${className ?? ""}`}
      style={style}
    >
      {/* 背景色をバブル形状にクリップ */}
      {sz && bgColor && (
        <div
          className="absolute inset-0 z-0"
          style={{
            background: bgColor,
            clipPath: bgClipPath(sz.w, sz.h, side),
          }}
        />
      )}

      {/* SVG 枠（外枠・内枠・コーナー装飾、全て fill なし） */}
      {sz && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0"
          width={sz.w}
          height={sz.h}
          viewBox={`0 0 ${sz.w} ${sz.h}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 外枠（ウェービー） */}
          <path
            d={
              side === "left"
                ? leftOuterPath(sz.w, sz.h, pointerY)
                : rightOuterPath(sz.w, sz.h, pointerY)
            }
            fill="none"
            stroke={C_OUT}
            strokeWidth={SW_O}
            strokeLinejoin="round"
          />
          {/* 内枠 */}
          <path
            d={
              side === "left"
                ? leftInnerPath(sz.w, sz.h)
                : rightInnerPath(sz.w, sz.h)
            }
            fill="none"
            stroke={C_IN}
            strokeWidth={SW_I}
            strokeLinejoin="round"
            strokeOpacity={0.75}
          />
          {/* コーナーダイアモンド */}
          {decoPoints.map((pts, i) => (
            <polygon
              key={i}
              points={pts}
              fill={C_DECO}
              fillOpacity={0.65}
            />
          ))}
        </svg>
      )}

      {/* コンテンツ */}
      <div
        className="relative z-10 font-serif text-[13px] leading-relaxed text-[#1a0d04]"
        style={{
          paddingTop:    IN + PAD,
          paddingLeft:   padL,
          paddingRight:  padR,
          paddingBottom: IN + PAD,
        }}
      >
        {children}
      </div>
    </div>
  );
}
