/**
 * アイコン SVG
 * - ヘッダのログイン／ログアウト等：256 系（塗り solid）
 * - メイン周り（使用量・設定・年代記・令旨・送信）：24 系（線画 stroke、currentColor）
 */

import type { ReactNode } from "react";

const VB = "0 0 256 256";

function IconSvg({
  size,
  className,
  children,
}: {
  size: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox={VB} className={className} aria-hidden>
      {children}
    </svg>
  );
}

function IconStroke24({
  size,
  className,
  strokeWidth = 1.85,
  children,
}: {
  size: number;
  className?: string;
  strokeWidth?: number;
  children: ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconStroke256({
  size,
  className,
  strokeWidth = 16,
  children,
}: {
  size: number;
  className?: string;
  strokeWidth?: number;
  children: ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={VB}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** 折れ線グラフ（使用量・API 推移のイメージ） */
export function IcoCoinBag({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.75}>
      <path d="M3.5 19.5h17" />
      <path d="M3.5 19.5V7" />
      <polyline points="5.5,16.5 9,13.5 12.5,15 16,9.5 19.5,11.5" />
    </IconStroke24>
  );
}

/** 歯車（設定） */
export function IcoGear({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.7}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </IconStroke24>
  );
}

/** 巻物＋文面（令旨・Lucide scroll-text 相当） */
export function IcoScroll({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={2}>
      <path d="M15 12h-5" />
      <path d="M15 8h-5" />
      <path d="M19 17V5a2 2 0 0 0-2-2H4" />
      <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
    </IconStroke24>
  );
}

/** 議事「新規」— 角丸枠＋（新規・追加の汎用） */
export function IcoRoundedPlus({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.65}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
      <path d="M12 8v8M8 12h8" strokeWidth={2.05} />
    </IconStroke24>
  );
}

/** 議事一覧ページ送り（先頭・前・次・末尾） */
export function IcoAgendaPageFirst({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.7}>
      <path d="M16 8l-4 4 4 4M11 8l-4 4 4 4" />
    </IconStroke24>
  );
}
export function IcoAgendaPagePrev({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.7}>
      <path d="M14 8l-4 4 4 4" />
    </IconStroke24>
  );
}
export function IcoAgendaPageNext({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.7}>
      <path d="M10 8l4 4-4 4" />
    </IconStroke24>
  );
}
export function IcoAgendaPageLast({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.7}>
      <path d="M8 8l4 4-4 4M13 8l4 4-4 4" />
    </IconStroke24>
  );
}

/** 年代記（本＋傾いた巻・256 viewBox） */
export function IcoBook({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke256 size={size} className={className}>
      <rect x="48" y="40" width="64" height="176" rx="8" />
      <path d="M217.67,205.77l-46.81,10a8,8,0,0,1-9.5-6.21L128.18,51.8a8.07,8.07,0,0,1,6.15-9.57l46.81-10a8,8,0,0,1,9.5,6.21L223.82,196.2A8.07,8.07,0,0,1,217.67,205.77Z" />
      <line x1="48" y1="72" x2="112" y2="72" />
      <line x1="48" y1="184" x2="112" y2="184" />
      <line x1="133.16" y1="75.48" x2="195.61" y2="62.06" />
      <line x1="139.79" y1="107.04" x2="202.25" y2="93.62" />
      <line x1="156.39" y1="185.94" x2="218.84" y2="172.52" />
    </IconStroke256>
  );
}

/** 戻る（矢印・Undo 系） */
export function IcoArrowLeft({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconSvg size={size} className={className}>
      <path d="M232,112a64.07,64.07,0,0,1-64,64H88v40a8,8,0,0,1-13.66,5.66l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,88,120v40h80a48,48,0,0,0,0-96H80a8,8,0,0,1,0-16h88A64.07,64.07,0,0,1,232,112Z" />
    </IconSvg>
  );
}

/** 送信（紙飛行機・線画） */
export function IcoExecute({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className}>
      <path d="M22 2 11 13" />
      <path d="M22 2 3 10l8 3 11-11" />
      <path d="M3 10l8 3-1.5 8.5L11 13" />
    </IconStroke24>
  );
}

/** 添付（クリップ・線画） */
export function IcoPaperclip({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.75}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </IconStroke24>
  );
}

/** ログイン（矢印が入る） */
export function IcoLogin({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconSvg size={size} className={className}>
      <path d="M152,40H72A32,32,0,0,0,40,72v112a32,32,0,0,0,32,32h80a8,8,0,0,0,0-16H72a16,16,0,0,1-16-16V72A16,16,0,0,1,72,56h80a8,8,0,0,0,0-16Zm89.66,93.66-40-40A8,8,0,0,0,188,99.31V120H104a8,8,0,0,0,0,16h84v20.69a8,8,0,0,0,13.66,5.65l40-40A8,8,0,0,0,241.66,133.66Z" />
    </IconSvg>
  );
}

/** ログアウト（矢印が出る） */
export function IcoLogout({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconSvg size={size} className={className}>
      <path d="M184,40H104a8,8,0,0,0,0,16h80a16,16,0,0,1,16,16v112a16,16,0,0,1-16,16H104a8,8,0,0,0,0,16h80a32,32,0,0,0,32-32V72A32,32,0,0,0,184,40ZM68,93.66l-40,40a8,8,0,0,0,0,11.32l40,40A8,8,0,0,0,80,180.69V160h84a8,8,0,0,0,0-16H80V99.31a8,8,0,0,0-12-5.65Z" />
    </IconSvg>
  );
}

/** @deprecated IcoExecute と同一 */
export const IcoPlay = IcoExecute;

/** 削除（ゴミ箱・線画） */
export function IcoTrash({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} strokeWidth={1.75} className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconStroke24>
  );
}

/** ピン（明示参照） */
export function IcoPin({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} strokeWidth={1.75} className={className}>
      <path d="M12 17v5" />
      <path d="M9 3h6" />
      <path d="M10 3v6.5L6 14v2h12v-2l-4-4.5V3" />
    </IconStroke24>
  );
}

/** 投稿取り消し（Revert） */
export function IcoUndo({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} strokeWidth={1.75} className={className}>
      <path d="M9 7H4v5" />
      <path d="M4 12a8 8 0 1 0 2-5.3" />
    </IconStroke24>
  );
}

export function IcoCheck({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** システムポップアップ：承認（丸枠＋チェック） */
export function IcoPopupOk({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.65}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2 10.8 15 16 9.5" strokeWidth={2} />
    </IconStroke24>
  );
}

/** システムポップアップ：取消（丸枠＋×） */
export function IcoPopupNo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <IconStroke24 size={size} className={className} strokeWidth={1.65}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" strokeWidth={2} />
    </IconStroke24>
  );
}
