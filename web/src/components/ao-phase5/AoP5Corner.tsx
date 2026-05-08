"use client";

/** 四隅配置（親は position: relative かつ overflow が適切に設定されていること） */
export type AoP5CornerSlot = "tl" | "tr" | "bl" | "br";

function rotateDeg(slot: AoP5CornerSlot): number {
  switch (slot) {
    case "tl":
      return 0;
    case "tr":
      return 90;
    case "br":
      return 180;
    case "bl":
      return 270;
    default:
      return 0;
  }
}

/**
 * Phase 5 装飾コーナー（軽量 SVG）。
 * マスターの唐草を後から差し替える際も、このプロップ（slot/size/className）を維持すればOK。
 */
export function AoP5Corner({
  slot,
  size,
  className,
  title,
}: {
  slot: AoP5CornerSlot;
  /** CSS px（親フォント／viewport に依存しない絶対寸法） */
  size: number;
  className?: string;
  title?: string;
}) {
  const deg = rotateDeg(slot);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      style={{
        transform: deg ? `rotate(${deg}deg)` : undefined,
        flexShrink: 0,
        overflow: "visible",
      }}
    >
      {title ? <title>{title}</title> : null}
      {/* 簡略ゴールドコーナー：パス数最小・フィルタ無し（Run時ペイント負荷を抑える） */}
      <path
        d="M4 4h14v3H7v11H4V4zm7 7h11v11H11V11zm14-7v14h-3V7h-11V4h14zm3 17v14h-3V31h-11v-3h14zm-17 17v-14h3v11h11v3H21zm-7-21v11h11v3H11V21zm21 0h11v11H32V21z"
        fill="#c9922a"
        opacity={0.92}
      />
      <path
        d="M2 2h18v2H4v14H2V2zm22 0h18v18h-2V4H24V2zm0 22h18v18h-2V26H24v-2zm-22 0h18v18H4V26h14v-2H2zm11 11h2v14h14v2H13V35zm13-24v2h8v8h2v-12h-10zm0 26v2h10v-12h-2v8h-8zm-26 0h10v-12h-2v8h-8v2zm10-26h2v10h-2v-8h-8v-2h8z"
        fill="#8a6018"
        opacity={0.55}
      />
    </svg>
  );
}
