/**
 * シェル／モジュール共通クロム（見た目）。中身（講義本文・論など）はここを見ない。
 * 大枠の影は金輪郭の overlayDropShadow。矩形 box-shadow は使わない。
 */

export const AO_FRAME_AL_OVERLAY_DROP_SHADOW =
  "drop-shadow(3px 8px 6px rgba(0,0,0,0.34)) drop-shadow(0 3px 4px rgba(0,0,0,0.21))";
export const AO_FRAME_AL_OVERLAY_SHADOW_EXTENT_PX = 22;

/** 既定ボタン（チャット送信と同じ地・金枠・押し込み） */
export const AO_BTN_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-[#8D5400]/50 bg-gradient-to-b from-[#fbf6e8] to-[#e9dcc6] px-2 py-0.5 font-serif text-[12px] leading-tight text-[#3D1C08] shadow-[0_1px_2px_rgba(0,0,0,0.12)] outline-none transition-[transform,opacity,box-shadow] hover:border-[#8D5400]/80 hover:shadow-[0_2px_6px_rgba(0,0,0,0.14)] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#8D5400]/50 disabled:hover:shadow-[0_1px_2px_rgba(0,0,0,0.12)] disabled:active:scale-100";

export const AO_BTN_SELECTED_CLASS =
  "border-[#8D5400]/80 bg-black/[0.06] font-semibold shadow-[inset_0_1px_4px_rgba(0,0,0,0.12)]";

/** 羊皮紙上のアイコン（モジュールヘッダ。色は面の `color: var(--color-ao-ink)` を継承） */
export const AO_PARCHMENT_ICON_BTN_CLASS =
  "inline-flex items-center justify-center rounded-sm border-0 bg-transparent p-1 outline-none transition-[transform,opacity] hover:bg-black/5 active:scale-[0.9] active:opacity-90 disabled:pointer-events-none disabled:opacity-30";

/** 戻る（令旨・年代記ナビと同じクロム） */
export const AO_NAV_BACK_BTN_CLASS =
  "ao-p5-kurultai-ink-icon flex items-center justify-center rounded-sm border-0 bg-transparent p-0.5 outline-none transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100";

/** メイン左上アイコン：枠なし・クリック時はわずかに縮小 */
export const AO_MAIN_ICON_BTN_CLASS =
  "rounded-none border-0 bg-transparent p-1 text-[#DBB961] outline-none transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90";

/** 議事帯右上：年代記／使用量／設定 */
export const AO_MAIN_HEADER_ICON_BTN_CLASS =
  "inline-flex items-center justify-center rounded-md border-0 bg-transparent p-1 outline-none transition-[transform,opacity] hover:bg-[#8D5400]/[0.08] active:scale-[0.9] active:opacity-90";

/** 議事オーバーレイ：ページ送り（アイコンのみ） */
export const AO_AGENDA_NAV_BTN_CLASS =
  "flex items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-[#8D5400] outline-none transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100";

/** 帯ヘッダ左：議事ページの「新規」 */
export const AO_SUBPAGE_HDR_NEW_BTN_CLASS =
  "inline-flex items-center gap-1 rounded-sm border-0 bg-transparent px-0.5 py-0 text-[10px] font-semibold leading-none text-[#8D5400] transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90";

/** 議事帯ツールバー（年代記・使用量・設定・令旨）：従来 10/14px の約 120% */
export const AO_MAIN_TOOLBAR_ICON_SCALE = 1.2;

/** 左カラムなど矩形枠の box-shadow（大枠 overlayDropShadow とは別） */
export const AO_DROP_SHADOW_MAIN_FRAME =
  "3px 8px 22px rgba(0,0,0,0.34), 0 3px 10px rgba(0,0,0,0.21)";

/** 9-slice吹き出し：PNG輪郭に沿って右下へ影 */
export const AO_P5_BUBBLE_SHADOW_FILTER =
  "drop-shadow(6px 8px 2px rgba(0,0,0,0.22)) drop-shadow(3px 4px 2px rgba(0,0,0,0.16))";

/** 顔グラ画像のみへ適用 */
export const AO_CHAT_AVATAR_DROP_SHADOW_FILTER = "drop-shadow(1px 1px 1px rgba(236,224,200,0.85))";

/** Frame 地の白～クリームに寄せたヘッダー色 */
export const AO_P5_PARCHMENT = "#f6f4ee";

/** 応答待ちインジケータ（フェーズ循環） */
export const AO_THINKING_DOT_CYCLE = [".", "..", "...", "...."] as const;
