"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  AO_TOPICS,
  type TopicUiId,
  activeNokorNamesForTopic,
  aoPostingProjectIdForTopic,
  aoThreadsForPostMenu,
  compareThreadsForGiList,
  createAoThreadForTopic,
  isAoNativeThread,
  projectIdsForTopic,
} from "@/lib/ao-topics";
import {
  IcoAgendaPageFirst,
  IcoAgendaPageLast,
  IcoAgendaPageNext,
  IcoAgendaPagePrev,
  IcoArrowLeft,
  IcoBook,
  IcoCheck,
  IcoCoinBag,
  IcoExecute,
  IcoGear,
  IcoLogin,
  IcoLogout,
  IcoRoundedPlus,
  IcoScroll,
} from "@/components/ao-action-icons";
import { AoMessageMarkdown } from "@/components/AoMessageMarkdown";
import { AoSettingsOverlay, AoSettingsSubpageTabs, type AoSettingsOverlayHandle, type AoSettingsSubpage } from "@/components/AoSettingsOverlay";
import { AoUsageOverlay } from "@/components/AoUsageOverlay";
import { runTypewriter } from "@/lib/ao-typewriter";
import {
  type AppState,
  type Msg,
  type MsgChatCompletionMeta,
  type MsgRawPromptBundle,
  type MsgTurnUsage,
  type Thread,
  aoUid,
  makeDefaultAppState,
  parseAppStateJson,
  pruneEphemeralEmptyThreads,
} from "@/lib/ao-state";
import type { DbThreadRow } from "@/lib/ao-supabase-thread-map";
import { mergeMsgsHydrateFromServer, mergeThreadSummariesIntoState } from "@/lib/ao-thread-list-merge";
import {
  aoClampStoredThreadTitle,
  aoClampTitleDraftInput,
  aoThreadTitleChipLabel,
  aoThreadTitleForList,
  aoTitleSnippetFromFirstUserPost,
} from "@/lib/ao-thread-title";
import { displayTextForClaudeImportedAssistant } from "@/lib/ao-claude-display-text";
import {
  normalizeChatUsageFromApi,
  normalizeCompletionMetaFromApi,
  normalizeRawPromptsFromApi,
} from "@/lib/ao-chat-usage-normalize";
import { estimateUsdFromTokensClient } from "@/lib/ao-usage-estimate-client";
import { AO_PORTRAIT_LAYOUT_W_PX } from "@/lib/ao-portrait";
import {
  AoOrnamentalFrame,
  AoP5NineSliceBubble,
  AoP5FaceFrameMid,
  AoP5NameplateSmFrame,
  AO_PC_NOKOR_TIGHT_PAD_X_PX,
  aoP5NameplateSmTightPlateOuterWidthPx,
} from "@/components/ao-phase5";
import { detectNamedSpeaker, getPrimarySpeakerForProject } from "@/lib/ao-prompts";
import type { ProjectId } from "@/lib/ao-types";

const STORAGE_KEY = "ao_state_v1";
/** メイン枠左上：使用量・設定アイコン寸法（歯車は以前の 150% 相当） */
const MAIN_HEADER_ICON_PX = 18;
/** メイン左上アイコン：枠なし・クリック時はわずかに縮小 */
const AO_MAIN_ICON_BTN_CLASS =
  "rounded-none border-0 bg-transparent p-1 text-[#DBB961] outline-none transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90";
/** 議事帯右上：年代記／使用量／設定（装飾枠なし） */
const AO_MAIN_HEADER_ICON_BTN_CLASS =
  "inline-flex items-center justify-center rounded-md border-0 bg-transparent p-1 text-[#3D1C08] outline-none transition-[transform,opacity] hover:bg-[#3D1C08]/[0.07] active:scale-[0.9] active:opacity-90";
/** 邦主列：送信（帯びたボタン） */
const AO_MAIN_SEND_BTN_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-[#8D5400]/50 bg-gradient-to-b from-[#fbf6e8] to-[#e9dcc6] px-2 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.12)] outline-none transition-[transform,opacity,box-shadow] hover:border-[#8D5400]/80 hover:shadow-[0_2px_6px_rgba(0,0,0,0.14)] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#8D5400]/50 disabled:hover:shadow-[0_1px_2px_rgba(0,0,0,0.12)] disabled:active:scale-100";
/** メイン部のアイコン色（令旨/年代記/送信） */
const AO_MAIN_ICON_FG = "#8D5400";

/** メインエリア統一地色・ボタン地（Phase 4 TO-BE ①⑤⑥） */
const AO_MAIN_BG = "#133D5C";
/** チャット部・AI 吹き出し（枠線なし・Markdown は ao-chat-ai-bubble-md） */
const AO_CHAT_AI_BUBBLE_BG = "#F4F0E7";
const AO_CHAT_AI_BUBBLE_FG = "#1B0D04";
/** 枠線・メインフォント色（Phase 4 TO-BE ①②⑥⑦） */
const AO_GOLD_UI = "#DBB961";
/** 地図背景に対して外向き（メイン大枠）／チャット履歴吹き出しと共通 */
const AO_DROP_SHADOW_MAIN_FRAME =
  "3px 8px 22px rgba(0,0,0,0.34), 0 3px 10px rgba(0,0,0,0.21)";
/** 吹き出し：左上からの光想定・影は右下へ（offset-x/y とも正） */
const AO_DROP_SHADOW_BUBBLE =
  "4px 7px 16px rgba(0,0,0,0.26), 3px 5px 10px rgba(0,0,0,0.17)";
/** 9-slice吹き出し：PNG輪郭に沿って右下へ影 */
const AO_P5_BUBBLE_SHADOW_FILTER =
  "drop-shadow(6px 8px 2px rgba(0,0,0,0.22)) drop-shadow(3px 4px 2px rgba(0,0,0,0.16))";
/** 顔グラ画像のみへ適用（親に filter を付けると子の text-shadow が潰れることがある） */
const AO_CHAT_AVATAR_DROP_SHADOW_FILTER = "drop-shadow(1px 1px 1px rgba(236,224,200,0.85))";

/** 議事オーバーレイ：1ページあたりの行数 */
const AGENDA_PAGE_SIZE = 5;
/** 議事オーバーレイ：ページ送り（アイコンのみ） */
const AO_AGENDA_NAV_BTN_CLASS =
  "flex items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-[#8D5400] outline-none transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100";

/** 帯ヘッダ左：議事ページの「新規」（アイコン＋短文） */
const AO_SUBPAGE_HDR_NEW_BTN_CLASS =
  "inline-flex items-center gap-1 rounded-sm border-0 bg-transparent px-0.5 py-0 text-[10px] font-semibold leading-none text-[#8D5400] transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90";

/** 応答待ちインジケータ（フェーズ循環） */
const AO_THINKING_DOT_CYCLE = [".", "..", "...", ""];

function aoResolveUsdForOverlay(u: MsgTurnUsage): number | null {
  return u.estimatedUsd ?? estimateUsdFromTokensClient(u.promptTokens, u.completionTokens);
}

/** Raw ポップオーバー：以前の上限の約 50％（Y のみ） */
const RAW_POPOVER_MAX_H_OUTER = "min(37vh,250px)";
const RAW_POPOVER_MAX_H_SCROLL = "min(34vh,230px)";
const RAW_POPOVER_W = 320;
/** Raw 内フォント：基準 7px / 6px に戻し、それぞれ +2px */
const RAW_POPOVER_FS_MAIN_PX = 7 + 2;
const RAW_POPOVER_FS_MONO_PX = 6 + 2;

function aoSyntheticMsgTurnUsage(): MsgTurnUsage {
  return {
    modelId: "—",
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedUsd: null,
  };
}

/* ---- Phase 5: Parchment & Gold ---- */
/** Frame.png の地の白～クリームに寄せたヘッダー色 */
const AO_P5_PARCHMENT = "#f6f4ee";
/**
 * 僚友レイアウト（1列あたりの横幅算出）。
 * ① 顔グラの幅
 * ② 名下バンド幅＝全角8文字分（想定1文字幅 × 8）
 * ③ 顔グラ同士の見かけの間隔：②が①より広いとき列内の左右余白として自然に発生
 * ④ max(①,②) ＋ 横パディング ＝ 1人分の列幅
 * ⑤ ④ × 8 ＝ 僚友帯の横スクロール論理幅（CHAT_BUBBLE_* の算出にも MAIN_COLUMN_W_PX が関わる）
 */
const NOKOR_PORTRAIT_W_PX = AO_PORTRAIT_LAYOUT_W_PX;
/** AoP5FaceFrameMid：角 6×2 で顔より外周 +12px */
const FACE_SM_FRAME_OUTER_EXTRA_PX = 12;
/** 令旨／年代記：従来 min-h-[52px] の 66％ */
const REISHI_CHRONICLE_BTN_MIN_H_PX = Math.round(52 * 0.66);
/** ≫ 送信：令旨と同系見た目だが縦は約33％（52px×0.33） */
const JUCHI_SEND_BTN_MIN_H_PX = Math.round(52 * 0.33);
/** 論タブ：字サイズ（style）／パディングは選択時 translate 用に若干広め */
const AO_RON_TAB_FONT_PX = 14;
/** 議事タイトル：論タブより 1 段階小さく */
const AO_GIJI_TITLE_FONT_PX = AO_RON_TAB_FONT_PX - 1;
const AO_RON_TAB_PAD_X_PX = 7;
const AO_RON_TAB_PAD_Y_PX = 4;
/** 年代記／令旨オーバーレイ上部タブはさらに詰める（YahooJ的に密度優先） */
const AO_RON_TAB_PAD_X_OVERLAY_PX = Math.max(0, Math.round(AO_RON_TAB_PAD_X_PX * 0.5));
const AO_RON_TAB_PAD_Y_OVERLAY_PX = Math.max(0, Math.round(AO_RON_TAB_PAD_Y_PX * 0.5));
/** 名下など「8文字分」の換算用（全角想定・調整はこの値のみで可） */
const NOKOR_NAME_EM_W_PX = 10;
const NOKOR_NAME_MAX_CHARS = 8;
const NOKOR_TEXT_BAND_W_PX = NOKOR_NAME_EM_W_PX * NOKOR_NAME_MAX_CHARS;
const NOKOR_COL_PAD_X_PX = 4;
const NOKOR_COL_INNER_W_PX = Math.max(NOKOR_PORTRAIT_W_PX, NOKOR_TEXT_BAND_W_PX);
const NOKOR_COL_W_PX = NOKOR_COL_INNER_W_PX + NOKOR_COL_PAD_X_PX * 2;

/** チャット（履歴・入力）の顔グラ列：7文字 tight 名札外寸と顔枠外寸の広い方 */
const CHAT_FACE_STACK_W_PX = NOKOR_PORTRAIT_W_PX + FACE_SM_FRAME_OUTER_EXTRA_PX;
const CHAT_NAMEPLATE_OUTER_7CHAR_PX = aoP5NameplateSmTightPlateOuterWidthPx({
  bandWidthPx: NOKOR_PORTRAIT_W_PX,
  nameplateFontSizePx: 7,
  layoutCharCount: 7,
});
const CHAT_AVATAR_COL_W_PX = Math.max(CHAT_FACE_STACK_W_PX, CHAT_NAMEPLATE_OUTER_7CHAR_PX);

type NokorDef = {
  name: string;
  /** ルビが付かない先頭部分（例: 「第一の」） */
  captionPrefix: string;
  /** ルビの本体（例: 「千戸長」） */
  captionRubyBase: string;
  /** ルビ読み（カタカナ） */
  captionRubyRt: string;
  line2: string;
  src: string;
};

const NOKOR: readonly NokorDef[] = [
  { name: "フナン", captionPrefix: "第一の", captionRubyBase: "千戸長", captionRubyRt: "ミンガン", line2: "為政論", src: "/personas/AO_Char_Hunan.png" },
  { name: "モンケウール", captionPrefix: "第二の", captionRubyBase: "千戸長", captionRubyRt: "ミンガン", line2: "兵馬論", src: "/personas/AO_Char_Mongkeur.png" },
  { name: "ケテ", captionPrefix: "第三の", captionRubyBase: "千戸長", captionRubyRt: "ミンガン", line2: "兵馬論", src: "/personas/AO_Char_Qete.png" },
  { name: "バイジュ", captionPrefix: "第四の", captionRubyBase: "千戸長", captionRubyRt: "ミンガン", line2: "心気論", src: "/personas/AO_Char_Baiju.png" },
  { name: "クドゥカ・ベキ", captionPrefix: "オイラト", captionRubyBase: "族長", captionRubyRt: "ノヤン", line2: "巷間論", src: "/personas/AO_Char_QudukaBeki.png" },
  { name: "タタ・トゥンガ", captionPrefix: "", captionRubyBase: "師傅", captionRubyRt: "アタベク", line2: "学究論", src: "/personas/AO_Char_TataTunga.png" },
  { name: "チン・テムール", captionPrefix: "", captionRubyBase: "政商", captionRubyRt: "オルトク", line2: "遠交論", src: "/personas/AO_Char_ChinTemur.png" },
  { name: "コルグズ", captionPrefix: "", captionRubyBase: "書記", captionRubyRt: "ビチクチ", line2: "—", src: "/personas/AO_Char_Qorguz.png" },
] as const;

function isSyntheticAssistantNoiseForHistory(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // サーバ側フィルタ／表示用のメタ文言は次回履歴に混ぜない（JSONL 崩壊の連鎖を防ぐ）
  if (t.startsWith("（speaker不許可:")) return true;
  if (t === "（空）") return true;
  return false;
}

/** ⑤ 僚友帯の論理幅（px） */
const NOKOR_STRIP_W_PX = NOKOR_COL_W_PX * NOKOR.length;
const NOKOR_FRAME_MARGIN_V_BEFORE_PX = 3;
const NOKOR_FRAME_MARGIN_V_PX = Math.round(NOKOR_FRAME_MARGIN_V_BEFORE_PX * 0.4);
/** 「僚友」キャプション〜8列：一段階目（3px の50%）→ 現状の60% — gap は "Npx" 必須 */
const NOKOR_CAPTION_STRIP_GAP_BEFORE_PX = 3;
const NOKOR_CAPTION_STRIP_GAP_STEP1_PX = Math.round(NOKOR_CAPTION_STRIP_GAP_BEFORE_PX * 0.5);
/** 「僚　友」〜8列の間をさらに 2px 削り */
const NOKOR_CAPTION_STRIP_GAP_PX = Math.max(0, Math.round(NOKOR_CAPTION_STRIP_GAP_STEP1_PX * 0.6) - 2);
/** 見出しチップ下パディングも同様に 50% → さらに現状の60% */
const NOKOR_CAPTION_CHIP_PAD_Y_BEFORE_PX = 3;
const NOKOR_CAPTION_CHIP_PAD_TOP_PX = NOKOR_CAPTION_CHIP_PAD_Y_BEFORE_PX;
const NOKOR_CAPTION_CHIP_PAD_BOTTOM_STEP1_PX = Math.round(NOKOR_CAPTION_CHIP_PAD_Y_BEFORE_PX * 0.5);
const NOKOR_CAPTION_CHIP_PAD_BOTTOM_PX = Math.max(0, Math.round(NOKOR_CAPTION_CHIP_PAD_BOTTOM_STEP1_PX * 0.6));
/** ④ 吹き出し〜僚友：中段 pad が底まで詰まっている場合でも詰めるため、内枠上マージンから削る */
const NOKOR_INNER_FRAME_MARGIN_TOP_SHRINK_PX = 1;
/** メイン列の内側パディング（MAIN_COLUMN_W_PX 算出・上パディング基準で共通） */
const MAIN_COLUMN_PAD_PX = 5;
/** メイン列 ornamental 内・本文エリアの左右ギャップ（枠インセットより内側の余白）。ゼロで段落ち寄せ */
const MAIN_COLUMN_GUTTER_X_PX = 0;
const MAIN_COLUMN_W_PX = NOKOR_STRIP_W_PX + MAIN_COLUMN_PAD_PX * 2;
/** メイン中段の横パディング（px-3）— チャット吹き出し幅をメインと揃える */
const MAIN_MIDDLE_SECTION_PAD_X_PX = 12;
const MAIN_BUBBLE_ROW_GAP_PX = 10;
/** チャット履歴吹き出しの最小高さ（約1行＋パディング。入力欄の MAIN_SPEECH_BUBBLE_H_PX は別） */
const CHAT_HISTORY_BUBBLE_MIN_H_PX = Math.ceil(13 * 1.42) + 8;

/** 議事タイトル・右上使用量/設定・右下令旨/年代記チップ：装飾枠インセットを詰め、内側の縦余白（計測の青エリア）を抑える */
const GIJI_CHIP_ORNAMENT_INSET_PX = 5;
const GIJI_CHIP_ORNAMENT_CONTENT_PAD = "2px 6px";
/** 議事タイトル羊皮紙（計測 ref）内の上下余白 — DevTools の青ボックスの Y */
const GIJI_TITLE_PARCHMENT_PAD_Y_PX = 4;

/** スマホ・ユーザー Raw：上端はユーザー吹き出しに合わせ、幅は AI 吹き出し幅・右端はユーザー吹き出し右端。高さは AI 側チップ同様に固定。 */
function aoCompactUserRawPanelRect(messagesRoot: HTMLElement, msgId: string): {
  top: number;
  left: number;
  width: number;
  height: number;
} | null {
  const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(msgId) : msgId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const row = messagesRoot.querySelector(`[data-ao-msg-id="${esc}"]`);
  if (!(row instanceof HTMLElement)) return null;
  const userBubble = row.querySelector("[data-ao-chat-bubble]");
  if (!(userBubble instanceof HTMLElement)) return null;
  let aiBubbleEl: Element | null = null;
  let cand: Element | null = row.nextElementSibling;
  while (cand) {
    if (cand instanceof HTMLElement && cand.matches("[data-ao-chat-row]")) {
      // ユーザー行は flex-row-reverse、AI 行は通常順。直後のユーザー連続はスキップする。
      if (!cand.classList.contains("flex-row-reverse")) {
        aiBubbleEl = cand.querySelector("[data-ao-chat-bubble]");
        break;
      }
    }
    cand = cand.nextElementSibling;
  }
  const ub = userBubble.getBoundingClientRect();
  const gap = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  if (!(aiBubbleEl instanceof HTMLElement)) {
    const w = Math.min(RAW_POPOVER_W, vw - 16);
    const h = Math.min(vh * 0.37, 250);
    return {
      top: Math.max(gap, ub.top),
      left: Math.max(gap, Math.min(ub.right - w, vw - w - gap)),
      width: w,
      height: Math.min(h, vh - Math.max(gap, ub.top) - gap),
    };
  }
  const ab = aiBubbleEl.getBoundingClientRect();
  const width = Math.max(120, Math.round(ab.width));
  const fixedPanelH = Math.min(Math.round(vh * 0.37), 250);
  let left = Math.round(ub.right - width);
  left = Math.max(gap, Math.min(left, vw - width - gap));
  let top = Math.round(ub.top);
  top = Math.max(gap, Math.min(top, vh - fixedPanelH - gap));
  const height = Math.min(fixedPanelH, vh - top - gap);
  return {
    top,
    left,
    width,
    height: Math.max(120, height),
  };
}

function placeRawPromptPopover(opts: {
  anchorRect: DOMRect;
  /** 狭ビュー：横の基準は anchorRect（顔グラ）、縦はこの矩形の中央（チャット吹き出しの実測） */
  verticalAnchorRect?: DOMRect;
  /** 狭ビュー・AI 側：右に置けないとき左へ逃がす下限（顔グラ右端＋余白）。無いとき従来どおり吹き出し左基準で逃がす */
  compactAvatarRect?: DOMRect;
  side: "ai" | "user";
  popoverWidth: number;
  popoverHeight: number;
  /** verticalAnchorRect が無い狭ビュー向けフォールバック */
  compactAlignBubbleMid?: boolean;
  bubbleMinHeightPx?: number;
}): { top: number; left: number } {
  const gap = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  let left =
    opts.side === "ai" ? opts.anchorRect.right + gap : opts.anchorRect.left - opts.popoverWidth - gap;

  if (opts.side === "ai" && left + opts.popoverWidth > vw - gap) {
    const minLeftFromAvatar = opts.compactAvatarRect ? opts.compactAvatarRect.right + gap : gap;
    const flushRight = vw - opts.popoverWidth - gap;
    if (flushRight >= minLeftFromAvatar) {
      left = flushRight;
    } else {
      left = clamp(minLeftFromAvatar, gap, vw - opts.popoverWidth - gap);
    }
  }
  if (opts.side === "user" && left < gap) {
    left = clamp(opts.anchorRect.right + gap, gap, vw - opts.popoverWidth - gap);
  }
  left = clamp(left, gap, vw - opts.popoverWidth - gap);

  let top: number;
  if (opts.verticalAnchorRect) {
    const vr = opts.verticalAnchorRect;
    const midY = vr.top + vr.height / 2;
    top = clamp(midY - opts.popoverHeight / 2, gap, vh - opts.popoverHeight - gap);
  } else if (opts.compactAlignBubbleMid && opts.bubbleMinHeightPx != null && opts.bubbleMinHeightPx > 0) {
    const midY = opts.anchorRect.top + opts.bubbleMinHeightPx / 2;
    top = clamp(midY - opts.popoverHeight / 2, gap, vh - opts.popoverHeight - gap);
  } else {
    top = clamp(opts.anchorRect.top, gap, vh - opts.popoverHeight - gap);
  }
  return { left, top };
}

/** 論〜メイン枠の上側・論〜議事タイトルは別途 GIKUJI_* */
const MAIN_OUTER_TOP_GAP_BEFORE_PX = 3;
const MAIN_OUTER_TOP_GAP_PX = Math.round(MAIN_OUTER_TOP_GAP_BEFORE_PX * 0.3);
/** PC: ヘッダ(~58px) + Frame 帯(~14px)。ヘッダ直下のメイン縦幅・mapタイル算出と共通 */
const AO_PC_HEADER_FRAME_BELOW_H_PX = 58 + 14;
/**
 * PC運用（固定幅1200px）でのズーム確認は 90/100/125%。
 * 125% で「現状150%相当」の見え方に寄せるため、文字系だけ 150/125=1.2 を上乗せする。
 */
const AO_PC_ZOOM_COMP_SCALE = 1.2;
/** 中央カラム main 外周の縦 gap（旧 3 の 30%） */
const MAIN_COLUMN_STACK_GAP_PX = Math.round(3 * 0.3);
const MAIN_INNER_TOP_PAD_BEFORE_PX = MAIN_COLUMN_PAD_PX;
const MAIN_INNER_TOP_PAD_PX = Math.round(MAIN_INNER_TOP_PAD_BEFORE_PX * 0.3);
const RON_AREA_PAD_TOP_BEFORE_PX = 12; /* 旧 Tailwind pt-3 */
/** 論エリア上：算出後にさらに 1px 削り（僚友下枠確保の縦詰め） */
const RON_AREA_PAD_TOP_PX = Math.max(0, Math.round(RON_AREA_PAD_TOP_BEFORE_PX * 0.3) - 1);
/** 論〜議事タイトル：一度 50% にしたあとの「現状」を起点にさらに 70% */
const GIKUJI_TITLE_PAD_TOP_BEFORE_PX = 8; /* 旧 Tailwind pt-2 */
const GIKUJI_TITLE_PAD_TOP_STEP_PX = Math.round(GIKUJI_TITLE_PAD_TOP_BEFORE_PX * 0.5);
/** 論エリア下〜議事タイトル相当の余白をさらに 2px 削り */
const GIKUJI_TITLE_PAD_TOP_PX = Math.max(0, Math.round(GIKUJI_TITLE_PAD_TOP_STEP_PX * 0.7) - 2);
/** 議事タイトル下〜吹き出し行（gap-1 の50% を一度適用した値をさらに現状の70%） */
const GIKUJI_TITLE_GAP_AFTER_BEFORE_PX = 4;
const GIKUJI_TITLE_GAP_AFTER_STEP_PX = Math.round(GIKUJI_TITLE_GAP_AFTER_BEFORE_PX * 0.5);
/** 議事タイトル下の余白をさらに 2px 削り */
const GIKUJI_TITLE_GAP_AFTER_PX = Math.max(0, Math.round(GIKUJI_TITLE_GAP_AFTER_STEP_PX * 0.7) - 2);
/** 中段（議事〜吹き出し）直下の余白：旧 pb-1≒4px から計 4px 削減（僚友を詰め下枠を確保） */
const GIKUJI_MID_BLOCK_PAD_BOTTOM_BEFORE_PX = 4;
const GIKUJI_MID_BLOCK_PAD_BOTTOM_SHRINK_TOTAL_PX = 4;
/** 吹き出し〜僚友の間をさらに 1px 削り */
/** 吹き出し下は枠ギリギリまで詰める */
const GIKUJI_MID_BLOCK_PAD_BOTTOM_PX = 0;

/** 図②-2: ヘッダ下の「メイン部」固定高（変更しない） */
const MAIN_TOP_FIXED_H_PX = 360;
/** 狭ビューポートでは縦を削りチャット履歴の割合を確保（論〜入力ブロックの目標上限にも利用） */
const MAIN_TOP_FIXED_H_COMPACT_PX = Math.round(MAIN_TOP_FIXED_H_PX * 0.68);
/**
 * Chrome（iPhone）想定・単列レイアウトに切り替える上限（CSS px）。
 * `globals.css` の `.ao-mobile-stack-scale` の max-width:767px と揃える。
 * 参考幅: SE1≒320px、16 Pro≒393〜402px（Chrome アドレスバー状態で変動あり）
 */
const AO_MOBILE_MAX_CSS_PX = 767;
/**
 * 狭ビュー邦主・僚友ドロワー：ヘッダ下かつ画面中央帯での横スワイプのみ検知（縦スクロールと分離しやすくする）。
 * 閉：右スワイプで左からスライドイン／開：左スワイプで左端へ隠す。
 * 左右端はブラウザの戻る等と競合しやすいため除外する。
 */
/** 開／閉とみなす最小の横スライド量（px）。縦位移動より横を優先する */
const AO_COMPACT_KIN_HORIZONTAL_SWIPE_MIN_DX = 48;
/** |dx| がこれ倍以上あれば「横ジェスチャ」とみなす（対 |dy|） */
const AO_COMPACT_KIN_HORIZONTAL_DOMINANCE_RATIO = 1.12;
/** 画面左右それぞれこの割合ぶんを除外し、中央帯でのみジェスチャを受け付ける */
const AO_COMPACT_KIN_H_SWIPE_EDGE_EXCLUDE_RATIO = 0.18;
/** Raw はドロワーより前（トークン表示を優先） */
const AO_Z_RAW_BACKDROP = 2_147_483_643;
const AO_Z_RAW_PANEL = 2_147_483_644;

/**
 * 狭ビューのみ：レイヤーは「数値が大きいほど手前」。
 * ヘッダ → 邦主・僚友 → メイン（大会盟・入力等）→ チャット の順で奥になるよう統一する。
 */
const AO_Z_COMPACT_HEADER = 40;
const AO_Z_COMPACT_KIN_DRAWER_HOST = 30;
const AO_Z_COMPACT_MAP_STACK = 25;
const AO_Z_COMPACT_MAIN = 20;
const AO_Z_COMPACT_CHAT = 10;

/** ハイドレーション時はサーバと同じ false を強制し、クライアント初回コミット後に実ビューポートへ同期する */
function subscribeAoViewportCompact(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const mq = window.matchMedia(`(max-width: ${AO_MOBILE_MAX_CSS_PX}px)`);
    const legacyMq = mq as MediaQueryList & {
      addListener?: (listener: (ev: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (ev: MediaQueryListEvent) => void) => void;
    };
    const handler = () => onStoreChange();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    if (typeof legacyMq.addListener === "function" && typeof legacyMq.removeListener === "function") {
      legacyMq.addListener(handler);
      return () => legacyMq.removeListener?.(handler);
    }
  } catch {
    window.addEventListener("resize", onStoreChange);
    return () => window.removeEventListener("resize", onStoreChange);
  }
  return () => {};
}

function getAoViewportCompactSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia(`(max-width: ${AO_MOBILE_MAX_CSS_PX}px)`).matches;
  } catch {
    return window.innerWidth <= AO_MOBILE_MAX_CSS_PX;
  }
}

function getAoViewportCompactServerSnapshot(): boolean {
  return false;
}

function aoKinDrawerSwipeTargetDisallowsEdgeSwipe(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("button,a,input,textarea,select,label,[role='button'],[contenteditable='true']"),
  );
}

function aoKinTouchStartXInCenterSwipeBand(clientX: number, vw: number): boolean {
  const edge = vw * AO_COMPACT_KIN_H_SWIPE_EDGE_EXCLUDE_RATIO;
  return clientX >= edge && clientX <= vw - edge;
}

function aoKinCenterSwipeOpensDrawer(dx: number, dy: number): boolean {
  const minAbs = AO_COMPACT_KIN_HORIZONTAL_SWIPE_MIN_DX;
  if (Math.abs(dx) < minAbs) return false;
  if (Math.abs(dx) < Math.abs(dy) * AO_COMPACT_KIN_HORIZONTAL_DOMINANCE_RATIO) return false;
  return dx > 0;
}

function aoKinCenterSwipeClosesDrawer(dx: number, dy: number): boolean {
  const minAbs = AO_COMPACT_KIN_HORIZONTAL_SWIPE_MIN_DX;
  if (Math.abs(dx) < minAbs) return false;
  if (Math.abs(dx) < Math.abs(dy) * AO_COMPACT_KIN_HORIZONTAL_DOMINANCE_RATIO) return false;
  return dx < 0;
}

/** ヘッダ＋ Frame.png 帯の下端 Y（viewport）。これより下が「ヘッダ下のメイン領域」。 */
function aoKinCompactKinSwipeContentTopPx(
  headerEl: HTMLElement | null,
  frameStripEl: HTMLElement | null,
): number {
  const hb = headerEl?.getBoundingClientRect().bottom ?? 0;
  const fb = frameStripEl?.getBoundingClientRect().bottom ?? 0;
  return Math.max(hb, fb);
}

/** ジュチ列ごと吹き出し上端より上へ（items-start + 列の負 marginTop） */
const JUCHI_PORTRAIT_RAISE_ABOVE_BUBBLE_PX = 15;
/** Tailwind `gap-0.5` の px 換算（テーマ既定 0.125rem≒2px） */
const AO_TAILWIND_GAP_05_PX = 2;
/** ジュチ顔枠の実高（aspect 4/5・幅 NOKOR_PORTRAIT_W_PX） */
const JUCHI_PORTRAIT_BOX_H_PX = Math.ceil((NOKOR_PORTRAIT_W_PX * 5) / 4);
/** 「ジュチ」行 text-[10px] leading-tight（1.25） */
const JUCHI_LINE_NAME_H_PX = Math.ceil(10 * 1.25);
/**
 * 邦主＋ルビ行の見かけ高さ（ブラウザ ruby で微差が出る場合はこの値のみ調整）
 */
const JUCHI_LINE_RUBY_CAPTION_H_PX = 24;
/** 送信ラッパー pt-0.5 + ≫ ボタン */
const JUCHI_SEND_ROW_H_PX = AO_TAILWIND_GAP_05_PX + JUCHI_SEND_BTN_MIN_H_PX;
/** ジュチ列 flex-col gap-0.5 が子4つで挟む回数 */
const JUCHI_COL_GAP_SUM_PX = AO_TAILWIND_GAP_05_PX * 3;
/** ジュチ列の縦寸（顔上端〜送信ボタン下端）。吹き出し下端と揃える基準 */
const JUCHI_COLUMN_CONTENT_H_PX =
  JUCHI_PORTRAIT_BOX_H_PX +
  JUCHI_LINE_NAME_H_PX +
  JUCHI_LINE_RUBY_CAPTION_H_PX +
  JUCHI_SEND_ROW_H_PX +
  JUCHI_COL_GAP_SUM_PX;
/**
 * 吹き出し・令旨列の高さ：上端は現状どおり、下端＝送信下端 ⇔ H_juchi − 顔グラ上げ分
 */
const MAIN_SPEECH_BUBBLE_H_PX = JUCHI_COLUMN_CONTENT_H_PX - JUCHI_PORTRAIT_RAISE_ABOVE_BUBBLE_PX;

/** 僚友セル選択時インセット（枠線は aoNokorCellClasses 側で常時固定・ここは影のみ） */
const AO_PUSH_INSET_NOKOR_ACTIVE =
  "shadow-[inset_0_2px_8px_rgba(0,0,0,0.42),inset_0_1px_3px_rgba(0,0,0,0.32)]";

/** 巷間論〜遠交論の選択時：影を強く（②）—僚友セル用（論タブは下の小型を使用） */
const AO_PUSH_INSET_RON_OTHER_CLASS =
  "border border-transparent shadow-[inset_0_14px_34px_rgba(0,0,0,0.78),inset_0_5px_14px_rgba(0,0,0,0.55)]";

/** 論タブ・大会盟選択時（影のみ・枠は aoRonTabClasses で常時固定） */
const AO_PUSH_INSET_RON_TAB_KURULTAI =
  "shadow-[inset_0_2px_4px_rgba(0,0,0,0.42),inset_0_1px_2px_rgba(0,0,0,0.32)]";
/** 論タブ・巷間論等選択時 */
const AO_PUSH_INSET_RON_TAB_OTHER =
  "shadow-[inset_0_3px_6px_rgba(0,0,0,0.52),inset_0_1px_3px_rgba(0,0,0,0.38)]";

const AVATAR_SRC: Record<string, string> = {
  ジュチ: "/personas/juci.png",
  耶律楚材: "/personas/yeruchusai.png",
  ソルコクタニ: "/personas/sorqaqtani.png",
  フナン: "/personas/AO_Char_Hunan.png",
  モンケウール: "/personas/AO_Char_Mongkeur.png",
  ケテ: "/personas/AO_Char_Qete.png",
  バイジュ: "/personas/AO_Char_Baiju.png",
  "クドゥカ・ベキ": "/personas/AO_Char_QudukaBeki.png",
  "タタ・トゥンガ": "/personas/AO_Char_TataTunga.png",
  "チン・テムール": "/personas/AO_Char_ChinTemur.png",
  コルグズ: "/personas/AO_Char_Qorguz.png",
  不明: "/personas/AO_Char_Hunan.png",
};

/** チャット欄アバター下の表示名（書庫 claude/chatgpt/gemini と四千戸長） */
function aiAvatarCaptionLabel(thread: Thread | null, m: Msg): string {
  if (m.side === "user") return "ジュチ";
  const pid = thread?.projectId;
  if (pid === "claude" || pid === "chatgpt") return "耶律楚材";
  if (pid === "gemini") return "ソルコクタニ";
  return m.speaker;
}

/**
 * 考え中プレースホルダー用：論の主担当を表示する。
 * （直近 AI の speaker は JSONL 失敗時に「不明」になりうるため参照しない）
 * 殿下の直近ユーザー発言に僚友名があれば名指しを最優先。
 */
function aoThinkingAiCaptionLabel(thread: Thread | null): string {
  const pid = thread?.projectId as ProjectId | undefined;
  if (pid === "claude" || pid === "chatgpt") return "耶律楚材";
  if (pid === "gemini") return "ソルコクタニ";

  const msgs = visibleMessages(thread?.messages ?? []);
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.side === "user") {
      const designated = detectNamedSpeaker(m.text ?? "");
      if (designated) return designated;
      break;
    }
  }

  if (!pid) return getPrimarySpeakerForProject("debate");
  return getPrimarySpeakerForProject(pid);
}

let storageWarned = false;

function visibleMessages(messages: Msg[]) {
  return messages.filter((m) => !m.hiddenFromUi);
}

/** 同一 AI speaker の連続メッセージを1行に相当する1件へ（履歴の多重吹き出し救済。タイプ中は未適用） */
function mergeConsecutiveAiSameSpeaker(messages: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (const m of messages) {
    if (m.side !== "ai") {
      out.push(m);
      continue;
    }
    const prev = out[out.length - 1];
    if (prev?.side === "ai" && prev.speaker === m.speaker) {
      const a = (prev.text ?? "").trimEnd();
      const b = (m.text ?? "").trim();
      const joined = [a, b].filter((x) => x.length > 0).join("\n\n");
      out[out.length - 1] = {
        ...prev,
        text: joined,
        rawPrompts: prev.rawPrompts ?? m.rawPrompts,
        usage: prev.usage ?? m.usage,
      };
    } else {
      out.push(m);
    }
  }
  return out;
}

/** チャット行描画用。タイプライター中はマージしない（行と typingId の対応を保つ） */
function chatTimelineRowsForRender(messages: Msg[], typingBusy: boolean): Msg[] {
  const v = visibleMessages(messages);
  if (typingBusy) return v;
  return mergeConsecutiveAiSameSpeaker(v);
}

function msgTextForUi(thread: Thread | null, m: Msg) {
  if (m.side === "user") return m.text;
  return displayTextForClaudeImportedAssistant(thread?.sourceProvider ?? null, "assistant", m.text);
}

function formatDate(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateDay(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 年代記／令旨リスト：`threads.source_provider` のウルス表示名 */
function threadSourceProviderUlusLabel(sourceProvider: string | undefined): string {
  const v = sourceProvider?.trim().toLowerCase() ?? "";
  if (v === "gemini") return "チャガタイ";
  if (v === "chatgpt") return "オゴデイ";
  if (v === "claude") return "ジュチ";
  return "";
}

/** クライアントのみ呼ぶこと（SSR では localStorage が無く、初期 HTML と不一致になり Hydration が崩れる） */
function loadState(): AppState {
  if (typeof window === "undefined") return makeDefaultAppState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultAppState();
    return parseAppStateJson(raw) ?? makeDefaultAppState();
  } catch {
    return makeDefaultAppState();
  }
}

/** キャプション本体の上にカタカナ（明朝系で統一、⑦） */
function AoRubyGold({
  main,
  rt,
  mainClassName = "font-serif text-[#DBB961]",
  rtClassName = "font-serif text-[8px] text-[#DBB961]/80",
}: {
  main: string;
  rt: string;
  mainClassName?: string;
  rtClassName?: string;
}) {
  return (
    <ruby className={`inline-ruby ${mainClassName}`}>
      {main}
      <rt className={rtClassName}>{rt}</rt>
    </ruby>
  );
}

/** 論タブの余白・字サイズ（Tailwind だけだと globals の詳細度で負けることがあるため style と併用） */
function aoRonTabInlineStyle(_tpId: TopicUiId, _on: boolean): CSSProperties {
  return {
    fontSize: AO_RON_TAB_FONT_PX,
    paddingLeft: AO_RON_TAB_PAD_X_PX,
    paddingRight: AO_RON_TAB_PAD_X_PX,
    paddingTop: AO_RON_TAB_PAD_Y_PX,
    paddingBottom: AO_RON_TAB_PAD_Y_PX,
  };
}

function aoRonTabInlineStyleOverlay(_tpId: TopicUiId, _on: boolean): CSSProperties {
  return {
    fontSize: AO_RON_TAB_FONT_PX,
    paddingLeft: AO_RON_TAB_PAD_X_OVERLAY_PX,
    paddingRight: AO_RON_TAB_PAD_X_OVERLAY_PX,
    paddingTop: AO_RON_TAB_PAD_Y_OVERLAY_PX,
    paddingBottom: AO_RON_TAB_PAD_Y_OVERLAY_PX,
  };
}

/** 論タブラベル：選択中のみ僚友同様右下へオフセット（同一論を再クリックで解除） */
function aoRonTabLabelOffsetClass(on: boolean): string {
  return `inline-block transition-none ${on ? "translate-x-px translate-y-px" : "translate-x-0 translate-y-0"}`;
}

/** 論タブ：透明1px枠は常時固定／選択時は小型インセット＋ラベル translate（寸法は aoRonTabInlineStyle） */
function aoRonTabClasses(tpId: TopicUiId, on: boolean) {
  const core = "rounded-none font-semibold font-serif box-border transition-none border border-transparent";
  if (tpId === "kurultai") {
    return `${core} bg-[#DBB961] text-[#133D5C] ${on ? AO_PUSH_INSET_RON_TAB_KURULTAI : ""}`;
  }
  if (on) return `${core} bg-transparent text-[#DBB961] ${AO_PUSH_INSET_RON_TAB_OTHER}`;
  return `${core} bg-transparent text-[#DBB961]`;
}

/** 僚友セル：透明1px枠は常時固定。選択中は内側を右下へオフセット（列は items-start で顔グラ上端を揃える） */
function aoNokorCellClasses(active: boolean) {
  const base =
    "rounded-none box-border flex w-full flex-col transition-none bg-transparent font-serif border border-transparent";
  if (active) return `${base} ${AO_PUSH_INSET_NOKOR_ACTIVE}`;
  return `${base}`;
}

/** 僚友帯（旧メイン部下から切り出し→右カラム or モバイルではセンターカラム直下） */
function AoNokorStripArea({
  activeNames,
  nameplateFontSizePx = 8,
  textBandMaxPx,
}: {
  activeNames: ReadonlySet<string>;
  /** 狭ビュードロワーのみ 7 など。既定 8 は PC 左列と同じ */
  nameplateFontSizePx?: number;
  /** モバイルドロワー：顔グラ右・名前直下の説明の最大幅（7文字 tight 名札の外寸と一致）。設定時は行のパディングを邦主行と揃える */
  textBandMaxPx?: number;
}) {
  const drawerStrip = textBandMaxPx != null;
  /** PC：7文字名札相当の説明列幅（パディング50%込み）。ドロワーは従来算出の textBandMaxPx */
  const pcNokorDescBandPx = drawerStrip
    ? undefined
    : aoP5NameplateSmTightPlateOuterWidthPx({
        bandWidthPx: NOKOR_PORTRAIT_W_PX,
        nameplateFontSizePx,
        layoutCharCount: 7,
        tightPadXPx: AO_PC_NOKOR_TIGHT_PAD_X_PX,
      });
  /** PC：僚友セル周りの余白を約50％に（ドロワーは可操作幅優先で据え置き） */
  const rowPad = drawerStrip ? 3 : 1;
  const rowGap = drawerStrip ? 8 : 1;

  const rowInner = (p: (typeof NOKOR)[number], active: boolean) => (
    <div
      className={aoNokorCellClasses(active)}
      style={{
        width: "fit-content",
        maxWidth: drawerStrip ? "100%" : undefined,
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      <div
        className={`flex w-fit min-w-0 items-start transition-none ${active ? "translate-x-px translate-y-px" : "translate-x-0 translate-y-0"}`}
        style={{
          padding: rowPad,
          gap: rowGap,
          ...(drawerStrip ? { maxWidth: "100%" } : {}),
        }}
      >
        <div className="shrink-0">
          <AoP5FaceFrameMid
            src={p.src}
            alt={p.name}
            width={NOKOR_PORTRAIT_W_PX}
            height={Math.ceil((NOKOR_PORTRAIT_W_PX * 5) / 4)}
          />
        </div>
        <div
          className="min-w-0 shrink-0 pt-0"
          style={
            drawerStrip
              ? { width: textBandMaxPx, maxWidth: textBandMaxPx }
              : {
                  width: pcNokorDescBandPx,
                  maxWidth: pcNokorDescBandPx,
                  marginLeft: 2,
                  marginRight: -2,
                }
          }
        >
          <div className="mb-[2px] flex justify-center">
            <AoP5NameplateSmFrame
              width={NOKOR_PORTRAIT_W_PX}
              text={p.name}
              maxChars={7}
              variant="tight"
              fontSizePx={nameplateFontSizePx}
              tightPadXPx={drawerStrip ? undefined : AO_PC_NOKOR_TIGHT_PAD_X_PX}
            />
          </div>
          <div
            className={`min-w-0 text-left text-[7px] font-semibold leading-[1.15] text-[#3D1C08] ${
              drawerStrip ? "pl-0" : "pl-[2em]"
            }`}
          >
            {p.captionPrefix ? <span>{p.captionPrefix}</span> : null}
            <ruby className="font-serif">
              {p.captionRubyBase}
              <rt className="font-serif text-[4px] text-[#6A3F0A]/80">{p.captionRubyRt}</rt>
            </ruby>
          </div>
          <div
            className={`min-w-0 text-left text-[7px] font-semibold leading-[1.1] text-[#3D1C08] mt-[8px] ${
              drawerStrip ? "pl-0" : "pl-[2em]"
            }`}
          >
            {p.line2}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`flex flex-col justify-start overflow-visible pt-0 ${drawerStrip ? "min-w-0 w-full" : "w-fit min-w-0"}`}
      style={{
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      <div className={`${drawerStrip ? "w-full min-w-0" : "w-fit"} ${drawerStrip ? "" : "px-[1px] pb-[1px]"}`}>
        <div className={`flex flex-col gap-[2px] ${drawerStrip ? "min-w-0 w-full" : "w-fit min-w-0"}`}>
          {NOKOR.map((p) => {
            const active = activeNames.has(p.name);
            return (
              <div key={p.name}>
                {rowInner(p, active)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** PC 左列／モバイルドロワー共通：邦主＋僚友（モバイルはポータル側 aside のみ透過し、枠内は羊皮紙） */
function AoLeftKinSideColumn({
  measureRef,
  activeNames,
  nameplateFontSizePx = 8,
  mobileDrawerNokorLayout = false,
}: {
  measureRef?: RefObject<HTMLDivElement | null>;
  activeNames: ReadonlySet<string>;
  /** 狭ビュードロワーのみ 7（PC は既定 8 のまま） */
  nameplateFontSizePx?: number;
  /** 狭ビュー・ポータル内のみ：右カラム幅を 7文字 tight 名札外寸に合わせる */
  mobileDrawerNokorLayout?: boolean;
}) {
  const drawerNokorTextBandPx = mobileDrawerNokorLayout
    ? aoP5NameplateSmTightPlateOuterWidthPx({
        bandWidthPx: NOKOR_PORTRAIT_W_PX,
        nameplateFontSizePx,
        layoutCharCount: 7,
      })
    : undefined;

  const drawerKin = drawerNokorTextBandPx != null;

  const kinColumnInner = (
    <div className="flex max-h-max min-w-0 flex-col items-start gap-[6px]">
          <div className="flex shrink-0 min-w-0 flex-col" style={{ gap: 0 }}>
            <div className="flex h-[32px] w-full min-w-0 items-center justify-center px-1 text-[#3D1C08]" aria-hidden>
              <AoRubyGold
                main="邦　主"
                rt="ウルス・ハン"
                mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
              />
            </div>

            <div className="h-0" aria-hidden />

            <AoOrnamentalFrame
              scale={0.5}
              className={
                drawerNokorTextBandPx != null
                  ? "min-w-0 overflow-visible"
                  : "w-fit max-w-full shrink-0 overflow-visible"
              }
              contentClassName="overflow-visible"
              contentStyle={{ padding: drawerNokorTextBandPx != null ? "6px" : "3px" }}
            >
              <div
                className={`flex min-h-0 flex-col py-0 ao-p5-parchment-surface ${drawerNokorTextBandPx != null ? "w-full" : "w-fit"}`}
              >
                <div
                  className={aoNokorCellClasses(false)}
                  style={{
                    width: "fit-content",
                    maxWidth: drawerNokorTextBandPx != null ? "100%" : undefined,
                    paddingLeft: 0,
                    paddingRight: 0,
                  }}
                >
                  <div
                    className="flex w-fit min-w-0 items-start transition-none translate-x-0 translate-y-0"
                    style={{
                      padding: 3,
                      gap: 8,
                      ...(drawerNokorTextBandPx != null ? { maxWidth: "100%" } : {}),
                    }}
                  >
                    <div className="shrink-0">
                      <AoP5FaceFrameMid
                        src="/personas/juci.png"
                        alt="ジュチ"
                        width={NOKOR_PORTRAIT_W_PX}
                        height={Math.ceil((NOKOR_PORTRAIT_W_PX * 5) / 4)}
                      />
                    </div>
                    <div
                      className={
                        drawerNokorTextBandPx != null
                          ? "min-w-0 w-max shrink-0 pt-0"
                          : "min-w-0 w-max shrink-0 pt-0"
                      }
                      style={
                        drawerNokorTextBandPx != null
                          ? { width: drawerNokorTextBandPx, maxWidth: drawerNokorTextBandPx }
                          : undefined
                      }
                    >
                      <div className="mb-[2px] flex justify-center">
                        <AoP5NameplateSmFrame
                          width={NOKOR_PORTRAIT_W_PX}
                          text="ジュチ"
                          maxChars={7}
                          variant="tight"
                          fontSizePx={nameplateFontSizePx}
                        />
                      </div>
                      <div className="min-w-0 text-left text-[10px] font-semibold leading-[1.15] text-[#3D1C08]">
                        <ruby className="font-serif">
                          邦　主
                          <rt className="font-serif text-[8px] text-[#6A3F0A]/80">ウルス・ハン</rt>
                        </ruby>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AoOrnamentalFrame>
          </div>

          <div className="flex min-w-0 flex-col" style={{ gap: 0 }}>
            <div className="flex h-[32px] w-full min-w-0 items-center justify-center px-1 text-[#3D1C08]" aria-hidden>
              <AoRubyGold
                main="僚　友"
                rt="ノ　コ　ル"
                mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
              />
            </div>

            <div className="h-0" aria-hidden />

            <AoOrnamentalFrame
              scale={0.5}
              className={
                drawerNokorTextBandPx != null
                  ? "min-w-0 overflow-visible"
                  : "w-fit max-w-full shrink-0 overflow-visible"
              }
              contentClassName="overflow-visible"
              contentStyle={{ padding: drawerNokorTextBandPx != null ? "6px" : "3px" }}
            >
              <div className={`ao-p5-parchment-surface ${drawerNokorTextBandPx != null ? "w-full" : "w-fit"}`}>
                <AoNokorStripArea
                  activeNames={activeNames}
                  nameplateFontSizePx={nameplateFontSizePx}
                  textBandMaxPx={drawerNokorTextBandPx}
                />
              </div>
            </AoOrnamentalFrame>
          </div>
        </div>
  );

  return (
    <div ref={measureRef} className="self-start w-max max-w-full">
      {drawerKin ? (
        <AoOrnamentalFrame
          className="relative flex max-h-max min-h-0 w-fit max-w-full min-w-0 flex-col"
          style={{ boxSizing: "border-box", boxShadow: AO_DROP_SHADOW_MAIN_FRAME }}
          contentClassName="flex max-h-max min-w-0 flex-col items-start"
        >
          {kinColumnInner}
        </AoOrnamentalFrame>
      ) : (
        <AoOrnamentalFrame
          className="relative flex max-h-max min-h-0 w-fit max-w-full shrink-0 flex-col"
          style={{
            boxSizing: "border-box",
            boxShadow: AO_DROP_SHADOW_MAIN_FRAME,
            width: "fit-content",
            maxWidth: "100%",
          }}
          contentClassName="flex max-h-max min-w-0 flex-col items-start"
        >
          {kinColumnInner}
        </AoOrnamentalFrame>
      )}
    </div>
  );
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    if (!storageWarned) {
      storageWarned = true;
      console.warn("[ao] localStorage への保存に失敗しました（メモリ上の state は保持）。", e);
    }
  }
}

export default function Home() {
  const viewportCompact = useSyncExternalStore(
    subscribeAoViewportCompact,
    getAoViewportCompactSnapshot,
    getAoViewportCompactServerSnapshot,
  );
  /** SSR と初回クライアント描画を一致させるため既定のみ。復元はマウント後の effect で行う */
  const [state, setState] = useState<AppState>(() => makeDefaultAppState());
  /** localStorage 復元より先に既定 state で saveState が走ると上書き事故になるため 1 回スキップ */
  const persistReadyRef = useRef(false);
  /** 初期議事が兵馬論（work）に合わせる */
  const [selectedTopic, setSelectedTopic] = useState<TopicUiId | null>("heiba");
  /** 年代記オーバーレイから議事を開いたあとはメイン入力をロックする（投稿メニュー等で解除） */
  const [composeLocked, setComposeLocked] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 設定ページ内サブ（帯タブと AoSettingsOverlay を同期） */
  const [settingsEmbeddedSubpage, setSettingsEmbeddedSubpage] = useState<AoSettingsSubpage>("global");
  const [usageOpen, setUsageOpen] = useState(false);
  /** 新規／過去ログ一覧を、令旨・年代記と同じメイン帯オーバーレイ内に表示 */
  const [ronListOverlayOpen, setRonListOverlayOpen] = useState(false);
  const [contextChecks, setContextChecks] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingDotsPhase, setThinkingDotsPhase] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [rawPromptOverlay, setRawPromptOverlay] = useState<null | {
    variant: "ai" | "user";
    usage: MsgTurnUsage;
    completionMeta?: MsgChatCompletionMeta;
    rawPrompts?: MsgRawPromptBundle;
    top: number;
    left: number;
    /** スマホ・ユーザー Raw の固定矩形（未指定時は従来の max 幅・max 高さ） */
    panelWidthPx?: number;
    panelHeightPx?: number;
  }>(null);
  /** 狭ビューポート：邦主・僚友ドロワー */
  const [leftKinDrawerOpen, setLeftKinDrawerOpen] = useState(false);
  /** `.ao-mobile-stack-scale` の zoom 外へ描画する（fixed が壊れるのを避ける） */
  const [kinDrawerPortalReady, setKinDrawerPortalReady] = useState(false);

  const lastSavedRef = useRef(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const chatAutoStickToBottomRef = useRef(true);
  const chatScrollRafRef = useRef<number | null>(null);
  const leftColumnMeasureRef = useRef<HTMLDivElement | null>(null);
  const [leftColumnPx, setLeftColumnPx] = useState<number | null>(null);
  const ronListMeasureRef = useRef<HTMLDivElement | null>(null);
  const [ronListPx, setRonListPx] = useState<number | null>(null);
  /** 論列の横幅（「大 会 盟」実測＋枠内余白・他論ラベルとの最大） */
  const [ronColWidthPx, setRonColWidthPx] = useState<number | null>(null);
  const kuriltaiLabelMeterRef = useRef<HTMLDivElement | null>(null);
  const ronTopicLabelsProbeRef = useRef<HTMLDivElement | null>(null);
  /** 議事タイトル羊皮紙セルの実測高（右上・右下アイコン行と共通） */
  const [gijiTitleChipHPx, setGijiTitleChipHPx] = useState<number | null>(null);
  const titleChipParchmentRef = useRef<HTMLDivElement | null>(null);
  /** 狭ビュー：入力吹き出しラッパー高（論列下端に合わせる） */
  const [composeTextareaHPx, setComposeTextareaHPx] = useState<number | null>(null);
  const compactTextareaWrapRef = useRef<HTMLDivElement | null>(null);
  const mapBgHostRef = useRef<HTMLDivElement | null>(null);
  const [mapBgTileCount, setMapBgTileCount] = useState(1);
  const [viewportH, setViewportH] = useState<number>(0);
  const currentThreadIdRef = useRef<string | null>(null);
  const selectedTopicRef = useRef<TopicUiId | null>(selectedTopic);
  const composeLockedRef = useRef(composeLocked);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** ヘッダ＋Frame 帯下端までの px（ドロワーをその下から縦スライドさせる） */
  const compactKinHeaderMeasureRef = useRef<HTMLElement | null>(null);
  const compactKinFrameStripMeasureRef = useRef<HTMLDivElement | null>(null);
  const [kinDrawerAnchorBottomPx, setKinDrawerAnchorBottomPx] = useState(96);
  /** body ではなくページ内に載せ、ヘッダ z-10 より確実に奥に描画する */
  const [compactKinPortalHost, setCompactKinPortalHost] = useState<HTMLDivElement | null>(null);
  const [threadListAfterChatNonce, setThreadListAfterChatNonce] = useState(0);
  const settingsOverlayRef = useRef<AoSettingsOverlayHandle>(null);
  const [settingsSavePending, setSettingsSavePending] = useState(false);
  /** 議事オーバーレイ内テーブルのページ（0 始まり） */
  const [agendaPageIndex, setAgendaPageIndex] = useState(0);
  /** 令旨／年代記オーバーレイ内一覧のページ（0 始まり） */
  const [overlayListPageIndex, setOverlayListPageIndex] = useState(0);

  const fetchThreadListWithTopic = useCallback(
    async (bust: boolean, topic: TopicUiId | null, signal?: AbortSignal) => {
      const pids = projectIdsForTopic(topic);
      if (!pids?.length) return;
      try {
        const q = new URLSearchParams({ projects: pids.join(","), limit: "5", offset: "0" });
        if (bust) q.set("bust", "1");
        const r = await fetch(`/api/threads/list?${q}`, { signal });
        if (!r.ok) return;
        const data = (await r.json()) as { threads?: DbThreadRow[]; error?: string };
        if (data.error) {
          console.error("[ao] /api/threads/list:", data.error);
          return;
        }
        if (!Array.isArray(data.threads)) return;
        setState((prev) => mergeThreadSummariesIntoState(prev, data.threads ?? [], pids));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[ao] thread list fetch", e);
      }
    },
    [],
  );

  useEffect(() => {
    if (!settingsOpen) setSettingsEmbeddedSubpage("global");
  }, [settingsOpen]);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (!persistReadyRef.current) {
      persistReadyRef.current = true;
      return;
    }
    const t = Date.now();
    if (t - lastSavedRef.current < 400) return;
    lastSavedRef.current = t;
    saveState(state);
  }, [state]);

  const currentThread = useMemo(() => {
    return state.threads.find((t) => t.id === state.currentThreadId) ?? null;
  }, [state]);

  /** 年代記など：Supabase 同期済みメタのみで messages が空のとき、遅延取得 */
  useEffect(() => {
    const th = currentThread;
    if (!th?.supabaseThreadId || th.ephemeral || th.messages.length > 0 || th.serverMessagesLoaded === true) {
      return;
    }
    const sid = th.supabaseThreadId;
    const clientId = th.id;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/threads/${encodeURIComponent(sid)}/messages`);
        if (cancelled) return;
        if (!r.ok) {
          setState((p) => ({
            ...p,
            threads: p.threads.map((t) => {
              if (t.id !== clientId) return t;
              if (t.messages.length > 0) return { ...t, serverMessagesLoaded: true };
              return { ...t, messages: [], serverMessagesLoaded: true };
            }),
          }));
          return;
        }
        const data = (await r.json()) as { messages?: Msg[] };
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        if (cancelled) return;
        setState((p) => ({
          ...p,
          threads: p.threads.map((t) => {
            if (t.id !== clientId) return t;
            if (t.messages.length > 0) return { ...t, serverMessagesLoaded: true };
            return { ...t, messages: msgs, serverMessagesLoaded: true };
          }),
        }));
      } catch {
        if (!cancelled) {
          setState((p) => ({
            ...p,
            threads: p.threads.map((t) => {
              if (t.id !== clientId) return t;
              if (t.messages.length > 0) return { ...t, serverMessagesLoaded: true };
              return { ...t, messages: [], serverMessagesLoaded: true };
            }),
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentThread?.id,
    currentThread?.supabaseThreadId,
    currentThread?.messages.length,
    currentThread?.ephemeral,
    currentThread?.serverMessagesLoaded,
  ]);
  const topicProjectIds = useMemo(() => projectIdsForTopic(selectedTopic), [selectedTopic]);

  const activeNokorNames = useMemo(() => activeNokorNamesForTopic(selectedTopic), [selectedTopic]);

  const topicThreads = useMemo(() => {
    if (!topicProjectIds?.length) return [];
    const allow = new Set(topicProjectIds);
    return state.threads
      .filter((t) => {
        if (!allow.has(t.projectId)) return false;
        /** 巷間論（talk）は Supabase 一覧が無いため、送信前の ephemeral 空スレも議事表に出す */
        if (t.projectId === "talk") return true;
        return !t.ephemeral;
      })
      .sort(compareThreadsForGiList);
  }, [state, topicProjectIds]);

  /** メイン右列：選択論の議事一覧（新規／過去ログテーブル用。ソート後は aoThreadsForPostMenu の上限まで） */
  const ronSidebarThreads = useMemo(() => {
    if (!selectedTopic) return [];
    return aoThreadsForPostMenu(state.threads, selectedTopic);
  }, [state.threads, selectedTopic]);

  const agendaMaxPageIndex = useMemo(() => {
    const n = ronSidebarThreads.length;
    return Math.max(0, Math.ceil(n / AGENDA_PAGE_SIZE) - 1);
  }, [ronSidebarThreads]);

  const agendaRowsSlice = useMemo(() => {
    const start = agendaPageIndex * AGENDA_PAGE_SIZE;
    return ronSidebarThreads.slice(start, start + AGENDA_PAGE_SIZE);
  }, [ronSidebarThreads, agendaPageIndex]);

  useEffect(() => {
    setAgendaPageIndex(0);
  }, [selectedTopic]);

  useEffect(() => {
    setAgendaPageIndex((i) => Math.min(i, agendaMaxPageIndex));
  }, [agendaMaxPageIndex]);

  /** メッセージ追記・タイプライター・応答待ちのたびに末尾スクロール用シグネチャ */
  const chatScrollSignature = useMemo(() => {
    if (!currentThread) return "";
    const msgs = visibleMessages(currentThread.messages);
    const tail = msgs.map((m) => `${m.id}:${m.text.length}`).join(";");
    return `${currentThread.id}:${tail}:${isThinking ? "1" : "0"}:${typingId ?? ""}`;
  }, [currentThread, isThinking, typingId]);

  function scrollChatPaneToBottom() {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    if (chatAutoStickToBottomRef.current) scrollChatPaneToBottom();
  }, [chatScrollSignature]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pane = messagesRef.current;
      if (pane && chatAutoStickToBottomRef.current) pane.scrollTop = pane.scrollHeight;
    });
    ro.observe(el);
    const onWinResize = () => scrollChatPaneToBottom();
    window.addEventListener("resize", onWinResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWinResize);
    };
  }, []);

  useEffect(() => {
    if (viewportCompact) return;
    const el = leftColumnMeasureRef.current;
    if (!el) return;
    // getBoundingClientRect は「見えている高さ」になり得るため、内容高（scrollHeight）を優先する
    const sync = () => setLeftColumnPx(el.scrollHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [viewportCompact]);

  useEffect(() => {
    const el = ronListMeasureRef.current;
    if (!el) return;
    const sync = () =>
      setRonListPx(Math.max(1, el.offsetHeight || Math.ceil(el.getBoundingClientRect().height)));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [viewportCompact, selectedTopic]);

  useEffect(() => {
    const sync = () => setViewportH(typeof window !== "undefined" ? window.innerHeight : 0);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!isThinking) {
      setThinkingDotsPhase(0);
      return;
    }
    const id = window.setInterval(() => setThinkingDotsPhase((p) => (p + 1) % AO_THINKING_DOT_CYCLE.length), 520);
    return () => clearInterval(id);
  }, [isThinking]);

  useEffect(() => {
    if (!isThinking) return;
    const el = messagesRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [isThinking]);

  useEffect(() => {
    if (!rawPromptOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRawPromptOverlay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rawPromptOverlay]);

  useEffect(() => {
    if (!leftKinDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLeftKinDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leftKinDrawerOpen]);

  useEffect(() => {
    setKinDrawerPortalReady(true);
  }, []);

  useEffect(() => {
    if (!viewportCompact) {
      return;
    }
    const hdr = compactKinHeaderMeasureRef.current;
    const frm = compactKinFrameStripMeasureRef.current;
    const sync = () => {
      const hb = hdr?.getBoundingClientRect().bottom ?? 0;
      const fb = frm?.getBoundingClientRect().bottom ?? 0;
      const bottom = Math.max(hb, fb);
      if (bottom > 0) {
        setKinDrawerAnchorBottomPx(Math.round(bottom));
      }
    };
    sync();
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(sync);
    if (hdr) ro.observe(hdr);
    if (frm) ro.observe(frm);
    return () => {
      window.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, [viewportCompact]);

  useEffect(() => {
    if (!viewportCompact) return;
    if (
      contextOpen ||
      chronicleOpen ||
      settingsOpen ||
      usageOpen ||
      ronListOverlayOpen ||
      rawPromptOverlay
    ) {
      setLeftKinDrawerOpen(false);
    }
  }, [
    viewportCompact,
    contextOpen,
    chronicleOpen,
    settingsOpen,
    usageOpen,
    ronListOverlayOpen,
    rawPromptOverlay,
  ]);

  useEffect(() => {
    const host = mapBgHostRef.current;
    if (!host) return;

    const TILE_H = 1024; // map-bg1.png の高さ（現状採用画像）
    // kinDrawerAnchorBottomPx を依存に含め、ヘッダ計測確定後にも再実行する（初期フレームのタイル不足防止）
    const recompute = () => {
      // 下端の白抜けは「見えている高さ」を参照してタイル枚数が足りないのが原因。
      const winH =
        typeof window !== "undefined"
          ? Math.max(window.innerHeight, document.documentElement?.clientHeight ?? 0)
          : viewportH;
      const topCompact = viewportCompact
        ? aoKinCompactKinSwipeContentTopPx(compactKinHeaderMeasureRef.current, compactKinFrameStripMeasureRef.current)
        : 0;
      const viewportMainH = viewportCompact
        ? Math.max(0, winH - (topCompact > 0 ? topCompact : AO_PC_HEADER_FRAME_BELOW_H_PX))
        : Math.max(0, viewportH - AO_PC_HEADER_FRAME_BELOW_H_PX);
      let rectH = 0;
      try {
        rectH = host.getBoundingClientRect().height;
      } catch {
        /* ignore */
      }
      const h = Math.max(leftColumnPx ?? 0, viewportMainH, rectH, host.scrollHeight, host.clientHeight);
      if (!h) return;
      const slack = viewportCompact ? 5 : 2;
      setMapBgTileCount(Math.max(1, Math.ceil(h / TILE_H) + slack));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(host);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [leftColumnPx, viewportH, viewportCompact, kinDrawerAnchorBottomPx]);

  useEffect(() => {
    currentThreadIdRef.current = state.currentThreadId ?? null;
  }, [state.currentThreadId]);

  useEffect(() => {
    selectedTopicRef.current = selectedTopic;
  }, [selectedTopic]);

  useEffect(() => {
    const ac = new AbortController();
    void fetchThreadListWithTopic(false, selectedTopic, ac.signal);
    return () => ac.abort();
  }, [selectedTopic, fetchThreadListWithTopic]);

  useEffect(() => {
    const ac = new AbortController();
    void fetchThreadListWithTopic(true, selectedTopicRef.current, ac.signal);
    return () => ac.abort();
  }, [state.currentThreadId, threadListAfterChatNonce, fetchThreadListWithTopic]);

  useEffect(() => {
    composeLockedRef.current = composeLocked;
  }, [composeLocked]);

  function scheduleFocusMainPrompt() {
    if (composeLockedRef.current) return;
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        promptTextareaRef.current?.focus({ preventScroll: true });
      });
    });
  }

  function setCurrentThread(threadId: string) {
    setState((prev) => {
      const pruned = pruneEphemeralEmptyThreads(prev);
      const th = pruned.threads.find((t) => t.id === threadId);
      if (!th) return pruned;
      return { ...pruned, currentThreadId: th.id, currentProjectId: th.projectId };
    });
  }

  useEffect(() => {
    if (!titleEditing) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [titleEditing]);

  useEffect(() => {
    if (titleEditing) return;
    setTitleDraft(currentThread?.title ?? "");
  }, [currentThread?.id, currentThread?.title, titleEditing]);

  function closeMainSubOverlaysExceptRon() {
    setContextOpen(false);
    setChronicleOpen(false);
    setSettingsOpen(false);
    setUsageOpen(false);
  }

  function onMainRonTabClick(topicId: TopicUiId) {
    const inChronicleOrReijitsu = Boolean(chronicleOpen || contextOpen);

    if (!inChronicleOrReijitsu) {
      setComposeLocked(false);
    }

    const prevSel = selectedTopicRef.current;
    if (prevSel === topicId) {
      if (inChronicleOrReijitsu) {
        return;
      }
      setRonListOverlayOpen((o) => {
        if (!o) closeMainSubOverlaysExceptRon();
        return !o;
      });
      return;
    }

    if (inChronicleOrReijitsu) {
      setSelectedTopic(topicId);
      setState((prev) => pruneEphemeralEmptyThreads(prev));
      return;
    }

    closeMainSubOverlaysExceptRon();
    setSelectedTopic(topicId);
    setRonListOverlayOpen(true);
    setState((prev) => pruneEphemeralEmptyThreads(prev));
  }

  async function sendUserMessage() {
    const text = draft.trim();
    if (!text || !currentThread || isThinking || isTyping || composeLocked) return;
    setDraft("");
    const idx = state.threads.findIndex((t) => t.id === state.currentThreadId);
    if (idx < 0) return;
    const userMsg: Msg = { id: aoUid("m"), side: "user", speaker: "ジュチ", text, createdAt: Date.now() };
    const th = state.threads[idx];
    const snippet = aoTitleSnippetFromFirstUserPost(text);
    const resolvedTitle = aoClampStoredThreadTitle(th.title.trim() || snippet || "議事");
    const { ephemeral: _dropEphemeral, ...thPersist } = th;
    const nextThread: Thread = {
      ...thPersist,
      title: th.title.trim() ? aoClampStoredThreadTitle(th.title.trim()) : resolvedTitle,
      messages: [...th.messages, userMsg],
      updatedAt: Date.now(),
    };
    const arr = [...state.threads];
    arr[idx] = nextThread;
    setState({ ...state, threads: arr });
    setIsThinking(true);
    try {
      const history: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const m of visibleMessages(nextThread.messages)) {
        if (m.side === "user") {
          history.push({ role: "user", content: m.text });
          continue;
        }
        // B: 表示用のメタ文言は次回リクエスト履歴に混ぜない
        if (isSyntheticAssistantNoiseForHistory(m.text)) continue;
        history.push({ role: "assistant", content: m.text });
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: nextThread.projectId,
          messages: history,
          clientThreadId: nextThread.id,
          threadTitle: resolvedTitle,
          supabaseThreadId: nextThread.supabaseThreadId ?? null,
        }),
      });
      const data = (await res.json()) as {
        chunks?: Array<{ speaker: string; text: string }>;
        supabaseThreadId?: string;
        usage?: MsgTurnUsage;
        completionMeta?: unknown;
        rawPrompts?: MsgRawPromptBundle;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.chunks) {
        const parts = [data.detail, data.error].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        throw new Error(parts.join(" — ").trim() || "chat error");
      }
      if (data.supabaseThreadId) {
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const aa = [...prev.threads];
          aa[ti] = { ...aa[ti], supabaseThreadId: data.supabaseThreadId };
          return { ...prev, threads: aa };
        });
      }
      setIsThinking(false);
      setIsTyping(true);
      const batchAiIds: string[] = [];
      const turnRaw = normalizeRawPromptsFromApi(data.rawPrompts);
      const turnCompletionMeta = normalizeCompletionMetaFromApi(data.completionMeta);
      for (const c of data.chunks) {
        const msgId = aoUid("m");
        batchAiIds.push(msgId);
        const shell: Msg = {
          id: msgId,
          side: "ai",
          speaker: c.speaker || "不明",
          text: "",
          createdAt: Date.now(),
          rawPrompts: turnRaw,
        };
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const nt = { ...prev.threads[ti], messages: [...prev.threads[ti].messages, shell], updatedAt: Date.now() };
          const aa = [...prev.threads];
          aa[ti] = nt;
          return { ...prev, threads: aa };
        });
        setTypingId(msgId);
        await runTypewriter(c.text || "", (visible) => {
          if (currentThreadIdRef.current !== nextThread.id) return;
          setState((prev) => {
            const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
            if (ti < 0) return prev;
            const mi = prev.threads[ti].messages.findIndex((m) => m.id === msgId);
            if (mi < 0) return prev;
            const msgs = [...prev.threads[ti].messages];
            msgs[mi] = { ...msgs[mi], text: visible };
            const aa = [...prev.threads];
            aa[ti] = { ...aa[ti], messages: msgs, updatedAt: Date.now() };
            return { ...prev, threads: aa };
          });
        });
      }
      const turnUsage = normalizeChatUsageFromApi(data.usage);
      if ((turnUsage && batchAiIds.length > 0) || turnRaw || turnUsage || turnCompletionMeta) {
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const msgs = [...prev.threads[ti].messages];
          const ui = msgs.findIndex((x) => x.id === userMsg.id);
          if (ui >= 0 && (turnRaw || turnUsage || turnCompletionMeta)) {
            msgs[ui] = {
              ...msgs[ui],
              ...(turnRaw ? { rawPrompts: turnRaw } : {}),
              ...(turnUsage ? { usage: turnUsage } : {}),
              ...(turnCompletionMeta ? { completionMeta: turnCompletionMeta } : {}),
            };
          }
          if (turnUsage && batchAiIds.length > 0) {
            for (const id of batchAiIds) {
              const mi = msgs.findIndex((x) => x.id === id);
              if (mi >= 0)
                msgs[mi] = {
                  ...msgs[mi],
                  usage: turnUsage,
                  ...(turnCompletionMeta ? { completionMeta: turnCompletionMeta } : {}),
                };
            }
          }
          const aa = [...prev.threads];
          aa[ti] = { ...aa[ti], messages: msgs, updatedAt: Date.now() };
          return { ...prev, threads: aa };
        });
      }
      setThreadListAfterChatNonce((n) => n + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setTypingId(null);
      setIsThinking(false);
      setIsTyping(false);
      scheduleFocusMainPrompt();
    }
  }

  const overlayMode = contextOpen ? "context" : chronicleOpen ? "chronicle" : null;
  const isContextMode = overlayMode === "context";
  const anyMainOverlay = Boolean(overlayMode) || settingsOpen || usageOpen || ronListOverlayOpen;
  const showRonAgendaPanel = Boolean(ronListOverlayOpen && !overlayMode && !settingsOpen && !usageOpen);

  const overlayThreadsMaxPageIndex = useMemo(() => {
    if (!overlayMode) return 0;
    const n = topicThreads.length;
    return Math.max(0, Math.ceil(n / AGENDA_PAGE_SIZE) - 1);
  }, [overlayMode, topicThreads]);

  const overlayThreadsSlice = useMemo(() => {
    if (!overlayMode) return [];
    const start = overlayListPageIndex * AGENDA_PAGE_SIZE;
    return topicThreads.slice(start, start + AGENDA_PAGE_SIZE);
  }, [overlayMode, topicThreads, overlayListPageIndex]);

  useEffect(() => {
    if (!overlayMode) return;
    setOverlayListPageIndex(0);
  }, [overlayMode, selectedTopic]);

  useEffect(() => {
    if (!overlayMode) return;
    setOverlayListPageIndex((i) => Math.min(i, overlayThreadsMaxPageIndex));
  }, [overlayMode, overlayThreadsMaxPageIndex]);

  useEffect(() => {
    if (overlayMode || settingsOpen || usageOpen) setRonListOverlayOpen(false);
  }, [overlayMode, settingsOpen, usageOpen]);

  /** スマホのヘッダ帯ジェスチャを無効にする（オーバーレイ・議事メニュー・Raw 時は誤操作防止） */
  const blockCompactKinHeaderSwipe = anyMainOverlay || Boolean(rawPromptOverlay);

  /**
   * ヘッダ下かつ画面中央帯の横スワイプのみ（document capture）。
   * 閉→開：右スワイプ／開→閉：左スワイプ（開始がボタン等のときは開く操作のみ無視）。
   */
  useEffect(() => {
    if (!viewportCompact || !kinDrawerPortalReady || blockCompactKinHeaderSwipe) return;

    let start: { x: number; y: number; disallowed: boolean } | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const vw = typeof window !== "undefined" ? window.innerWidth : 0;
      if (!vw || !aoKinTouchStartXInCenterSwipeBand(t.clientX, vw)) return;
      const top = aoKinCompactKinSwipeContentTopPx(compactKinHeaderMeasureRef.current, compactKinFrameStripMeasureRef.current);
      if (top <= 0 || t.clientY <= top) return;
      start = {
        x: t.clientX,
        y: t.clientY,
        disallowed: aoKinDrawerSwipeTargetDisallowsEdgeSwipe(e.target),
      };
    };

    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) {
        start = null;
        return;
      }
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const disallowed = start.disallowed;
      start = null;

      if (!leftKinDrawerOpen) {
        if (!disallowed && aoKinCenterSwipeOpensDrawer(dx, dy)) setLeftKinDrawerOpen(true);
        return;
      }

      if (aoKinCenterSwipeClosesDrawer(dx, dy)) setLeftKinDrawerOpen(false);
    };

    const onCancel = () => {
      start = null;
    };

    document.addEventListener("touchstart", onStart, { passive: true, capture: true });
    document.addEventListener("touchend", onEnd, { passive: true, capture: true });
    document.addEventListener("touchcancel", onCancel, { passive: true, capture: true });
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchend", onEnd, true);
      document.removeEventListener("touchcancel", onCancel, true);
    };
  }, [viewportCompact, kinDrawerPortalReady, leftKinDrawerOpen, blockCompactKinHeaderSwipe]);

  const mainColumnWidthStyle: CSSProperties = viewportCompact
    ? { width: "100%", maxWidth: "100%", boxSizing: "border-box" }
    : { width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" };

  const mainTopFixedH = viewportCompact ? MAIN_TOP_FIXED_H_COMPACT_PX : MAIN_TOP_FIXED_H_PX;
  /** 議事チップ内（使用量・設定・令旨・年代記） */
  const compactGijiChipIconPx = viewportCompact ? 10 : 14;
  const compactReishiBtnMinH = viewportCompact
    ? Math.max(28, Math.round(REISHI_CHRONICLE_BTN_MIN_H_PX * 0.82))
    : REISHI_CHRONICLE_BTN_MIN_H_PX;
  const compactSpeechBubbleH = viewportCompact
    ? Math.round(MAIN_SPEECH_BUBBLE_H_PX * 0.88)
    : MAIN_SPEECH_BUBBLE_H_PX;
  const compactRonTabTopicFs = viewportCompact ? 10 : Math.round(12 * AO_PC_ZOOM_COMP_SCALE);
  const compactGijiTitleFs = viewportCompact ? Math.max(9, AO_GIJI_TITLE_FONT_PX - 3) : AO_GIJI_TITLE_FONT_PX;
  const compactMainTextareaFs = viewportCompact ? 10 : 13;
  const compactOrnamentalPadMid = viewportCompact ? "4px" : "6px";
  const compactOrnamentalPadTight = viewportCompact ? "2px" : "3px";
  /** 左・論タブ枠：装飾の内側パディングを詰め、flex 継承で縦伸びしないよう別値 */
  const ronListFrameInsetPx = viewportCompact ? 6 : 7;
  /** 羊皮紙ブロック内の追加余白（テキスト〜内縁） */
  const ronListParchmentPadStr = viewportCompact ? "2px 3px" : "3px 4px";
  const compactRonTitleChipH = viewportCompact ? 26 : 32;
  const compactExecuteIcoSize = viewportCompact
    ? Math.max(14, Math.round(Math.max(16, Math.round(JUCHI_SEND_BTN_MIN_H_PX * 1.25)) * 0.78))
    : Math.max(16, Math.round(JUCHI_SEND_BTN_MIN_H_PX * 1.25));
  /** 令旨／年代記／設定／使用量サブページ帯の縦（論リストの実測に合わせる） */
  const ronSubpageBandPx = Math.max(28, Math.round(ronListPx ?? (viewportCompact ? 96 : 140)));

  const chatRowGap = Math.max(
    2,
    Math.round((viewportCompact ? 6 : MAIN_BUBBLE_ROW_GAP_PX) * 0.3),
  );
  /** 履歴吹き出しは列 flex で親幅いっぱいまで広げる（実効幅は顔グラ列＋ gap で決まる） */
  const chatBubbleMaxWidth: CSSProperties["maxWidth"] = "100%";

  useLayoutEffect(() => {
    const labelEl = kuriltaiLabelMeterRef.current;
    const probe = ronTopicLabelsProbeRef.current;
    if (!labelEl) return;
    const parchmentPadX = viewportCompact ? 6 : 8;
    const syncRonW = () => {
      const lw = Math.ceil(labelEl.getBoundingClientRect().width);
      let maxOther = 0;
      if (probe) {
        probe.querySelectorAll("[data-ao-ron-probe-label]").forEach((node) => {
          if (node instanceof HTMLElement) maxOther = Math.max(maxOther, Math.ceil(node.getBoundingClientRect().width));
        });
      }
      const inner = Math.max(lw, maxOther);
      const chrome = 2 * ronListFrameInsetPx + parchmentPadX + 8;
      setRonColWidthPx(Math.max(viewportCompact ? 62 : 72, inner + chrome));
    };
    syncRonW();
    const ro = new ResizeObserver(syncRonW);
    ro.observe(labelEl);
    if (probe) ro.observe(probe);
    window.addEventListener("resize", syncRonW);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncRonW);
    };
  }, [viewportCompact, compactRonTabTopicFs, ronListFrameInsetPx]);

  useLayoutEffect(() => {
    const el = titleChipParchmentRef.current;
    if (!el) return;
    const sync = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      setGijiTitleChipHPx(Math.max(viewportCompact ? 18 : 20, h));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [viewportCompact, titleEditing, currentThread?.title, selectedTopic, compactGijiTitleFs]);

  useLayoutEffect(() => {
    const ron = ronListMeasureRef.current;
    const wrap = compactTextareaWrapRef.current;
    if (!ron || !wrap) return;
    const minH = viewportCompact ? compactSpeechBubbleH : MAIN_SPEECH_BUBBLE_H_PX;
    const sync = () => {
      const rb = ron.getBoundingClientRect();
      const wt = wrap.getBoundingClientRect();
      const h = Math.round(rb.bottom - wt.top);
      setComposeTextareaHPx(Math.max(minH, h));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(ron);
    ro.observe(wrap);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [
    viewportCompact,
    compactSpeechBubbleH,
    gijiTitleChipHPx,
    ronColWidthPx,
    titleEditing,
    ronListPx,
    anyMainOverlay,
  ]);

  const thinkingDotsText = AO_THINKING_DOT_CYCLE[thinkingDotsPhase];

  function openRawPromptPopover(
    e: ReactMouseEvent<HTMLButtonElement>,
    side: "ai" | "user",
    usage: MsgTurnUsage,
    rawPrompts?: MsgRawPromptBundle,
    anchorMsgId?: string,
    completionMeta?: MsgChatCompletionMeta,
  ) {
    const avatarRect = e.currentTarget.getBoundingClientRect();
    let anchorRect = avatarRect;
    let verticalAnchorRect: DOMRect | undefined;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    const popoverWidth = Math.min(RAW_POPOVER_W, vw - 16);
    const popoverHeight = Math.min(vh * 0.37, 250);

    if (viewportCompact && side === "user" && anchorMsgId && messagesRef.current) {
      const box = aoCompactUserRawPanelRect(messagesRef.current, anchorMsgId);
      if (box) {
        setRawPromptOverlay({
          variant: side,
          usage,
          completionMeta,
          rawPrompts,
          left: box.left,
          top: box.top,
          panelWidthPx: box.width,
          panelHeightPx: box.height,
        });
        return;
      }
    }

    if (viewportCompact) {
      const row = e.currentTarget.closest("[data-ao-chat-row]");
      const bubbleEl = row?.querySelector("[data-ao-chat-bubble]");
      if (bubbleEl instanceof HTMLElement) {
        const br = bubbleEl.getBoundingClientRect();
        anchorRect = br;
        verticalAnchorRect = br;
      }
    }
    const { left, top } = placeRawPromptPopover({
      anchorRect,
      verticalAnchorRect,
      compactAvatarRect: viewportCompact ? avatarRect : undefined,
      side,
      popoverWidth,
      popoverHeight,
      compactAlignBubbleMid: viewportCompact && verticalAnchorRect == null,
      bubbleMinHeightPx:
        viewportCompact && verticalAnchorRect == null ? CHAT_HISTORY_BUBBLE_MIN_H_PX : undefined,
    });
    setRawPromptOverlay({ variant: side, usage, completionMeta, rawPrompts, left, top });
  }

  const hydrateRawFromServerIfNeeded = useCallback(
    async (e: ReactMouseEvent<HTMLButtonElement>, side: "ai" | "user", m: Msg) => {
      let rawPrompts = m.rawPrompts;
      let usage = m.usage ?? aoSyntheticMsgTurnUsage();
      let completionMeta = m.completionMeta;
      const th = state.threads.find((t) => t.id === state.currentThreadId);
      const sid = th?.supabaseThreadId;
      if (!rawPrompts && sid && !th?.ephemeral) {
        try {
          const r = await fetch(`/api/threads/${encodeURIComponent(sid)}/messages?raw=1`);
          if (r.ok) {
            const data = (await r.json()) as { messages?: Msg[] };
            const list = Array.isArray(data.messages) ? data.messages : [];
            const found = list.find((x) => x.id === m.id);
            if (found?.rawPrompts) rawPrompts = found.rawPrompts;
            if (found?.usage) usage = found.usage;
            if (found?.completionMeta) completionMeta = found.completionMeta;
            setState((p) => {
              const ti = p.threads.findIndex((t) => t.id === p.currentThreadId);
              if (ti < 0) return p;
              const merged = mergeMsgsHydrateFromServer(p.threads[ti]!.messages, list);
              const aa = [...p.threads];
              aa[ti] = { ...aa[ti]!, messages: merged };
              return { ...p, threads: aa };
            });
          }
        } catch {
          /* Raw 未取得でもオーバーレイは開く */
        }
      }
      openRawPromptPopover(e, side, usage, rawPrompts, m.id, completionMeta);
    },
    [state.threads, state.currentThreadId],
  );

  /** zoom 対象のルートの外に描画しないと fixed が潰れ中身が空／端だけ見える */
  const kinDrawerPortalEl =
    viewportCompact && kinDrawerPortalReady && compactKinPortalHost ? (
      createPortal(
        <>
          <div
            role="presentation"
            className={`absolute inset-0 z-[1] bg-black/40 transition-opacity duration-200 ${
              leftKinDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!leftKinDrawerOpen}
            onClick={() => setLeftKinDrawerOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal={leftKinDrawerOpen}
            aria-hidden={!leftKinDrawerOpen}
            aria-label="邦主と僚友"
            className={`absolute left-0 top-0 z-[2] flex min-h-0 w-[min(92vw,400px)] flex-col overflow-hidden border-0 bg-transparent shadow-none will-change-transform ${
              leftKinDrawerOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
            style={{
              bottom: 0,
              paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))",
              transform: leftKinDrawerOpen ? "translate3d(0,0,0)" : "translate3d(-100%,0,0)",
              transition: "transform 280ms cubic-bezier(0.33, 1, 0.68, 1)",
            }}
          >
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <AoLeftKinSideColumn
                mobileDrawerNokorLayout
                nameplateFontSizePx={7}
                activeNames={activeNokorNames}
              />
            </div>
          </aside>
        </>,
        compactKinPortalHost,
      )
    ) : null;

  return (
    <div
      className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-white text-[var(--ao-white)] ao-mobile-stack-scale"
    >

      <header
        ref={compactKinHeaderMeasureRef}
        className={`ao-header-safe-x relative shrink-0 ${
          viewportCompact
            ? "flex min-h-[44px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 py-1.5"
            : "z-10 grid h-[58px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4"
        }`}
        style={{
          background: AO_P5_PARCHMENT,
          ...(viewportCompact ? { zIndex: AO_Z_COMPACT_HEADER } : {}),
        }}
      >
        {/* 左: 消費銀バー */}
        <div
          className={`flex min-w-0 items-center gap-2 ${viewportCompact ? "order-2 flex-[1_1_100%] justify-center" : "justify-self-start"}`}
        >
          <span className="shrink-0 text-[10px] text-[#6A3F0A]">消費銀</span>
          <div
            className={`h-[7px] rounded border border-[#C9922A]/40 bg-[#F5EDD6] ${viewportCompact ? "min-w-[72px] max-w-[160px] flex-1" : "min-w-[120px] max-w-[220px] flex-1"}`}
          >
            <div className="h-full w-[72%] rounded bg-[#C9922A]" />
          </div>
        </div>
        {/* 中: ロゴ 3 種。360〜767 で min-[360]:block と md:hidden が競合しうるため、16 Pro は block + max-[359]:hidden + md:hidden で表す */}
        <div className={`flex justify-center ${viewportCompact ? "order-1" : "justify-self-center"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phase5/logo-se1.png"
            alt="Altan Orda"
            className="hidden max-[359px]:block h-[22px] w-auto max-w-[78vw] sm:h-[26px] md:hidden"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phase5/logo-16pro.png"
            alt="Altan Orda"
            className="block max-[359px]:hidden h-[22px] w-auto max-w-[78vw] sm:h-[26px] md:hidden"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phase5/logo-pc.png"
            alt="Altan Orda"
            className="hidden h-[22px] w-auto max-w-[78vw] sm:h-[26px] md:block md:h-[34px]"
            draggable={false}
          />
        </div>
        {/* 右: 焼き印スタイルアイコンボタン */}
        <div className={`flex items-center gap-2 ${viewportCompact ? "hidden" : "justify-self-end"}`}>
          <a className="ao-seal-btn-p5 inline-flex items-center justify-center" aria-label="ログイン" href="/api/ao-login">
            <IcoLogin size={15} />
          </a>
          <form action="/api/ao-logout" method="post" className="inline-flex" suppressHydrationWarning>
            <button type="submit" className="ao-seal-btn-p5" aria-label="ログアウト">
              <IcoLogout size={15} />
            </button>
          </form>
        </div>
      </header>

      {/* ヘッダ直下: Frame.png を横方向タイル（狭ビューではヘッダ帯ジェスチャのヒット領域に含めるためタッチ可能に） */}
      <div
        ref={compactKinFrameStripMeasureRef}
        className={`relative h-[14px] w-full shrink-0 overflow-hidden ${viewportCompact ? "" : "pointer-events-none z-10"}`}
        style={viewportCompact ? { zIndex: AO_Z_COMPACT_HEADER } : undefined}
        aria-hidden
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "url('/phase5/Frame.png')",
            backgroundRepeat: "repeat-x",
            backgroundSize: "44px 14px",
          }}
        />
      </div>

      {/* 邦主・僚友ポータル（ヘッダより z が低く、メイン map/chat より手前） */}
      {viewportCompact ? (
        <div
          ref={setCompactKinPortalHost}
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{ top: kinDrawerAnchorBottomPx, zIndex: AO_Z_COMPACT_KIN_DRAWER_HOST }}
        />
      ) : null}

      {/* 左カラムが画面高を超えてもOK（外枠が内容高で伸びる） */}
      <div
        ref={mapBgHostRef}
        className={
          viewportCompact
            ? "relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            : "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden"
        }
        style={{
          ...(viewportCompact ? { zIndex: AO_Z_COMPACT_MAP_STACK } : {}),
        }}
      >
        {/* ①-2 ヘッダより下全体: 白地 + 地図 */}
        <div className="pointer-events-none absolute inset-0 bg-white" aria-hidden />
        {/* モバイルでは高さ指定なしの absolute ラッパーだと子が全て absolute で高さ 0 になり地図が消える。常に親いっぱいに敷く */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: mapBgTileCount }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 w-full opacity-60"
              style={{
                top: i * 1024,
                height: 1024,
                backgroundImage: "url('/phase5/map-bg1.png')",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center top",
                backgroundSize: "1536px 1024px",
                transform: i % 2 === 1 ? "scaleY(-1)" : undefined,
                transformOrigin: "50% 50%",
              }}
            />
          ))}
        </div>

        {/* ②-1 左僚友 1 : 中央メイン＋チャット 3 : 右空白 2 */}
        <div
          className={`relative flex min-h-0 ${viewportCompact ? "z-0 min-h-0 flex-1 flex-col overflow-hidden" : "z-10 min-h-0 flex-1 flex-col overflow-hidden"}`}
        >
          <div
            className={`min-h-0 box-border flex flex-col ${
              viewportCompact
                ? "h-full min-h-0 w-full max-w-full flex-1 px-1"
                : "mx-auto flex h-full min-h-0 w-[1200px] max-w-[1200px] flex-1 flex-col"
            }`}
            style={{ paddingTop: MAIN_OUTER_TOP_GAP_PX }}
          >
            <div
              className={`w-full min-h-0 ${
                viewportCompact
                  ? "flex min-h-0 flex-1 flex-col gap-3"
                  : "flex min-h-0 flex-1 flex-row items-stretch gap-3 overflow-x-auto overflow-y-visible"
              }`}
            >
            {/* 左カラム：メイン部と同等の角／枠で囲う（狭ビューポートではスワイプドロワーでも表示） */}
            {!viewportCompact ? (
              <div className="min-h-0 shrink-0 overflow-y-auto overflow-x-visible">
                <AoLeftKinSideColumn measureRef={leftColumnMeasureRef} activeNames={activeNokorNames} />
              </div>
            ) : null}
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              style={{
                gap: MAIN_COLUMN_STACK_GAP_PX,
                minWidth: 0,
                ...(viewportCompact ? {} : { flex: "3 1 0%" }),
              }}
            >
            <AoOrnamentalFrame
              className="relative flex min-h-0 w-full max-w-full shrink-0 flex-col min-w-0"
              style={{
                ...mainColumnWidthStyle,
                boxShadow: AO_DROP_SHADOW_MAIN_FRAME,
                ...(viewportCompact ? { zIndex: AO_Z_COMPACT_MAIN, maxHeight: mainTopFixedH } : {}),
              }}
              contentClassName="flex shrink-0 flex-col min-w-0"
            >
            <main
              className={`ao-p5-parchment-surface relative box-border flex min-h-0 w-full shrink-0 flex-col min-w-0 ${viewportCompact ? "min-h-0 shrink-0 overflow-x-hidden overflow-y-auto" : "overflow-visible"}`}
              style={{
                /* メイン部：固定高だと余りが空白として残るため、基本は内容高に追従させる */
                paddingLeft: `${MAIN_COLUMN_GUTTER_X_PX}px`,
                paddingRight: `${MAIN_COLUMN_GUTTER_X_PX}px`,
                paddingBottom: "0px",
                paddingTop: `${viewportCompact ? Math.max(0, Math.round(MAIN_INNER_TOP_PAD_PX * 0.45)) : MAIN_INNER_TOP_PAD_PX}px`,
              }}
            >
              <section
                className={`relative flex min-h-0 min-w-0 flex-col overflow-y-auto ${
                  viewportCompact ? "shrink-0 overflow-x-hidden" : "min-w-0 flex-1 overflow-x-hidden"
                }`}
              >
          <div className={`relative z-10 flex min-h-0 flex-col ${viewportCompact ? "" : "flex-1"}`}>
          {/* ③ 論（縦）：左列 */}
          <div
            className="flex min-h-0 flex-1 flex-col px-0"
            style={{
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            <div className="flex min-h-0 flex-1 min-w-0 flex-row items-stretch" style={{ gap: 6 }}>
              {/* 左：論リスト（行方向ストレッチから外し、枠は内容高のみにする） */}
              <div
                ref={ronListMeasureRef}
                className="isolate flex shrink-0 grow-0 basis-auto flex-col self-start overflow-visible"
                style={{
                  width: ronColWidthPx ?? (viewportCompact ? 62 : 72),
                  alignSelf: "flex-start",
                }}
              >
                {/* 論タブ全景（大会盟〜遠交論）：1 枠・項目間は詰め、親 flex-1 の縦継承で伸びない */}
                <AoOrnamentalFrame
                  scale={0.5}
                  rootDisplay="inline-flex"
                  contentInsetPx={ronListFrameInsetPx}
                  className="max-h-max w-full shrink-0 overflow-visible align-top"
                  contentClassName="flex max-h-max shrink-0 flex-col justify-start gap-0 overflow-visible"
                  contentStyle={{ padding: ronListParchmentPadStr }}
                >
                  <div className="ao-p5-parchment-surface flex max-h-max w-full flex-col justify-start divide-y divide-solid divide-[#3D1C08]/[0.14] px-0 py-0">
                    {AO_TOPICS.map((tp) => {
                      const on = selectedTopic === tp.id;
                      const isKuriltai = tp.id === "kurultai";
                      const pressed = on
                        ? "translate-x-px translate-y-px shadow-[inset_0_2px_8px_rgba(0,0,0,0.18)]"
                        : "hover:bg-black/5";
                      if (isKuriltai) {
                        return (
                          <button
                            key={tp.id}
                            type="button"
                            onClick={() => onMainRonTabClick(tp.id)}
                            aria-pressed={on}
                            className={`flex ${viewportCompact ? "min-h-[26px]" : "min-h-[30px]"} w-full items-center justify-center rounded-none border-0 bg-transparent px-0.5 py-0 text-[#3D1C08] transition-none ${pressed}`}
                          >
                            <div
                              ref={kuriltaiLabelMeterRef}
                              className="inline-flex max-w-none shrink-0 whitespace-nowrap"
                            >
                              <AoRubyGold
                                main="大 会 盟"
                                rt="クリルタイ"
                                mainClassName={
                                  viewportCompact
                                    ? "text-[11px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                                    : "text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                                }
                                rtClassName={
                                  viewportCompact
                                    ? "text-[7px] font-serif text-[#6A3F0A]/80"
                                    : "text-[9px] font-serif text-[#6A3F0A]/80"
                                }
                              />
                            </div>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={tp.id}
                          type="button"
                          onClick={() => onMainRonTabClick(tp.id)}
                          aria-pressed={on}
                          className={`min-h-0 w-full rounded-none border-0 bg-transparent px-1 py-[2px] text-center font-semibold leading-[1.2] text-[#3D1C08] transition-none ${pressed}`}
                          style={{ fontSize: compactRonTabTopicFs }}
                        >
                          {tp.label}
                        </button>
                      );
                    })}
                  </div>
                </AoOrnamentalFrame>
              </div>

              {/* 右：タイトル＋吹き出し（既存の中段をここで続ける） */}
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col self-stretch">
                {!anyMainOverlay ? (
                <>
                {/* タイトル行（右上：年代記／使用量／設定）＋吹き出し（右にユーザー） */}
                <div
                  className={`mt-0 flex min-h-0 min-w-0 flex-col ${viewportCompact ? "min-h-0 shrink-0 overflow-x-hidden overflow-y-visible" : "flex-1 overflow-visible"}`}
                  style={{
                    paddingTop: 0,
                    gap: viewportCompact ? 4 : 6,
                    paddingBottom: 0,
                    ...(!viewportCompact && ronListPx ? { height: `${Math.round(ronListPx)}px` } : null),
                  }}
                >
                  {viewportCompact ? (
                    <div
                      className="grid w-full min-w-0"
                      style={{
                        gridTemplateColumns: `minmax(0, 1fr) ${CHAT_AVATAR_COL_W_PX}px`,
                        columnGap: chatRowGap,
                        rowGap: 4,
                      }}
                    >
                      <div className="min-w-0">
                      <AoOrnamentalFrame
                        scale={0.5}
                        contentInsetPx={GIJI_CHIP_ORNAMENT_INSET_PX}
                        className="w-full max-w-full overflow-visible"
                        contentClassName="overflow-visible"
                        contentStyle={{ padding: GIJI_CHIP_ORNAMENT_CONTENT_PAD }}
                      >
                        <div
                          ref={titleChipParchmentRef}
                          className="ao-p5-parchment-surface box-border flex w-full min-h-0 items-center justify-center px-0"
                          style={{
                            minHeight: 0,
                            height: "auto",
                            paddingTop: GIJI_TITLE_PARCHMENT_PAD_Y_PX,
                            paddingBottom: GIJI_TITLE_PARCHMENT_PAD_Y_PX,
                          }}
                        >
                          {titleEditing ? (
                            <input
                              ref={titleInputRef}
                              value={titleDraft}
                              onChange={(e) => {
                                setTitleDraft(aoClampTitleDraftInput(e.target.value));
                              }}
                              onBlur={() => {
                                setTitleEditing(false);
                                if (!currentThread) return;
                                if (!isAoNativeThread(currentThread)) {
                                  setTitleDraft(currentThread.title);
                                  return;
                                }
                                const trimmed = aoClampStoredThreadTitle(titleDraft);
                                setState((prev) => {
                                  const ti = prev.threads.findIndex((t) => t.id === currentThread.id);
                                  if (ti < 0) return prev;
                                  const arr = [...prev.threads];
                                  arr[ti] = { ...arr[ti], title: trimmed };
                                  return { ...prev, threads: arr };
                                });
                              }}
                              style={{ fontSize: compactGijiTitleFs }}
                              className="min-h-0 w-full min-w-0 rounded-none border-0 bg-transparent px-2 py-0 text-center font-serif font-semibold leading-tight text-[#3D1C08] outline-none ring-0 placeholder:text-[#3D1C08]/45 focus:ring-0"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setTitleDraft(currentThread?.title ?? "");
                                setTitleEditing(true);
                              }}
                              style={{ fontSize: compactGijiTitleFs }}
                              className="flex min-h-0 w-full min-w-0 items-center justify-center rounded-none border-0 bg-transparent px-2 py-0 text-center font-serif font-semibold leading-tight text-[#3D1C08]"
                            >
                              『{aoThreadTitleChipLabel(currentThread)}』
                            </button>
                          )}
                        </div>
                      </AoOrnamentalFrame>
                      </div>
                      <div
                        className="flex min-w-0 shrink-0 flex-col justify-center"
                        style={{ minHeight: gijiTitleChipHPx ?? compactRonTitleChipH }}
                      >
                        <div className="flex w-full items-center justify-center gap-0.5">
                          <button
                            type="button"
                            className={AO_MAIN_HEADER_ICON_BTN_CLASS}
                            aria-label="年代記"
                            onClick={() => {
                              setRonListOverlayOpen(false);
                              setChronicleOpen(true);
                              setContextOpen(false);
                              setUsageOpen(false);
                              setSettingsOpen(false);
                            }}
                          >
                            <span className="ao-p5-kurultai-ink-icon">
                              <IcoBook size={compactGijiChipIconPx} />
                            </span>
                          </button>
                          <button
                            type="button"
                            className={AO_MAIN_HEADER_ICON_BTN_CLASS}
                            aria-label="AI API 使用量を表示"
                            onClick={() => {
                              setRonListOverlayOpen(false);
                              setChronicleOpen(false);
                              setContextOpen(false);
                              setSettingsOpen(false);
                              setUsageOpen(true);
                            }}
                          >
                            <span className="ao-p5-kurultai-ink-icon">
                              <IcoCoinBag size={compactGijiChipIconPx} />
                            </span>
                          </button>
                          <button
                            type="button"
                            className={AO_MAIN_HEADER_ICON_BTN_CLASS}
                            aria-label="設定を開く"
                            onClick={() => {
                              setRonListOverlayOpen(false);
                              setContextOpen(false);
                              setChronicleOpen(false);
                              setUsageOpen(false);
                              setSettingsOpen(true);
                            }}
                          >
                            <span className="ao-p5-kurultai-ink-icon">
                              <IcoGear size={compactGijiChipIconPx} />
                            </span>
                          </button>
                        </div>
                      </div>
                      <div className="isolate flex min-h-0 min-w-0 flex-col overflow-visible pr-0">
                      <div
                        ref={compactTextareaWrapRef}
                        className="mr-0 min-h-0 min-w-0 w-full"
                        style={{
                          flex: composeTextareaHPx != null ? "0 0 auto" : "1 1 0%",
                          height: composeTextareaHPx ?? undefined,
                          minHeight: compactSpeechBubbleH,
                        }}
                      >
                        <AoP5NineSliceBubble
                          variant="user"
                          frameScale={0.5}
                          fillHeight
                          className="block h-full min-h-0 w-full overflow-hidden"
                          contentPadX={8}
                          contentPadY={6}
                          style={{
                            filter: "none",
                            minHeight: viewportCompact ? compactSpeechBubbleH : undefined,
                          }}
                        >
                          <textarea
                            ref={promptTextareaRef}
                            suppressHydrationWarning
                            value={draft}
                            readOnly={composeLocked}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (composeLocked) return;
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === "Enter" && e.metaKey) {
                                e.preventDefault();
                                void sendUserMessage();
                              }
                            }}
                            placeholder={composeLocked ? "過去ログ（年代記）表示中は入力できません" : undefined}
                            className={`box-border min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-none border-0 bg-transparent font-serif text-[#1a1208] outline-none ring-0 focus:ring-0 ${composeLocked ? "cursor-not-allowed opacity-60" : ""}`}
                            style={{ padding: "0px", fontSize: compactMainTextareaFs }}
                          />
                        </AoP5NineSliceBubble>
                      </div>
                    </div>

                    <div
                      className="relative z-20 box-border flex shrink-0 flex-col items-center gap-0 font-serif"
                      style={{
                        width: CHAT_AVATAR_COL_W_PX,
                        minHeight: viewportCompact ? compactSpeechBubbleH : MAIN_SPEECH_BUBBLE_H_PX,
                        marginTop: 0,
                      }}
                    >
                      <AoP5FaceFrameMid
                        src="/personas/juci.png"
                        alt="ジュチ"
                        width={NOKOR_PORTRAIT_W_PX}
                        height={JUCHI_PORTRAIT_BOX_H_PX}
                      />
                      <AoP5NameplateSmFrame width={NOKOR_PORTRAIT_W_PX} text="ジュチ" maxChars={7} variant="tight" fontSizePx={7} />
                      <div className="w-full text-center leading-tight">
                        <AoRubyGold
                          main="邦　主"
                          rt="ウルス・ハン"
                          mainClassName="text-[10px] font-semibold font-serif text-[#3D1C08]"
                          rtClassName="text-[8px] font-serif text-[#6A3F0A]/80"
                        />
                      </div>
                      <div className="relative z-30 flex w-full items-center justify-center gap-1.5 px-0.5 pt-0.5">
                        <button
                          type="button"
                          disabled={composeLocked}
                          onClick={() => void sendUserMessage()}
                          aria-label="送信"
                          className={`${AO_MAIN_SEND_BTN_CLASS} relative z-30 touch-manipulation select-none disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          <span className="ao-p5-kurultai-ink-icon" style={{ color: AO_MAIN_ICON_FG }}>
                            <IcoExecute size={compactExecuteIcoSize} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`relative z-30 shrink-0 cursor-pointer touch-manipulation select-none ${AO_MAIN_ICON_BTN_CLASS}`}
                          aria-label="令旨"
                          onClick={() => {
                            setRonListOverlayOpen(false);
                            setContextOpen(true);
                            setChronicleOpen(false);
                          }}
                        >
                          <span className="ao-p5-kurultai-ink-icon" style={{ color: AO_MAIN_ICON_FG }}>
                            <IcoScroll size={compactGijiChipIconPx} />
                          </span>
                        </button>
                      </div>
                    </div>
                    </div>
                  ) : (
                    <>
                  <div className="mt-0 flex w-full min-w-0 items-stretch justify-between gap-2 text-left">
                    {/* 議事タイトル：枠で囲う */}
                    <div className="min-w-0 flex-1">
                      <AoOrnamentalFrame
                        scale={0.5}
                        contentInsetPx={GIJI_CHIP_ORNAMENT_INSET_PX}
                        className="w-full max-w-full overflow-visible"
                        contentClassName="overflow-visible"
                        contentStyle={{ padding: GIJI_CHIP_ORNAMENT_CONTENT_PAD }}
                      >
                        <div
                          ref={titleChipParchmentRef}
                          className="ao-p5-parchment-surface box-border flex w-full min-h-0 items-center justify-center px-0"
                          style={{
                            minHeight: 0,
                            height: "auto",
                            paddingTop: GIJI_TITLE_PARCHMENT_PAD_Y_PX,
                            paddingBottom: GIJI_TITLE_PARCHMENT_PAD_Y_PX,
                          }}
                        >
                          {titleEditing ? (
                            <input
                              ref={titleInputRef}
                              value={titleDraft}
                              onChange={(e) => {
                                setTitleDraft(aoClampTitleDraftInput(e.target.value));
                              }}
                              onBlur={() => {
                                setTitleEditing(false);
                                if (!currentThread) return;
                                if (!isAoNativeThread(currentThread)) {
                                  setTitleDraft(currentThread.title);
                                  return;
                                }
                                const trimmed = aoClampStoredThreadTitle(titleDraft);
                                setState((prev) => {
                                  const ti = prev.threads.findIndex((t) => t.id === currentThread.id);
                                  if (ti < 0) return prev;
                                  const arr = [...prev.threads];
                                  arr[ti] = { ...arr[ti], title: trimmed };
                                  return { ...prev, threads: arr };
                                });
                              }}
                              style={{ fontSize: compactGijiTitleFs }}
                              className="min-h-0 w-full min-w-0 rounded-none border-0 bg-transparent px-2 py-0 text-center font-serif font-semibold leading-tight text-[#3D1C08] outline-none ring-0 placeholder:text-[#3D1C08]/45 focus:ring-0"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setTitleDraft(currentThread?.title ?? "");
                                setTitleEditing(true);
                              }}
                              style={{ fontSize: compactGijiTitleFs }}
                              className="flex min-h-0 w-full min-w-0 items-center justify-center rounded-none border-0 bg-transparent px-2 py-0 text-center font-serif font-semibold leading-tight text-[#3D1C08]"
                            >
                              『{aoThreadTitleChipLabel(currentThread)}』
                            </button>
                          )}
                        </div>
                      </AoOrnamentalFrame>
                    </div>

                    {/* 議事帯右上：年代記・使用量・設定（装飾枠なし） */}
                    <div className="flex shrink-0 flex-col justify-center self-stretch" style={{ minHeight: gijiTitleChipHPx ?? compactRonTitleChipH }}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          className={AO_MAIN_HEADER_ICON_BTN_CLASS}
                          aria-label="年代記"
                          onClick={() => {
                            setRonListOverlayOpen(false);
                            setChronicleOpen(true);
                            setContextOpen(false);
                            setUsageOpen(false);
                            setSettingsOpen(false);
                          }}
                        >
                          <span className="ao-p5-kurultai-ink-icon">
                            <IcoBook size={compactGijiChipIconPx} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className={AO_MAIN_HEADER_ICON_BTN_CLASS}
                          aria-label="AI API 使用量を表示"
                          onClick={() => {
                            setRonListOverlayOpen(false);
                            setChronicleOpen(false);
                            setContextOpen(false);
                            setSettingsOpen(false);
                            setUsageOpen(true);
                          }}
                        >
                          <span className="ao-p5-kurultai-ink-icon">
                            <IcoCoinBag size={compactGijiChipIconPx} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className={AO_MAIN_HEADER_ICON_BTN_CLASS}
                          aria-label="設定を開く"
                          onClick={() => {
                            setRonListOverlayOpen(false);
                            setContextOpen(false);
                            setChronicleOpen(false);
                            setUsageOpen(false);
                            setSettingsOpen(true);
                          }}
                        >
                          <span className="ao-p5-kurultai-ink-icon">
                            <IcoGear size={compactGijiChipIconPx} />
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 items-stretch pb-0" style={{ gap: chatRowGap }}>
                    <div className="isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-visible pr-0">
                      <div
                        ref={compactTextareaWrapRef}
                        className="mr-0 min-h-0 min-w-0 w-full"
                        style={{
                          flex: composeTextareaHPx != null ? "0 0 auto" : "1 1 0%",
                          height: composeTextareaHPx ?? undefined,
                          minHeight: MAIN_SPEECH_BUBBLE_H_PX,
                        }}
                      >
                        <AoP5NineSliceBubble
                          variant="user"
                          frameScale={0.5}
                          fillHeight
                          className="block h-full min-h-0 w-full overflow-hidden"
                          contentPadX={8}
                          contentPadY={6}
                          style={{
                            filter: "none",
                            minHeight: MAIN_SPEECH_BUBBLE_H_PX,
                          }}
                        >
                          <textarea
                            ref={promptTextareaRef}
                            suppressHydrationWarning
                            value={draft}
                            readOnly={composeLocked}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (composeLocked) return;
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === "Enter" && e.metaKey) {
                                e.preventDefault();
                                void sendUserMessage();
                              }
                            }}
                            placeholder={composeLocked ? "過去ログ（年代記）表示中は入力できません" : undefined}
                            className={`box-border min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-none border-0 bg-transparent font-serif text-[#1a1208] outline-none ring-0 focus:ring-0 ${composeLocked ? "cursor-not-allowed opacity-60" : ""}`}
                            style={{ padding: "0px", fontSize: compactMainTextareaFs }}
                          />
                        </AoP5NineSliceBubble>
                      </div>
                    </div>

                    <div
                      className="relative z-20 box-border flex shrink-0 flex-col items-center gap-0 font-serif"
                      style={{
                        width: CHAT_AVATAR_COL_W_PX,
                        minHeight: viewportCompact ? compactSpeechBubbleH : MAIN_SPEECH_BUBBLE_H_PX,
                        marginTop: 0,
                      }}
                    >
                      <AoP5FaceFrameMid
                        src="/personas/juci.png"
                        alt="ジュチ"
                        width={NOKOR_PORTRAIT_W_PX}
                        height={JUCHI_PORTRAIT_BOX_H_PX}
                      />
                      <AoP5NameplateSmFrame width={NOKOR_PORTRAIT_W_PX} text="ジュチ" maxChars={7} variant="tight" fontSizePx={7} />
                      <div className="w-full text-center leading-tight">
                        <AoRubyGold
                          main="邦　主"
                          rt="ウルス・ハン"
                          mainClassName="text-[10px] font-semibold font-serif text-[#3D1C08]"
                          rtClassName="text-[8px] font-serif text-[#6A3F0A]/80"
                        />
                      </div>
                      <div className="relative z-30 flex w-full items-center justify-center gap-1.5 px-0.5 pt-0.5">
                        <button
                          type="button"
                          disabled={composeLocked}
                          onClick={() => void sendUserMessage()}
                          aria-label="送信"
                          className={`${AO_MAIN_SEND_BTN_CLASS} relative z-30 touch-manipulation select-none disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          <span className="ao-p5-kurultai-ink-icon" style={{ color: AO_MAIN_ICON_FG }}>
                            <IcoExecute size={compactExecuteIcoSize} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`relative z-30 shrink-0 cursor-pointer touch-manipulation select-none ${AO_MAIN_ICON_BTN_CLASS}`}
                          aria-label="令旨"
                          onClick={() => {
                            setRonListOverlayOpen(false);
                            setContextOpen(true);
                            setChronicleOpen(false);
                          }}
                        >
                          <span className="ao-p5-kurultai-ink-icon" style={{ color: AO_MAIN_ICON_FG }}>
                            <IcoScroll size={compactGijiChipIconPx} />
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                    </>
                  )}
                </div>
                </>
                ) : (
                <>
                  <div className="shrink-0 w-full" style={{ height: ronSubpageBandPx }} aria-hidden />
                  <div
                    className="pointer-events-auto absolute inset-x-0 top-0 z-[50] box-border flex min-h-0 flex-col overflow-hidden"
                    style={{ height: ronSubpageBandPx }}
                    role="dialog"
                    aria-modal="true"
                    aria-label={
                      showRonAgendaPanel
                        ? "議事一覧"
                        : isContextMode
                          ? "令旨"
                          : overlayMode === "chronicle"
                            ? "年代記"
                            : settingsOpen
                              ? "設定"
                              : "使用量"
                    }
                  >
                    <AoOrnamentalFrame
                      scale={0.5}
                      rootDisplay="flex"
                      contentInsetPx={ronListFrameInsetPx}
                      className="box-border flex h-full min-h-0 w-full flex-col overflow-hidden"
                      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
                      contentStyle={{ padding: ronListParchmentPadStr }}
                    >
                      <div className="ao-p5-parchment-surface flex h-full min-h-0 flex-col gap-0.5 overflow-hidden">
                        {showRonAgendaPanel && selectedTopic ? (
                          <div className="grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-0.5 px-0.5 py-0">
                              <div className="flex min-w-0 justify-start">
                                <button
                                  type="button"
                                  className={AO_SUBPAGE_HDR_NEW_BTN_CLASS}
                                  aria-label="新規議事を作成"
                                  onClick={() => {
                                    const nt = createAoThreadForTopic(selectedTopic);
                                    setComposeLocked(false);
                                    setRonListOverlayOpen(false);
                                    setState((prev) => {
                                      const withoutGhost = prev.threads.filter(
                                        (t) =>
                                          !(t.ephemeral && t.messages.length === 0 && t.projectId === nt.projectId),
                                      );
                                      return {
                                        ...prev,
                                        threads: [nt, ...withoutGhost],
                                        currentThreadId: nt.id,
                                        currentProjectId: nt.projectId,
                                      };
                                    });
                                    setDraft("");
                                    scheduleFocusMainPrompt();
                                  }}
                                >
                                  <IcoRoundedPlus size={14} className="shrink-0" />
                                  新規
                                </button>
                              </div>
                              <div className="flex shrink-0 items-center justify-center gap-px">
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="先頭ページ"
                                  disabled={agendaPageIndex <= 0}
                                  onClick={() => setAgendaPageIndex(0)}
                                >
                                  <IcoAgendaPageFirst size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="前のページ"
                                  disabled={agendaPageIndex <= 0}
                                  onClick={() => setAgendaPageIndex((i) => Math.max(0, i - 1))}
                                >
                                  <IcoAgendaPagePrev size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="次のページ"
                                  disabled={agendaPageIndex >= agendaMaxPageIndex}
                                  onClick={() =>
                                    setAgendaPageIndex((i) => Math.min(agendaMaxPageIndex, i + 1))
                                  }
                                >
                                  <IcoAgendaPageNext size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="末尾ページ"
                                  disabled={agendaPageIndex >= agendaMaxPageIndex}
                                  onClick={() => setAgendaPageIndex(agendaMaxPageIndex)}
                                >
                                  <IcoAgendaPageLast size={16} />
                                </button>
                              </div>
                              <div className="flex min-w-0 justify-end">
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="戻る"
                                  onClick={() => {
                                    setContextOpen(false);
                                    setChronicleOpen(false);
                                    setSettingsOpen(false);
                                    setUsageOpen(false);
                                    setRonListOverlayOpen(false);
                                    scheduleFocusMainPrompt();
                                  }}
                                >
                                  <IcoArrowLeft size={14} className="shrink-0" />
                                </button>
                              </div>
                            </div>
                        ) : (
                        <div className="grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-0.5 px-0.5 py-0">
                          <div className="flex min-w-0 justify-start">
                            {isContextMode ? (
                              <AoRubyGold
                                main="令　旨"
                                rt="ジャルリグ"
                                mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                                rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                              />
                            ) : overlayMode === "chronicle" ? (
                              <AoRubyGold
                                main="年 代 記"
                                rt="トプチヤン"
                                mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                                rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                              />
                            ) : settingsOpen ? (
                              <div className="min-w-0 shrink-0" aria-hidden />
                            ) : (
                              <AoRubyGold
                                main="使　用　量"
                                rt="　"
                                mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                                rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                              />
                            )}
                          </div>
                          <div className="flex min-w-0 w-full shrink-0 items-center justify-center gap-px">
                            {settingsOpen ? (
                              <div className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5 px-0.5">
                                <AoRubyGold
                                  main="設　定"
                                  rt="　"
                                  mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
                                  rtClassName="text-[9px] font-serif text-[#6A3F0A]/80"
                                />
                                <AoSettingsSubpageTabs
                                  active={settingsEmbeddedSubpage}
                                  onChange={setSettingsEmbeddedSubpage}
                                />
                              </div>
                            ) : overlayMode ? (
                              <>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="先頭ページ"
                                  disabled={overlayListPageIndex <= 0}
                                  onClick={() => setOverlayListPageIndex(0)}
                                >
                                  <IcoAgendaPageFirst size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="前のページ"
                                  disabled={overlayListPageIndex <= 0}
                                  onClick={() => setOverlayListPageIndex((i) => Math.max(0, i - 1))}
                                >
                                  <IcoAgendaPagePrev size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="次のページ"
                                  disabled={overlayListPageIndex >= overlayThreadsMaxPageIndex}
                                  onClick={() =>
                                    setOverlayListPageIndex((i) =>
                                      Math.min(overlayThreadsMaxPageIndex, i + 1),
                                    )
                                  }
                                >
                                  <IcoAgendaPageNext size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={AO_AGENDA_NAV_BTN_CLASS}
                                  aria-label="末尾ページ"
                                  disabled={overlayListPageIndex >= overlayThreadsMaxPageIndex}
                                  onClick={() => setOverlayListPageIndex(overlayThreadsMaxPageIndex)}
                                >
                                  <IcoAgendaPageLast size={16} />
                                </button>
                              </>
                            ) : (
                              <span className="inline-block w-0 max-w-0 shrink-0 overflow-hidden" aria-hidden />
                            )}
                          </div>
                          <div className="flex min-w-0 shrink-0 items-center justify-end gap-0.5">
                            {overlayMode && isContextMode ? (
                              <button
                                type="button"
                                className={AO_AGENDA_NAV_BTN_CLASS}
                                aria-label="令旨を閉じる"
                                onClick={() => {
                                  setContextOpen(false);
                                  setRonListOverlayOpen(false);
                                  scheduleFocusMainPrompt();
                                }}
                              >
                                <IcoExecute size={14} />
                              </button>
                            ) : null}
                            {settingsOpen ? (
                              <button
                                type="button"
                                className={`${AO_AGENDA_NAV_BTN_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
                                aria-label={settingsSavePending ? "保存中" : "確定"}
                                disabled={settingsSavePending}
                                onClick={() => {
                                  void (async () => {
                                    if (!settingsOverlayRef.current) return;
                                    setSettingsSavePending(true);
                                    try {
                                      await settingsOverlayRef.current.confirmSave();
                                    } finally {
                                      setSettingsSavePending(false);
                                    }
                                  })();
                                }}
                              >
                                {settingsSavePending ? (
                                  <span className="whitespace-nowrap px-0.5 text-[9px] leading-none text-[#8D5400]">
                                    保存中…
                                  </span>
                                ) : (
                                  <IcoCheck size={14} />
                                )}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={AO_AGENDA_NAV_BTN_CLASS}
                              aria-label="戻る"
                              onClick={() => {
                                setContextOpen(false);
                                setChronicleOpen(false);
                                setSettingsOpen(false);
                                setUsageOpen(false);
                                setRonListOverlayOpen(false);
                                scheduleFocusMainPrompt();
                              }}
                            >
                              <IcoArrowLeft size={14} className="shrink-0" />
                            </button>
                          </div>
                        </div>
                        )}
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 pb-0.5">
                          {overlayMode ? (
                            <div
                              className="min-h-0 flex-1 overflow-y-scroll border border-solid [scrollbar-gutter:stable]"
                              style={{ borderColor: "#3D1C08", borderWidth: 1, backgroundColor: "rgba(255,255,255,0.0)" }}
                            >
                              {topicThreads.length === 0 ? (
                                <>
                                  <div
                                    className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5 text-[11px] text-[#3D1C08]"
                                    style={{ borderColor: "#3D1C08" }}
                                  >
                                    <div className="w-[24px]" />
                                    <div className="min-w-0 text-left">該当する議事はありません。</div>
                                    <div className="min-w-[52px] shrink-0 text-center text-[11px] leading-tight text-[#c2cad6]" />
                                    <div className="min-w-[108px] shrink-0 pr-[20px] text-right" />
                                  </div>
                                  {Array.from({ length: Math.max(0, AGENDA_PAGE_SIZE - 1) }).map((_, i) => (
                                    <div
                                      key={`sub-empty-row-${i}`}
                                      className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5"
                                      style={{ borderColor: "#3D1C08", minHeight: 18 }}
                                    >
                                      <div className="w-[24px]" />
                                      <div />
                                      <div className="min-w-[52px] shrink-0" />
                                      <div className="min-w-[108px] shrink-0 pr-[20px]" />
                                    </div>
                                  ))}
                                </>
                              ) : (
                                overlayThreadsSlice.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    className="group/row grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5 text-left text-[11px] hover:bg-[#143d5e]/60"
                                    style={{ borderColor: "#3D1C08" }}
                                    onClick={() => {
                                      if (isContextMode)
                                        setContextChecks((prev) =>
                                          prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                                        );
                                      else {
                                        setCurrentThread(t.id);
                                        setComposeLocked(true);
                                      }
                                    }}
                                  >
                                    <div className="flex w-[24px] items-center justify-center">
                                      {isContextMode ? (
                                        <input
                                          type="checkbox"
                                          checked={contextChecks.includes(t.id)}
                                          readOnly
                                          className="ao-overlay-checkbox"
                                        />
                                      ) : null}
                                    </div>
                                    <span className="min-w-0 truncate text-[#3D1C08] group-hover/row:underline">
                                      {aoThreadTitleForList(t)}
                                    </span>
                                    <span className="min-w-[52px] shrink-0 whitespace-nowrap text-center text-[11px] leading-tight text-[#6A3F0A]/80">
                                      {threadSourceProviderUlusLabel(t.sourceProvider)}
                                    </span>
                                    <span className="min-w-0 shrink-0 whitespace-nowrap pr-[20px] text-right text-[11px] leading-tight text-[#6A3F0A]/80 tabular-nums">
                                      {formatDate(t.updatedAt)}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          ) : null}
                          {showRonAgendaPanel && selectedTopic ? (
                            <div
                              className={`min-h-0 flex-1 overflow-y-auto border border-solid [scrollbar-gutter:stable] ${viewportCompact ? "text-[10px]" : "text-[11px]"}`}
                              style={{ borderColor: "#3D1C08", borderWidth: 1, backgroundColor: "rgba(255,250,240,0.35)" }}
                            >
                              <table className="w-full border-collapse text-[#3D1C08]">
                                <tbody>
                                  {agendaRowsSlice.map((t) => (
                                    <tr
                                      key={t.id}
                                      className="cursor-pointer border-b border-[#3D1C08] last:border-b-0 hover:bg-[#143d5e]/15"
                                      onClick={() => {
                                        setComposeLocked(false);
                                        setCurrentThread(t.id);
                                        setRonListOverlayOpen(false);
                                        scheduleFocusMainPrompt();
                                      }}
                                    >
                                      <td className="max-w-0 px-1.5 py-0.5">
                                        <span className="block truncate">{aoThreadTitleForList(t)}</span>
                                      </td>
                                      <td className="w-[52px] whitespace-nowrap px-1 py-0.5 text-center text-[#6A3F0A]/90">
                                        {threadSourceProviderUlusLabel(t.sourceProvider)}
                                      </td>
                                      <td className="w-[76px] whitespace-nowrap px-1.5 py-0.5 text-right tabular-nums text-[#6A3F0A]/90">
                                        {formatDateDay(t.updatedAt)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                          {settingsOpen ? (
                            <AoSettingsOverlay
                              ref={settingsOverlayRef}
                              embedded
                              open={settingsOpen}
                              embeddedSubpage={settingsEmbeddedSubpage}
                              onEmbeddedSubpageChange={setSettingsEmbeddedSubpage}
                              onClose={() => {
                                setSettingsOpen(false);
                                scheduleFocusMainPrompt();
                              }}
                            />
                          ) : null}
                          {usageOpen ? (
                            <AoUsageOverlay
                              embedded
                              open={usageOpen}
                              onClose={() => {
                                setUsageOpen(false);
                                scheduleFocusMainPrompt();
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    </AoOrnamentalFrame>
                  </div>
                </>
                )}
              </div>
            </div>
          </div>

          {/* 中段は「論エリア右側」へ統合（上で描画） */}
          </div>
              </section>
            </main>
            </AoOrnamentalFrame>

            {/* ②-3 メイン部下: チャット履歴（地図より手前・メイン枠と同列で後ろから順に積む） */}
            <section
              className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-0 bg-transparent font-serif"
              style={viewportCompact ? { zIndex: AO_Z_COMPACT_CHAT } : undefined}
            >
            <div
              ref={messagesRef}
              className="relative z-10 min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
              style={{
                paddingLeft: MAIN_COLUMN_GUTTER_X_PX + MAIN_MIDDLE_SECTION_PAD_X_PX,
                paddingRight: MAIN_COLUMN_GUTTER_X_PX + MAIN_MIDDLE_SECTION_PAD_X_PX,
                paddingTop: MAIN_MIDDLE_SECTION_PAD_X_PX,
                paddingBottom: MAIN_MIDDLE_SECTION_PAD_X_PX,
              }}
              onScroll={() => {
                const el = messagesRef.current;
                if (!el) return;
                if (chatScrollRafRef.current != null) cancelAnimationFrame(chatScrollRafRef.current);
                chatScrollRafRef.current = requestAnimationFrame(() => {
                  const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 48;
                  chatAutoStickToBottomRef.current = nearBottom;
                });
              }}
            >
              <div className="flex min-h-full flex-col justify-start gap-3">
                {chatTimelineRowsForRender(
                  currentThread?.messages ?? [],
                  Boolean(isTyping || typingId),
                ).map((m) => {
                  const label = aiAvatarCaptionLabel(currentThread, m);
                  const avatarKey =
                    m.side === "user" ? "ジュチ" : label in AVATAR_SRC ? label : "不明";
                  const avatarSrc = AVATAR_SRC[avatarKey];

                  const chatBubblePadStyle: CSSProperties = {
                    boxSizing: "border-box",
                    maxWidth: chatBubbleMaxWidth,
                    width: "100%",
                    minWidth: 0,
                    minHeight: CHAT_HISTORY_BUBBLE_MIN_H_PX,
                    overflowWrap: "break-word",
                  };

                  if (m.side === "ai") {
                    const aiBubbleStyle: CSSProperties = {
                      ...chatBubblePadStyle,
                      color: AO_CHAT_AI_BUBBLE_FG,
                      filter: AO_P5_BUBBLE_SHADOW_FILTER,
                    };
                    const avatarBtn = (
                      <button
                        type="button"
                        className="cursor-pointer touch-manipulation rounded-none border-0 bg-transparent p-0 select-none"
                        style={{ filter: AO_CHAT_AVATAR_DROP_SHADOW_FILTER }}
                        aria-label="モデル情報と Raw プロンプト"
                        onClick={(e) => {
                          void hydrateRawFromServerIfNeeded(e, "ai", m);
                        }}
                      >
                        <AoP5FaceFrameMid
                          src={avatarSrc}
                          alt={label}
                          width={NOKOR_PORTRAIT_W_PX}
                          height={Math.ceil((NOKOR_PORTRAIT_W_PX * 5) / 4)}
                        />
                      </button>
                    );
                    return (
                      <div
                        key={m.id}
                        data-ao-chat-row
                        data-ao-msg-id={m.id}
                        className="flex w-full items-start"
                        style={{ gap: chatRowGap }}
                      >
                        <div
                          className="flex shrink-0 flex-col items-center gap-0 font-serif"
                          style={{ width: CHAT_AVATAR_COL_W_PX }}
                        >
                          {avatarBtn}
                          <AoP5NameplateSmFrame width={NOKOR_PORTRAIT_W_PX} text={label} maxChars={7} variant="tight" fontSizePx={7} />
                        </div>
                        <div
                          data-ao-chat-bubble
                          className="flex min-h-0 min-w-0 flex-1 flex-col items-start justify-start overflow-visible"
                        >
                          <AoP5NineSliceBubble
                            variant="ai"
                            frameScale={0.5}
                            className="max-w-full text-[13px] leading-relaxed"
                            style={aiBubbleStyle}
                          >
                            {typingId === m.id ? (
                              <span style={{ color: AO_CHAT_AI_BUBBLE_FG }}>{msgTextForUi(currentThread, m)}</span>
                            ) : (
                              <AoMessageMarkdown text={msgTextForUi(currentThread, m)} className="ao-chat-ai-bubble-md" />
                            )}
                          </AoP5NineSliceBubble>
                        </div>
                      </div>
                    );
                  }

                  const userBubbleStyle: CSSProperties = {
                    ...chatBubblePadStyle,
                    filter: AO_P5_BUBBLE_SHADOW_FILTER,
                  };
                  const userAvatarBtn = (
                    <button
                      type="button"
                      className="cursor-pointer touch-manipulation rounded-none border-0 bg-transparent p-0 select-none"
                      style={{ filter: AO_CHAT_AVATAR_DROP_SHADOW_FILTER }}
                      aria-label="モデル情報と Raw プロンプト（送信側）"
                      onClick={(e) => {
                        void hydrateRawFromServerIfNeeded(e, "user", m);
                      }}
                    >
                      <AoP5FaceFrameMid
                        src={avatarSrc}
                        alt={label}
                        width={NOKOR_PORTRAIT_W_PX}
                        height={Math.ceil((NOKOR_PORTRAIT_W_PX * 5) / 4)}
                      />
                    </button>
                  );
                  return (
                    <div
                      key={m.id}
                      data-ao-chat-row
                      data-ao-msg-id={m.id}
                      className="flex w-full flex-row-reverse items-start"
                      style={{ gap: chatRowGap }}
                    >
                      <div
                        className="relative z-20 box-border flex shrink-0 flex-col items-center gap-0 font-serif"
                        style={{ width: CHAT_AVATAR_COL_W_PX }}
                      >
                        {userAvatarBtn}
                        <AoP5NameplateSmFrame width={NOKOR_PORTRAIT_W_PX} text="ジュチ" maxChars={7} variant="tight" fontSizePx={7} />
                      </div>
                      <div
                        data-ao-chat-bubble
                        className="flex min-h-0 min-w-0 flex-1 flex-col items-end justify-start overflow-visible"
                      >
                        <AoP5NineSliceBubble
                          variant="user"
                          frameScale={0.5}
                          className="max-w-full text-[13px] leading-relaxed text-[#1a1208]"
                          style={userBubbleStyle}
                        >
                          {typingId === m.id ? (
                            <span>{msgTextForUi(currentThread, m)}</span>
                          ) : (
                            <AoMessageMarkdown text={msgTextForUi(currentThread, m)} />
                          )}
                        </AoP5NineSliceBubble>
                      </div>
                    </div>
                  );
                })}
                {isThinking && currentThread ? (
                  <div
                    className="flex w-full items-start"
                    style={{ gap: chatRowGap }}
                    aria-live="polite"
                    aria-busy="true"
                  >
                    {(() => {
                      const thinkingCap = aoThinkingAiCaptionLabel(currentThread);
                      const thinkingKey = thinkingCap in AVATAR_SRC ? thinkingCap : "不明";
                      return (
                        <>
                          <div
                            className="flex shrink-0 flex-col items-center gap-0 font-serif"
                            style={{ width: CHAT_AVATAR_COL_W_PX }}
                          >
                            <AoP5FaceFrameMid
                              src={AVATAR_SRC[thinkingKey]}
                              alt={thinkingCap}
                              width={NOKOR_PORTRAIT_W_PX}
                              height={Math.ceil((NOKOR_PORTRAIT_W_PX * 5) / 4)}
                            />
                            <AoP5NameplateSmFrame
                              width={NOKOR_PORTRAIT_W_PX}
                              text={thinkingCap}
                              maxChars={7}
                              variant="tight"
                              fontSizePx={7}
                            />
                          </div>
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-start justify-start overflow-visible">
                            <AoP5NineSliceBubble
                              variant="ai"
                              frameScale={0.5}
                              className="max-w-full text-[13px] leading-relaxed"
                              style={{
                                boxSizing: "border-box",
                                maxWidth: chatBubbleMaxWidth,
                                width: "100%",
                                minWidth: 0,
                                minHeight: CHAT_HISTORY_BUBBLE_MIN_H_PX,
                                overflowWrap: "break-word",
                                color: AO_CHAT_AI_BUBBLE_FG,
                                filter: AO_P5_BUBBLE_SHADOW_FILTER,
                              }}
                            >
                              <span className="font-serif tabular-nums" style={{ color: AO_CHAT_AI_BUBBLE_FG }}>
                                {thinkingDotsText}
                              </span>
                            </AoP5NineSliceBubble>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            </div>
            </section>
            </div>
            {!viewportCompact ? (
              <div className="min-h-0 min-w-0 basis-0" style={{ flex: "2 1 0%" }} aria-hidden />
            ) : null}
            </div>

          </div>

        </div>
      </div>

      <div
        ref={ronTopicLabelsProbeRef}
        className="pointer-events-none fixed left-[-9999px] top-0 z-[-1] flex flex-col whitespace-nowrap opacity-0"
        aria-hidden
      >
        {AO_TOPICS.filter((tp) => tp.id !== "kurultai").map((tp) => (
          <span
            key={tp.id}
            data-ao-ron-probe-label
            className="font-semibold text-[#3D1C08]"
            style={{ fontSize: compactRonTabTopicFs }}
          >
            {tp.label}
          </span>
        ))}
      </div>

      {kinDrawerPortalEl}

      {rawPromptOverlay && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                role="presentation"
                className="fixed inset-0 bg-transparent"
                style={{ zIndex: AO_Z_RAW_BACKDROP }}
                aria-hidden
                onPointerDown={() => setRawPromptOverlay(null)}
              />
              <div
                className={
                  rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                    ? "fixed box-border flex min-h-0 flex-col overflow-hidden"
                    : "fixed box-border w-[min(92vw,320px)] max-w-[320px]"
                }
                style={{
                  top: rawPromptOverlay.top,
                  left: rawPromptOverlay.left,
                  zIndex: AO_Z_RAW_PANEL,
                  ...(rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                    ? { width: rawPromptOverlay.panelWidthPx, height: rawPromptOverlay.panelHeightPx }
                    : {}),
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <AoP5NineSliceBubble
                  variant={rawPromptOverlay.variant === "user" ? "user" : "ai"}
                  frameScale={0.25}
                  fillHeight={
                    rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                  }
                  bgColor={rawPromptOverlay.variant === "user" ? undefined : AO_CHAT_AI_BUBBLE_BG}
                  contentPadX={6}
                  contentPadY={6}
                  className={`leading-snug text-[#1a1208] ${rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null ? "min-h-0 flex-1" : ""}`}
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    ...(rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                      ? { height: "100%", maxHeight: "100%", minHeight: 0 }
                      : { maxHeight: RAW_POPOVER_MAX_H_OUTER }),
                    filter: AO_P5_BUBBLE_SHADOW_FILTER,
                    fontSize: RAW_POPOVER_FS_MAIN_PX,
                  }}
                >
                  <div
                    className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden"
                    style={{
                      maxHeight:
                        rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                          ? "100%"
                          : RAW_POPOVER_MAX_H_SCROLL,
                      minHeight: 0,
                    }}
                  >
                    <div className="shrink-0 font-bold">{rawPromptOverlay.usage.modelId}</div>
                    <div className="shrink-0 tabular-nums">
                      トークン: 入力 {rawPromptOverlay.usage.promptTokens}/出力 {rawPromptOverlay.usage.completionTokens}/計{" "}
                      {rawPromptOverlay.usage.totalTokens}{" "}
                      <span className="whitespace-nowrap">
                        (概算${" "}
                        {(() => {
                          const u = aoResolveUsdForOverlay(rawPromptOverlay.usage);
                          return u != null ? u.toFixed(6) : "—";
                        })()}
                        )
                      </span>
                    </div>
                    {rawPromptOverlay.completionMeta ? (
                      <div className="shrink-0 border-t border-[#c9b896]/60 pt-1 tabular-nums">
                        <div className="font-semibold">完了メタ</div>
                        <div>
                          finish_reason:{" "}
                          {rawPromptOverlay.completionMeta.finishReason ?? "—"}
                          {rawPromptOverlay.completionMeta.nativeFinishReason != null &&
                          rawPromptOverlay.completionMeta.nativeFinishReason !==
                            rawPromptOverlay.completionMeta.finishReason ? (
                            <>
                              {" "}
                              （ネイティブ: {rawPromptOverlay.completionMeta.nativeFinishReason}）
                            </>
                          ) : null}
                        </div>
                        <div>
                          形式再試行: {rawPromptOverlay.completionMeta.formatRetriesUsed} / empty フォールバック:{" "}
                          {rawPromptOverlay.completionMeta.emptyAssistantFallback ? "あり" : "なし"}
                        </div>
                        <div>
                          web_search: 実行 {rawPromptOverlay.completionMeta.webSearchInvocations} / 上限スキップ{" "}
                          {rawPromptOverlay.completionMeta.webSearchSkippedByLimit}（ラウンド上限{" "}
                          {rawPromptOverlay.completionMeta.webSearchMaxPerRound}）
                        </div>
                      </div>
                    ) : null}
                    <div
                      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words font-mono text-[#1a1208] [scrollbar-gutter:stable]"
                      style={{ fontSize: RAW_POPOVER_FS_MONO_PX }}
                    >
                      {rawPromptOverlay.rawPrompts ? (
                        <>
                          【送信全文】
                          {"\n\n"}
                          {rawPromptOverlay.rawPrompts.sent}
                          {"\n\n"}
                          【モデル応答全文】
                          {"\n\n"}
                          {rawPromptOverlay.rawPrompts.received}
                        </>
                      ) : (
                        "（この応答では Raw の記録がありません）"
                      )}
                    </div>
                  </div>
                </AoP5NineSliceBubble>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

