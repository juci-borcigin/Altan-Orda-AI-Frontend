"use client";

import type { CSSProperties, ReactNode } from "react";

/* ── パーツ寸法（実ピクセル） ───────────────────────── */
const CORNER_W   = 53;  // parchment_bubble / parchment_corner 幅
const CORNER_H   = 50;  // parchment_bubble 高さ（通常角）※更新後
const PTR_H      = 26;  // parchment_corner 高さ
const STRIP_H    = 26;  // parchment_bottom の高さ（= PTR_H）
const SIDE_W     = 49;  // parchment_right の幅
const SIDE_TILE_H = 34; // parchment_right タイル高さ（repeat-y 用）
const INNER_CUT  = 10;  // 内側背景の角カット（簡易）

/* ── パーツ画像パス ─────────────────────────────────── */
const ASSET_VER  = "20260506-2"; // 画像差し替え時のキャッシュバスター
const IMG_CORNER = `/phase5/parchment_bubble.png?v=${ASSET_VER}`;  // 通常角
const IMG_PTR    = "/phase5/parchment_corner.png";  // 突き出し角 (53×26)
const IMG_BOTTOM = "/phase5/parchment_bottom.png";  // 下枠タイル (53×26)
const IMG_SIDE   = "/phase5/parchment_right.png";   // 右枠タイル (49×34)

/* ──────────────────────────────────────────────────────
   AoP5ParchmentBubble
   
   type="user":
     突き出し角 → 右上（scaleX(-1) scaleY(-1)）= 右向きポインタ
     通常角     → 左上・左下・右下
   
   type="ai":
     突き出し角 → 左上（scaleY(-1)）= 左向きポインタ
     通常角     → 右上・左下・右下
   ────────────────────────────────────────────────────── */

export interface AoP5ParchmentBubbleProps {
  /** "user" = ポインタ右上、"ai" = ポインタ左上 */
  type: "user" | "ai";
  /** バブル内側の背景色 */
  bgColor?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function AoP5ParchmentBubble({
  type,
  bgColor = type === "user" ? "#fef9f0" : "#f5edd6",
  children,
  className,
  style,
}: AoP5ParchmentBubbleProps) {
  const isUser = type === "user";

  // ── 殿下指定の割り当て（これが正） ─────────────────
  //
  // User（右上ポインタ）
  //  TL: parchment_corner（上下＋左右反転）
  //  BL: parchment_corner（左右反転）
  //  TR: parchment_bubble（そのまま）
  //  BR: parchment_corner（そのまま）
  //
  // AI（左上ポインタ）
  //  TL: parchment_bubble（左右反転）
  //  BL: parchment_corner（左右反転）
  //  TR: parchment_corner（上下反転）
  //  BR: parchment_corner（そのまま）

  const TL_isBubble = !isUser;
  const TR_isBubble = isUser;
  const BL_isBubble = false;
  const BR_isBubble = false;

  const TL_src = TL_isBubble ? IMG_CORNER : IMG_PTR;
  const TR_src = TR_isBubble ? IMG_CORNER : IMG_PTR;
  const BL_src = BL_isBubble ? IMG_CORNER : IMG_PTR;
  const BR_src = BR_isBubble ? IMG_CORNER : IMG_PTR;

  const TL_h = TL_isBubble ? CORNER_H : PTR_H;
  const TR_h = TR_isBubble ? CORNER_H : PTR_H;
  const BL_h = BL_isBubble ? CORNER_H : PTR_H;
  const BR_h = BR_isBubble ? CORNER_H : PTR_H;

  const TL_tf = isUser ? "scaleX(-1) scaleY(-1)" : "scaleX(-1)";
  const TR_tf = isUser ? "none" : "scaleY(-1)";
  const BL_tf = "scaleX(-1)";
  const BR_tf = "none";

  // 縦枠の開始/終端（上側は上枠26px固定、下側も下枠26px固定）
  // 角が 53px の場合は、その分だけ縦枠を避ける。
  const leftTop = STRIP_H + (isUser ? 0 : (TL_h - STRIP_H));
  const rightTop = STRIP_H + (isUser ? (TR_h - STRIP_H) : 0);
  const leftBottom = STRIP_H + (BL_h - STRIP_H);
  const rightBottom = STRIP_H + (BR_h - STRIP_H);

  // ── コンテンツのパディング ──
  // 上/下: 枠線高さ（26px）＋余白。左右: 縦枠幅を優先（49px）＋余白
  const PAD_TOP = STRIP_H + 6;
  const PAD_BOTTOM = STRIP_H + 6;
  const PAD_SIDE = SIDE_W + 10;

  const innerBgClipPath = `polygon(${SIDE_W + INNER_CUT}px ${STRIP_H}px, ${SIDE_W}px ${STRIP_H + INNER_CUT}px, ${SIDE_W}px calc(100% - ${STRIP_H + INNER_CUT}px), ${SIDE_W + INNER_CUT}px calc(100% - ${STRIP_H}px), calc(100% - ${SIDE_W + INNER_CUT}px) calc(100% - ${STRIP_H}px), calc(100% - ${SIDE_W}px) calc(100% - ${STRIP_H + INNER_CUT}px), calc(100% - ${SIDE_W}px) ${STRIP_H + INNER_CUT}px, calc(100% - ${SIDE_W + INNER_CUT}px) ${STRIP_H}px)`;

  return (
    <div
      className={`relative inline-block ${className ?? ""}`}
      style={{ background: "transparent", minWidth: CORNER_W * 2 + 60, ...style }}
    >
      {/* 内側だけ色を塗る（外側は透過のまま） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: bgColor,
          clipPath: innerBgClipPath,
          zIndex: 0,
        }}
      />

      {/* ══ コーナー ══════════════════════════════════════ */}

      {/* 左上 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={TL_src}
        alt=""
        aria-hidden="true"
        width={CORNER_W}
        height={TL_h}
        className="pointer-events-none absolute"
        style={{
          top: 0,
          left: 0,
          zIndex: 2,
          transform: TL_tf,
          transformOrigin: "center",
        }}
      />

      {/* 右上 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={TR_src}
        alt=""
        aria-hidden="true"
        width={CORNER_W}
        height={TR_h}
        className="pointer-events-none absolute"
        style={{
          top: 0,
          right: 0,
          zIndex: 2,
          transform: TR_tf,
          transformOrigin: "center",
        }}
      />

      {/* 左下 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BL_src}
        alt=""
        aria-hidden="true"
        width={CORNER_W}
        height={BL_h}
        className="pointer-events-none absolute"
        style={{
          bottom: 0,
          left: 0,
          zIndex: 2,
          transform: BL_tf,
          transformOrigin: "center",
        }}
      />

      {/* 右下 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BR_src}
        alt=""
        aria-hidden="true"
        width={CORNER_W}
        height={BR_h}
        className="pointer-events-none absolute"
        style={{
          bottom: 0,
          right: 0,
          zIndex: 2,
          transform: BR_tf,
          transformOrigin: "center",
        }}
      />

      {/* ══ 枠線ストリップ ════════════════════════════════ */}

      {/* 上枠（parchment_bottom を上下反転） */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: 0, left: CORNER_W, right: CORNER_W,
          height: STRIP_H,
          backgroundImage: `url('${IMG_BOTTOM}')`,
          backgroundRepeat: "repeat-x",
          backgroundSize: `${CORNER_W}px ${STRIP_H}px`,
          transform: "scaleY(-1)",
          transformOrigin: "center",
          zIndex: 1,
        }}
      />

      {/* 下枠 */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          bottom: 0, left: CORNER_W, right: CORNER_W,
          height: STRIP_H,
          backgroundImage: `url('${IMG_BOTTOM}')`,
          backgroundRepeat: "repeat-x",
          backgroundSize: `${CORNER_W}px ${STRIP_H}px`,
          zIndex: 1,
        }}
      />

      {/* 左枠（parchment_right を左右反転） */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: 0,
          top: leftTop,
          bottom: leftBottom,
          width: SIDE_W,
          backgroundImage: `url('${IMG_SIDE}')`,
          backgroundRepeat: "repeat-y",
          backgroundSize: `${SIDE_W}px ${SIDE_TILE_H}px`,
          transform: "scaleX(-1)",
          transformOrigin: "center",
          zIndex: 1,
        }}
      />

      {/* 右枠 */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          right: 0,
          top: rightTop,
          bottom: rightBottom,
          width: SIDE_W,
          backgroundImage: `url('${IMG_SIDE}')`,
          backgroundRepeat: "repeat-y",
          backgroundSize: `${SIDE_W}px ${SIDE_TILE_H}px`,
          zIndex: 1,
        }}
      />

      {/* ══ コンテンツ ════════════════════════════════════ */}
      <div
        className="relative z-10 font-serif text-[13px] leading-relaxed text-[#1a0d04]"
        style={{
          paddingTop:    PAD_TOP,
          paddingBottom: PAD_BOTTOM,
          paddingLeft:   PAD_SIDE,
          paddingRight:  PAD_SIDE,
        }}
      >
        {children}
      </div>
    </div>
  );
}
