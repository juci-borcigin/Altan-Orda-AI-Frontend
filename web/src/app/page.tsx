"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  AO_TOPICS,
  type TopicUiId,
  activeNokorNamesForTopic,
  aoPostingProjectIdForTopic,
  aoThreadsForPostMenu,
  threadsForTopicGiList,
  threadMatchesTopicProjectIds,
  compareThreadsForGiList,
  createAoThreadForTopic,
  focusStateOnTopic,
  focusStateOnGakkyuBlank,
  isGakkyuTopic,
  isAoNativeThread,
  projectIdsForTopic,
  topicUiIdForProjectId,
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
  IcoGear,
  IcoLogin,
  IcoLogout,
  IcoRoundedPlus,
  IcoTrash,
} from "@/components/ao-action-icons";
import { AoMessageMarkdown } from "@/components/AoMessageMarkdown";
import {
  AoComposeAttachments,
  AoMessageAttachments,
  uploadChatAttachment,
} from "@/components/ao-compose-attachments";
import { AO_ATTACHMENT_MAX_COUNT, type AoMsgAttachment } from "@/lib/ao-attachments";
import { latestClipboardFile } from "@/lib/ao-attachment-client";
import { AoDeleteConfirmPopup } from "@/components/AoDeleteConfirmPopup";
import { AoReijitsuOverlay, type AoReijitsuOverlayHandle } from "@/components/AoReijitsuOverlay";
import { AoSettingsOverlay, AoSettingsSubpageTabs, type AoSettingsOverlayHandle, type AoSettingsSubpage } from "@/components/AoSettingsOverlay";
import { AoUsageOverlay } from "@/components/AoUsageOverlay";
import {
  AO_POPUP_DELETE_LOG_FALLBACK,
  aoPopupMarkdownForBubble,
  substituteAoPopupTemplateMarkdown,
} from "@/lib/ao-popup";
import {
  buildAoPersonaCatalog,
  primaryPersonaForProject,
  resolveSpeakerDisplay,
  type AoPersonaCatalog,
} from "@/lib/ao-persona-display";
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
import { readChatSseDone } from "@/lib/ao-chat-sse";
import { estimateUsdFromTokensClient } from "@/lib/ao-usage-estimate-client";
import { openRawHtmlInNewTab } from "@/lib/ao-raw-overlay";
import { AoMainJuchiActions } from "@/components/ao-main-juchi-actions";
import { AoUsageChipPanel } from "@/components/ao-usage-chip";
import { AO_PORTRAIT_LAYOUT_W_PX } from "@/lib/ao-portrait";
import {
  AoOrnamentalFrame,
  AoP5NineSliceBubble,
  AoP5FaceFrameMid,
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
  aoP5FaceFrameMidOuterSizePx,
  AoP5NameplateSmFrame,
  AO_PC_NOKOR_TIGHT_PAD_X_PX,
  aoP5NameplateSmOuterWidthPx,
  aoP5NameplateSmTightPlateOuterWidthPx,
} from "@/components/ao-phase5";
import { detectNamedSpeaker, getPrimarySpeakerForProject } from "@/lib/ao-prompts";
import { previewAssistantStreamChunks } from "@/lib/phase5/phase5-chat-output";
import type { ProjectId } from "@/lib/ao-types";

const STORAGE_KEY = "ao_state_v1";
/** 議事帯ツールバー（年代記・使用量・設定・令旨）：従来 10/14px の約 120% */
const AO_MAIN_TOOLBAR_ICON_SCALE = 1.2;
/** メイン左上アイコン：枠なし・クリック時はわずかに縮小 */
const AO_MAIN_ICON_BTN_CLASS =
  "rounded-none border-0 bg-transparent p-1 text-[#DBB961] outline-none transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90";
/** 議事帯右上：年代記／使用量／設定（装飾枠なし・色は令旨と同系） */
const AO_MAIN_HEADER_ICON_BTN_CLASS =
  "inline-flex items-center justify-center rounded-md border-0 bg-transparent p-1 outline-none transition-[transform,opacity] hover:bg-[#8D5400]/[0.08] active:scale-[0.9] active:opacity-90";
/** 邦主列：送信（帯びたボタン・令旨アイコン同寸・パディング控えめ） */
const AO_MAIN_SEND_BTN_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-[#8D5400]/50 bg-gradient-to-b from-[#fbf6e8] to-[#e9dcc6] px-1 py-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.12)] outline-none transition-[transform,opacity,box-shadow] hover:border-[#8D5400]/80 hover:shadow-[0_2px_6px_rgba(0,0,0,0.14)] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#8D5400]/50 disabled:hover:shadow-[0_1px_2px_rgba(0,0,0,0.12)] disabled:active:scale-100";
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
/** 常に 1 文字以上（空フェーズなし）で吹き出し高さを維持 */
const AO_THINKING_DOT_CYCLE = [".", "..", "...", "...."];

function aoResolveUsdForOverlay(u: MsgTurnUsage): number | null {
  return u.estimatedUsd ?? estimateUsdFromTokensClient(u.promptTokens, u.completionTokens);
}

/** Raw ポップオーバー：以前の上限の約 50％（Y のみ） */
const RAW_POPOVER_MAX_H_OUTER = "min(37vh,250px)";
const RAW_POPOVER_MAX_H_SCROLL = "min(34vh,230px)";
const RAW_POPOVER_W = 320;
/** Raw チップ要約・リンク共通（読めるサイズ） */
const RAW_POPOVER_FS_CHIP_PX = 8;

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
const NOKOR_PORTRAIT_BOX_H_PX = Math.ceil((NOKOR_PORTRAIT_W_PX * 5) / 4);
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

/** チャット（履歴・入力）の顔グラ列：70% 枠外寸と 7文字 tight 名札外寸の広い方 */
const { outerW: CHAT_FACE_STACK_W_PX } = aoP5FaceFrameMidOuterSizePx(
  NOKOR_PORTRAIT_W_PX,
  NOKOR_PORTRAIT_BOX_H_PX,
  AO_MAIN_CHAT_FACE_PORTRAIT_SCALE,
);
/** メイン／チャット：名札の最小幅＝顔枠（Face_SM）外寸 */
const CHAT_NAMEPLATE_MIN_W_PX = CHAT_FACE_STACK_W_PX;

const MAIN_CHAT_NAMEPLATE_OPTS = {
  maxChars: 7 as const,
  fontSizePx: 7,
  variant: "tight" as const,
};

function aoMainChatNameplateOuterWidthPx(text: string): number {
  return aoP5NameplateSmOuterWidthPx({
    text,
    minWidthPx: CHAT_NAMEPLATE_MIN_W_PX,
    ...MAIN_CHAT_NAMEPLATE_OPTS,
  });
}

/** 左サイド【顔グラ・名前】列の共通幅（7文字 tight 名札：タタ・トゥンガ／チン・テムール相当） */
function aoKinAvatarNameColWPx(opts: {
  nameplateFontSizePx: number;
  tightPadXPx?: number;
}): number {
  return Math.max(
    CHAT_FACE_STACK_W_PX,
    aoP5NameplateSmTightPlateOuterWidthPx({
      bandWidthPx: CHAT_NAMEPLATE_MIN_W_PX,
      nameplateFontSizePx: opts.nameplateFontSizePx,
      layoutCharCount: 7,
      tightPadXPx: opts.tightPadXPx,
    }),
  );
}

/**
 * 左サイド：【顔グラ・名前】共通幅枠（上から中央）｜右に説明（上揃え）
 * ```
 * [ 顔グラ ] ｜ 為政論 / 邦　主+ルビ
 * [ 名前   ] ｜ 第一の千戸長+ルビ
 * ```
 */
function AoKinAvatarStack({
  face,
  name,
  nameplateFontSizePx,
  tightPadXPx,
  captionRightTop,
  captionRightBottom,
  centerRonLine,
  maxWidthPx,
}: {
  face: ReactNode;
  name: string;
  nameplateFontSizePx: number;
  tightPadXPx?: number;
  captionRightTop?: ReactNode;
  captionRightBottom?: ReactNode;
  /** 僚友の論名行（為政論等）を枠内中央揃え */
  centerRonLine?: boolean;
  maxWidthPx?: number;
}) {
  const avatarColW = aoKinAvatarNameColWPx({ nameplateFontSizePx, tightPadXPx });
  const hasRight = captionRightTop != null || captionRightBottom != null;
  return (
    <div
      className="grid w-fit max-w-full items-start"
      style={{
        gridTemplateColumns: hasRight ? `${avatarColW}px minmax(0, max-content)` : `${avatarColW}px`,
        columnGap: hasRight ? KIN_SIDEBAR_CAPTION_COL_GAP_PX : 0,
        maxWidth: maxWidthPx,
      }}
    >
      <div
        className="box-border flex shrink-0 flex-col items-center justify-start gap-0"
        style={{ width: avatarColW, minWidth: avatarColW }}
      >
        <div className="flex w-full justify-center">{face}</div>
        <div className="flex w-full justify-center">
          <AoP5NameplateSmFrame
            width={CHAT_NAMEPLATE_MIN_W_PX}
            text={name}
            maxChars={7}
            variant="tight"
            fontSizePx={nameplateFontSizePx}
            tightPadXPx={tightPadXPx}
          />
        </div>
      </div>
      {hasRight ? (
        <div className="flex min-w-0 w-full flex-col justify-start gap-0 self-start leading-none">
          {centerRonLine ? (
            <div className="w-full text-center">{captionRightTop ?? null}</div>
          ) : (
            captionRightTop ?? null
          )}
          <div className={centerRonLine ? "w-full text-left" : undefined}>{captionRightBottom ?? null}</div>
        </div>
      ) : null}
    </div>
  );
}

/** メイン入力の邦主列（名札幅と送信・令旨行の広い方） */
const MAIN_JUCHI_AVATAR_COL_MIN_W_PX = 58;
const MAIN_JUCHI_AVATAR_COL_W_PX = Math.max(
  aoMainChatNameplateOuterWidthPx("ジュチ"),
  MAIN_JUCHI_AVATAR_COL_MIN_W_PX,
);

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
  { name: "クドゥカ", captionPrefix: "オイラト", captionRubyBase: "族長", captionRubyRt: "ノヤン", line2: "巷間論", src: "/personas/AO_Char_QudukaBeki.png" },
  { name: "タタ・トゥンガ", captionPrefix: "", captionRubyBase: "師傅", captionRubyRt: "アタベク", line2: "典籍論", src: "/personas/AO_Char_TataTunga.png" },
  { name: "チン・テムール", captionPrefix: "", captionRubyBase: "政商", captionRubyRt: "オルトク", line2: "遠交論", src: "/personas/AO_Char_ChinTemur.png" },
  { name: "コルグズ", captionPrefix: "", captionRubyBase: "書記", captionRubyRt: "ビチクチ", line2: "", src: "/personas/AO_Char_Qorguz.png" },
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
/** メイン入力・チャット（ユーザー）の吹き出し〜顔グラ列 */
const AO_AVATAR_BUBBLE_GAP_TIGHT_PX = Math.round(MAIN_BUBBLE_ROW_GAP_PX / 2);
/** メイン入力：吹き出し終端〜邦主列開始（tight gap の 50%） */
const MAIN_COMPOSE_AVATAR_GAP_PX = Math.max(2, Math.round(AO_AVATAR_BUBBLE_GAP_TIGHT_PX / 2));
/** チャット履歴エリアの横パディング（左＝AI 顔グラ開始／メイン左端揃え） */
const CHAT_AREA_PAD_X_PX = MAIN_COLUMN_GUTTER_X_PX + MAIN_MIDDLE_SECTION_PAD_X_PX;
/** チャット右：メイン右端揃え（左 `CHAT_AREA_PAD_X_PX` と対称）。スクロールバー分は `[scrollbar-gutter:stable]` が確保 */
const CHAT_AREA_PAD_RIGHT_PX = CHAT_AREA_PAD_X_PX;

function mainComposeRowGridStyle(avatarColWPx: number = MAIN_JUCHI_AVATAR_COL_W_PX): CSSProperties {
  return {
    display: "grid",
    width: "100%",
    minWidth: 0,
    alignItems: "stretch",
    gridTemplateColumns: `minmax(0, 1fr) ${avatarColWPx}px`,
    columnGap: MAIN_COMPOSE_AVATAR_GAP_PX,
  };
}

/** 左サイド（顔＋名）｜説明 の列間 */
const KIN_SIDEBAR_CAPTION_COL_GAP_PX = 4;

/** チャット AI：名札 min＝顔枠外寸・長名は可変、顔はエリア中央 */
function AoChatAiAvatarStack({ face, label }: { face: ReactNode; label: string }) {
  const stackW = aoMainChatNameplateOuterWidthPx(label);
  return (
    <div className="flex flex-col items-stretch gap-0" style={{ width: stackW }}>
      <div className="flex w-full justify-center">{face}</div>
      <AoP5NameplateSmFrame
        width={CHAT_NAMEPLATE_MIN_W_PX}
        text={label}
        {...MAIN_CHAT_NAMEPLATE_OPTS}
      />
    </div>
  );
}

/** チャット履歴吹き出しの最小高さ（約1行＋パディング。入力欄の MAIN_SPEECH_BUBBLE_H_PX は別） */
const CHAT_HISTORY_BUBBLE_MIN_H_PX = Math.ceil(13 * 1.42) + 8;

/** 議事タイトル・右上使用量/設定・右下令旨/年代記チップ：装飾枠インセットを詰め、内側の縦余白（計測の青エリア）を抑える */
const GIJI_CHIP_ORNAMENT_INSET_PX = 5;
const GIJI_CHIP_ORNAMENT_CONTENT_PAD = "2px 6px";
/** 議事タイトル羊皮紙（計測 ref）内の上下余白 — DevTools の青ボックスの Y */
const GIJI_TITLE_PARCHMENT_PAD_Y_PX = 4;
/** スマホ：装飾枠 contentInset は維持し、横パディングのみ削って 16 全角相当の幅を確保 */
const GIJI_TITLE_CHIP_COMPACT_ORNAMENT_CONTENT_PAD = "2px 0";
const GIJI_TITLE_CHIP_COMPACT_PARCHMENT_PAD_Y_PX = 2;

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
      // ユーザー行は data-ao-chat-side=user。直後のユーザー連続はスキップする。
      if (cand.getAttribute("data-ao-chat-side") !== "user") {
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
/** メイン入力・ジュチ直下「邦　主」本体（Tailwind `text-[10px]`） */
const MAIN_JUCHI_RUBY_MAIN_CLASS =
  "text-[10px] font-semibold font-serif text-[#3D1C08]";
/** 左サイド・僚友の論名行（為政論等）：メインの邦　主と同じクラス */
const KIN_NOKOR_LINE2_CLASS = MAIN_JUCHI_RUBY_MAIN_CLASS;
/** 左サイド・邦主枠内の「邦　主」（論タブと同系） */
function aoKinSidebarLordCaptionMainClass(viewportCompact: boolean): string {
  return viewportCompact
    ? "text-[10px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]"
    : "text-[14px] font-semibold font-serif tracking-[0.12em] text-[#3D1C08]";
}
/** 論名行の上余白（調整前 4px → 150%） */
const KIN_SIDEBAR_RON_LINE_PAD_TOP_BEFORE_PX = 4;
const KIN_SIDEBAR_RON_LINE_PAD_TOP_PX = Math.round(KIN_SIDEBAR_RON_LINE_PAD_TOP_BEFORE_PX * 1.5);
function kinSidebarRonLinePadStyle(): CSSProperties {
  return { paddingTop: KIN_SIDEBAR_RON_LINE_PAD_TOP_PX, lineHeight: 1.15 };
}
/** メイン論タブ（巷間論〜兵馬論）字サイズ */
function aoMainRonTabTopicFontPx(viewportCompact: boolean): number {
  return viewportCompact ? 10 : Math.round(12 * AO_PC_ZOOM_COMP_SCALE);
}
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
/** ドロワー開時：ヘッダ(40)より手前に全画面タップで閉じられるオーバーレイ */
const AO_Z_COMPACT_KIN_DRAWER_OPEN = 45;
const AO_Z_COMPACT_MAP_STACK = 25;
const AO_Z_COMPACT_MAIN = 20;
const AO_Z_COMPACT_CHAT = 10;

function aoIsProbablyMobileUa(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator.userAgent || "").toLowerCase();
  // iPad は「スマホ専用」調整を避ける（iPadOS は desktop 表記になることもある）
  const isIpad = ua.includes("ipad");
  if (isIpad) return false;
  return (
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    (ua.includes("android") && ua.includes("mobile")) ||
    ua.includes("windows phone")
  );
}

function aoIsProbablyPhoneLikeDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const touch = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  if (touch <= 0) return false;
  const sw = typeof window.screen?.width === "number" ? window.screen.width : window.innerWidth;
  const sh = typeof window.screen?.height === "number" ? window.screen.height : window.innerHeight;
  const short = Math.min(sw, sh);
  // iPhone（16 Pro など）の CSS px は短辺 360〜430 前後。安全側で 520px を上限とする。
  return short > 0 && short <= 520;
}

/** ハイドレーション時はサーバと同じ false を強制し、クライアント初回コミット後に実ビューポートへ同期する */
function subscribeAoViewportCompact(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // SSR の serverSnapshot(false) から、マウント直後に実ビューポートへ同期する
  // （実機では resize が発火せず、永遠に false 固定になるケースを防ぐ）
  const handler = () => onStoreChange();
  const timers: number[] = [];
  const rafs: number[] = [];

  // iOS 等で meta viewport の反映が遅れても追随できるよう、複数回再同期する
  try {
    queueMicrotask(handler);
  } catch {
    timers.push(window.setTimeout(handler, 0));
  }
  rafs.push(
    window.requestAnimationFrame(() => {
      rafs.push(window.requestAnimationFrame(handler));
    }),
  );
  timers.push(window.setTimeout(handler, 60));
  timers.push(window.setTimeout(handler, 240));

  // 変化検知：matchMedia だけでなく resize / orientation / visualViewport も拾う
  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
  window.addEventListener("pageshow", handler);
  const vv = window.visualViewport;
  if (vv && typeof vv.addEventListener === "function") {
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
  }

  let mq: MediaQueryList | null = null;
  let mqCleanup: (() => void) | null = null;
  try {
    mq = window.matchMedia(`(max-width: ${AO_MOBILE_MAX_CSS_PX}px)`);
    const legacyMq = mq as MediaQueryList & {
      addListener?: (listener: (ev: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (ev: MediaQueryListEvent) => void) => void;
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      mqCleanup = () => mq?.removeEventListener("change", handler);
    } else if (typeof legacyMq.addListener === "function" && typeof legacyMq.removeListener === "function") {
      legacyMq.addListener(handler);
      mqCleanup = () => legacyMq.removeListener?.(handler);
    }
  } catch {
    mqCleanup = null;
  }

  return () => {
    for (const id of timers) window.clearTimeout(id);
    for (const id of rafs) window.cancelAnimationFrame(id);
    window.removeEventListener("resize", handler);
    window.removeEventListener("orientationchange", handler);
    window.removeEventListener("pageshow", handler);
    if (vv && typeof vv.removeEventListener === "function") {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    }
    mqCleanup?.();
  };
}

function getAoViewportCompactSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const byWidth = window.matchMedia(`(max-width: ${AO_MOBILE_MAX_CSS_PX}px)`).matches;
    if (byWidth) return true;
    // 「PCサイト表示」等で viewport 幅が大きくても、スマホ実機なら compact を優先
    if (aoIsProbablyMobileUa()) return true;
    return aoIsProbablyPhoneLikeDevice();
  } catch {
    if (window.innerWidth <= AO_MOBILE_MAX_CSS_PX) return true;
    if (aoIsProbablyMobileUa()) return true;
    return aoIsProbablyPhoneLikeDevice();
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
const JUCHI_PORTRAIT_BOX_H_PX = NOKOR_PORTRAIT_BOX_H_PX;
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

/** コンパクト投稿欄の見た目字サイズ（px）。scale 算出の参照 */
const COMPACT_COMPOSE_VISUAL_FS = 12;
/** iOS フォーカス自動ズーム回避用の実 font-size（入力系共通） */
const COMPACT_COMPOSE_INPUT_FS = 16;
/**
 * 見た目縮小倍率。`1` で scale 無効（16px 表示のまま＝今の挙動に戻す）。
 * 試験: COMPACT_COMPOSE_VISUAL_FS / COMPACT_COMPOSE_INPUT_FS
 */
const COMPACT_COMPOSE_INPUT_VISUAL_SCALE = COMPACT_COMPOSE_VISUAL_FS / COMPACT_COMPOSE_INPUT_FS;

/** 狭ビュー：入力吹き出しを下へ少し伸ばす（論列の下端と視覚的に揃える微調整） */
const COMPACT_COMPOSE_BOTTOM_BLEED_PX = 8;

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

const CHAT_UI_UNKNOWN_AVATAR = "/personas/AO_Char_Hunan.png";

function aiSpeakerUi(
  thread: Thread | null,
  m: Msg,
  catalog: AoPersonaCatalog | null,
): { label: string; avatarSrc: string } {
  if (m.side === "user") {
    return { label: "ジュチ", avatarSrc: AVATAR_SRC["ジュチ"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }
  const pid = thread?.projectId;
  if (pid === "claude" || pid === "chatgpt") {
    return { label: "耶律楚材", avatarSrc: AVATAR_SRC["耶律楚材"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }
  if (pid === "gemini") {
    return { label: "ソルコクタニ", avatarSrc: AVATAR_SRC["ソルコクタニ"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }
  return resolveSpeakerDisplay({
    speaker: m.speaker,
    catalog,
    fallbackAvatarByLabel: AVATAR_SRC,
    unknownAvatarSrc: CHAT_UI_UNKNOWN_AVATAR,
  });
}

/**
 * 考え中プレースホルダー：名指し → 論の主担当（ao_personas）→ フォールバック。
 * 回答行と同じ解決で顔グラと名札を揃える。
 */
function aoThinkingSpeakerUi(
  thread: Thread | null,
  catalog: AoPersonaCatalog | null,
): { label: string; avatarSrc: string } {
  const pid = thread?.projectId as ProjectId | undefined;
  if (pid === "claude" || pid === "chatgpt") {
    return { label: "耶律楚材", avatarSrc: AVATAR_SRC["耶律楚材"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }
  if (pid === "gemini") {
    return { label: "ソルコクタニ", avatarSrc: AVATAR_SRC["ソルコクタニ"] ?? CHAT_UI_UNKNOWN_AVATAR };
  }

  const msgs = visibleMessages(thread?.messages ?? []);
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.side === "user") {
      const designated = detectNamedSpeaker(m.text ?? "");
      if (designated) {
        return resolveSpeakerDisplay({
          speaker: designated,
          catalog,
          fallbackAvatarByLabel: AVATAR_SRC,
          unknownAvatarSrc: CHAT_UI_UNKNOWN_AVATAR,
        });
      }
      break;
    }
  }

  const primary = pid ? primaryPersonaForProject(catalog, pid) : null;
  if (primary?.name.trim()) {
    return resolveSpeakerDisplay({
      speaker: primary.name,
      catalog,
      fallbackAvatarByLabel: AVATAR_SRC,
      unknownAvatarSrc: CHAT_UI_UNKNOWN_AVATAR,
    });
  }

  return resolveSpeakerDisplay({
    speaker: getPrimarySpeakerForProject(pid ?? "debate"),
    catalog,
    fallbackAvatarByLabel: AVATAR_SRC,
    unknownAvatarSrc: CHAT_UI_UNKNOWN_AVATAR,
  });
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

/** 年代記／令旨リスト：`ao_threads.source_provider` のウルス表示名 */
function threadSourceProviderUlusLabel(sourceProvider: string | undefined): string {
  const v = sourceProvider?.trim().toLowerCase() ?? "";
  if (v === "gemini") return "チャガタイ";
  if (v === "chatgpt") return "オゴデイ";
  if (v === "claude") return "ジュチ";
  if (v === "nblm") return "NotebookLM";
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
  mobileDrawer = false,
  viewportCompact = false,
}: {
  activeNames: ReadonlySet<string>;
  /** 狭ビュードロワーのみ 7 など。既定 8 は PC 左列と同じ */
  nameplateFontSizePx?: number;
  mobileDrawer?: boolean;
  viewportCompact?: boolean;
}) {
  const drawerStrip = mobileDrawer;
  const nokorTightPadXPx = drawerStrip ? undefined : AO_PC_NOKOR_TIGHT_PAD_X_PX;
  const nokorLine2PadStyle = kinSidebarRonLinePadStyle();
  /** 邦主枠内セルと同じ 3px。右のみ僚友説明側へ広げる */
  const rowPadBase = 3;
  const rowPadRight = rowPadBase + (drawerStrip ? 2 : 5);

  const rowInner = (p: (typeof NOKOR)[number], active: boolean) => (
    <div
      className={aoNokorCellClasses(active)}
      style={{
        width: drawerStrip ? "fit-content" : "100%",
        maxWidth: drawerStrip ? "100%" : undefined,
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      <div
        className={`flex min-w-0 flex-col items-stretch transition-none ${drawerStrip ? "w-fit" : "w-full"} ${active ? "translate-x-px translate-y-px" : "translate-x-0 translate-y-0"}`}
        style={{
          paddingTop: rowPadBase,
          paddingBottom: rowPadBase,
          paddingLeft: rowPadBase,
          paddingRight: rowPadRight,
          maxWidth: drawerStrip ? "100%" : undefined,
        }}
      >
        <AoKinAvatarStack
          face={
            <AoP5FaceFrameMid
              src={p.src}
              alt={p.name}
              width={NOKOR_PORTRAIT_W_PX}
              height={NOKOR_PORTRAIT_BOX_H_PX}
              portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
            />
          }
          name={p.name}
          nameplateFontSizePx={nameplateFontSizePx}
          tightPadXPx={nokorTightPadXPx}
          centerRonLine
          captionRightTop={
            <div className={`min-w-0 ${KIN_NOKOR_LINE2_CLASS}`} style={nokorLine2PadStyle}>
              {p.line2 || "\u00a0"}
            </div>
          }
          captionRightBottom={
            <div className="min-w-0 text-left text-[7px] font-semibold leading-[1.15] text-[#3D1C08]">
              {p.captionPrefix ? <span>{p.captionPrefix}</span> : null}
              <ruby className="font-serif">
                {p.captionRubyBase}
                <rt className="font-serif text-[4px] text-[#6A3F0A]/80">{p.captionRubyRt}</rt>
              </ruby>
            </div>
          }
        />
      </div>
    </div>
  );

  return (
    <div
      className={`flex w-full flex-col justify-start overflow-visible pt-0 ${drawerStrip ? "min-w-0" : "min-w-0"}`}
      style={{
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      <div className="w-full min-w-0">
        <div className="flex w-full min-w-0 flex-col gap-[2px]">
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
  viewportCompact = false,
}: {
  measureRef?: RefObject<HTMLDivElement | null>;
  activeNames: ReadonlySet<string>;
  /** 狭ビュードロワーのみ 7（PC は既定 8 のまま） */
  nameplateFontSizePx?: number;
  /** 狭ビュー・ポータル内のみ：右カラム幅を 7文字 tight 名札外寸に合わせる */
  mobileDrawerNokorLayout?: boolean;
  viewportCompact?: boolean;
}) {
  const drawerKin = mobileDrawerNokorLayout;
  const lordCaptionPadStyle = kinSidebarRonLinePadStyle();
  const lordCaptionMainClass = aoKinSidebarLordCaptionMainClass(viewportCompact);
  const lordCaptionRtClass = viewportCompact
    ? "font-serif text-[7px] text-[#6A3F0A]/80"
    : "font-serif text-[9px] text-[#6A3F0A]/80";
  const kinOrnamentFrameClass = drawerKin
    ? "min-w-0 w-full overflow-visible"
    : "w-full max-w-full shrink-0 overflow-visible";

  const kinColumnInner = (
    <div className="flex max-h-max w-full min-w-0 flex-col items-stretch gap-[6px]">
          <div className="flex w-full shrink-0 min-w-0 flex-col" style={{ gap: 0 }}>
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
              className={kinOrnamentFrameClass}
              contentClassName="overflow-visible"
              contentStyle={{ padding: drawerKin ? "6px" : "3px" }}
            >
              <div className="flex min-h-0 w-full flex-col py-0 ao-p5-parchment-surface">
                <div
                  className={aoNokorCellClasses(false)}
                  style={{
                    width: "100%",
                    maxWidth: drawerKin ? "100%" : undefined,
                    paddingLeft: 0,
                    paddingRight: 0,
                  }}
                >
                  <div
                    className="flex w-full min-w-0 flex-col items-stretch transition-none translate-x-0 translate-y-0"
                    style={{
                      padding: 3,
                      maxWidth: drawerKin ? "100%" : undefined,
                    }}
                  >
                    <AoKinAvatarStack
                      face={
                        <AoP5FaceFrameMid
                          src="/personas/juci.png"
                          alt="ジュチ"
                          width={NOKOR_PORTRAIT_W_PX}
                          height={NOKOR_PORTRAIT_BOX_H_PX}
                          portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                        />
                      }
                      name="ジュチ"
                      nameplateFontSizePx={nameplateFontSizePx}
                      tightPadXPx={mobileDrawerNokorLayout ? undefined : AO_PC_NOKOR_TIGHT_PAD_X_PX}
                      captionRightTop={
                        <div className="min-w-0 text-left" style={lordCaptionPadStyle}>
                          <ruby className={lordCaptionMainClass}>
                            邦　主
                            <rt className={lordCaptionRtClass}>ウルス・ハン</rt>
                          </ruby>
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>
            </AoOrnamentalFrame>
          </div>

          <div className="flex w-full min-w-0 flex-col" style={{ gap: 0 }}>
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
              className={kinOrnamentFrameClass}
              contentClassName="overflow-visible"
              contentStyle={{ padding: drawerKin ? "6px" : "3px" }}
            >
              <div className="ao-p5-parchment-surface w-full">
                <AoNokorStripArea
                  activeNames={activeNames}
                  nameplateFontSizePx={nameplateFontSizePx}
                  mobileDrawer={mobileDrawerNokorLayout}
                  viewportCompact={viewportCompact}
                />
              </div>
            </AoOrnamentalFrame>
          </div>
        </div>
  );

  return (
    <div ref={measureRef} className="min-w-0 w-full max-w-full self-start">
      {drawerKin ? (
        <AoOrnamentalFrame
          className="relative flex max-h-max min-h-0 w-full max-w-full min-w-0 flex-col"
          style={{ boxSizing: "border-box", boxShadow: AO_DROP_SHADOW_MAIN_FRAME }}
          contentClassName="flex max-h-max min-w-0 w-full flex-col items-stretch"
        >
          {kinColumnInner}
        </AoOrnamentalFrame>
      ) : (
        <AoOrnamentalFrame
          className="relative flex max-h-max min-h-0 w-full max-w-full shrink-0 flex-col"
          style={{
            boxSizing: "border-box",
            boxShadow: AO_DROP_SHADOW_MAIN_FRAME,
          }}
          contentClassName="flex max-h-max min-w-0 w-full flex-col items-stretch"
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

function AoMainComposeTextarea({
  textareaRef,
  value,
  readOnly,
  composeLocked,
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
  fontSizePx,
  visualScale,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  readOnly: boolean;
  composeLocked: boolean;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  fontSizePx: number;
  /** 1 で縮小なし。コンパクト時のみ 1 未満を渡す */
  visualScale: number;
}) {
  const textarea = (
    <textarea
      ref={textareaRef}
      suppressHydrationWarning
      value={value}
      readOnly={readOnly}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      className={`box-border min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-none border-0 bg-transparent font-serif text-[#1a1208] outline-none ring-0 focus:ring-0 ${composeLocked ? "cursor-not-allowed opacity-60" : ""}`}
      style={{ padding: "0px", fontSize: fontSizePx }}
    />
  );

  if (visualScale >= 1) {
    return textarea;
  }

  const invPct = 100 / visualScale;
  return (
    <div className="h-full min-h-0 w-full overflow-hidden">
      <div
        className="flex h-full min-h-0 w-full flex-col"
        style={{
          transform: `scale(${visualScale})`,
          transformOrigin: "top left",
          width: `${invPct}%`,
          height: `${invPct}%`,
        }}
      >
        {textarea}
      </div>
    </div>
  );
}

/** スマホ：font-size 16px + scale で iOS 自動ズームを抑えつつ見た目サイズを維持 */
function AoMainTitleInput({
  inputRef,
  value,
  onChange,
  onBlur,
  visualFs,
  useCompactNoZoom,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  visualFs: number;
  useCompactNoZoom: boolean;
}) {
  /**
   * タイトル編集は scale ラッパーを使わない。
   * scale 付き 16px input だと iOS の選択ハイライトが親幅（≈ visualScale 倍）に切られ、
   * 一部だけ青反転する。表示ボタンと同じ visualFs で描画する。
   */
  const fontSizePx = visualFs;
  return (
    <input
      ref={inputRef}
      suppressHydrationWarning
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      style={{ fontSize: fontSizePx }}
      className={`min-h-0 w-full min-w-0 rounded-none border-0 bg-transparent py-0 text-center font-serif font-semibold leading-tight text-[#3D1C08] outline-none ring-0 placeholder:text-[#3D1C08]/45 focus:ring-0 ${useCompactNoZoom ? "px-0" : "px-2"}`}
    />
  );
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
  /** 年代記・論議事一覧：削除確認ポップアップ対象（ローカル thread id） */
  const [deleteConfirmThreadId, setDeleteConfirmThreadId] = useState<string | null>(null);
  const [deleteLogPopupTemplate, setDeleteLogPopupTemplate] = useState(AO_POPUP_DELETE_LOG_FALLBACK);
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AoMsgAttachment[]>([]);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingDotsPhase, setThinkingDotsPhase] = useState(0);
  /** 考え中: 1=現行ドット1行 / 2=1行目固定＋2行目ドット（最終 completion 想定） */
  const [thinkingUiPhase, setThinkingUiPhase] = useState<1 | 2>(1);
  const [isTyping, setIsTyping] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [rawPromptOverlay, setRawPromptOverlay] = useState<null | {
    variant: "ai" | "user";
    usage: MsgTurnUsage;
    completionMeta?: MsgChatCompletionMeta;
    rawPrompts?: MsgRawPromptBundle;
    attachments?: AoMsgAttachment[];
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
  /** 論タブごとに bust 済みか（A1: 初回のみ bust=1、以降はサーバキャッシュ） */
  const threadListBustedTopicsRef = useRef<Set<string>>(new Set());
  /** 典籍論：一覧から議事を選んだときだけ ao_messages を取得する */
  const gakkyuMessagesLoadThreadIdRef = useRef<string | null>(null);
  /** 議事一覧・令旨・年代記で別論を押した直前の論（戻るで復元） */
  const topicBeforeTopicOverlayRef = useRef<TopicUiId | null>(null);
  /** 設定・使用量を開く直前の論（戻るで復元。開中は論押下なし） */
  const topicBeforeSettingsUsageRef = useRef<TopicUiId | null>(null);
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
  const reijitsuOverlayRef = useRef<AoReijitsuOverlayHandle>(null);
  const [settingsSavePending, setSettingsSavePending] = useState(false);
  const [reijitsuSavePending, setReijitsuSavePending] = useState(false);
  const [personaCatalog, setPersonaCatalog] = useState<AoPersonaCatalog | null>(null);
  /** 議事オーバーレイ内テーブルのページ（0 始まり） */
  const [agendaPageIndex, setAgendaPageIndex] = useState(0);
  /** 令旨／年代記オーバーレイ内一覧のページ（0 始まり） */
  const [overlayListPageIndex, setOverlayListPageIndex] = useState(0);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);

  /** A2: 起動直後のクリティカルパスを避け、idle 後にペルソナ／削除確認テンプレを取得 */
  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadPersonas = () => {
      void (async () => {
        try {
          const res = await fetch("/api/settings/ao-personas");
          const data = (await res.json()) as {
            personas?: Array<{
              persona_key: string;
              name: string;
              alias: string;
              default_project_id: string;
              avatar_path: string;
            }>;
          };
          if (!res.ok || cancelled) return;
          setPersonaCatalog(buildAoPersonaCatalog(data.personas ?? []));
        } catch {
          if (!cancelled) setPersonaCatalog(null);
        }
      })();
    };

    const schedule = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(loadPersonas, { timeout: 3000 });
      } else {
        timeoutId = setTimeout(loadPersonas, 1500);
      }
    };

    schedule();
    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadDeleteLog = () => {
      void (async () => {
        try {
          const res = await fetch("/api/popup/delete_log");
          if (!res.ok || cancelled) return;
          const data = (await res.json()) as { template_text?: string };
          if (data.template_text?.trim()) setDeleteLogPopupTemplate(data.template_text);
        } catch {
          /* fallback template */
        }
      })();
    };

    const schedule = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(loadDeleteLog, { timeout: 4000 });
      } else {
        timeoutId = setTimeout(loadDeleteLog, 2000);
      }
    };

    schedule();
    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  const fetchThreadListWithTopic = useCallback(
    async (bust: boolean, topic: TopicUiId | null, signal?: AbortSignal) => {
      const pids = projectIdsForTopic(topic);
      if (!pids?.length) return;
      try {
        /** /api/threads/list は limit 最大 50。年代記に載るメタはここ経由のみのため、既定は上限に寄せる */
        const q = new URLSearchParams({ projects: pids.join(","), limit: "50", offset: "0" });
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
    const loaded = loadState();
    setState(focusStateOnTopic(loaded, selectedTopic ?? "heiba"));
  }, []);

  /** 論タブ変更時：表示中議事が論とずれていれば最新（またはブランク）へ合わせる */
  useEffect(() => {
    if (!selectedTopic) return;
    if (isGakkyuTopic(selectedTopic)) {
      setState((prev) => {
        const pids = projectIdsForTopic("gakkyu");
        if (!pids?.length) return prev;
        const cur = prev.threads.find((t) => t.id === prev.currentThreadId);
        if (cur && threadMatchesTopicProjectIds(cur, pids)) return prev;
        return focusStateOnGakkyuBlank(prev);
      });
      return;
    }
    setState((prev) => {
      const pids = projectIdsForTopic(selectedTopic);
      if (!pids?.length) return prev;
      const cur = prev.threads.find((t) => t.id === prev.currentThreadId);
      if (cur && threadMatchesTopicProjectIds(cur, pids)) return prev;
      return focusStateOnTopic(prev, selectedTopic);
    });
  }, [selectedTopic]);

  useEffect(() => {
    if (!isGakkyuTopic(selectedTopic)) {
      gakkyuMessagesLoadThreadIdRef.current = null;
    }
  }, [selectedTopic]);

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
    /** 典籍論は一覧から選んだ議事だけ DB（ao_messages）を読む */
    if (th.projectId === "notebook" && gakkyuMessagesLoadThreadIdRef.current !== th.id) {
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
          if (r.status === 404) {
            setState((p) =>
              applyRemoveThreadFromState(p, clientId, selectedTopicRef.current),
            );
            return;
          }
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
    if (!selectedTopic) return [];
    return threadsForTopicGiList(state.threads, selectedTopic);
  }, [state.threads, selectedTopic]);

  /** メイン右列：選択論の議事一覧（新規／過去ログテーブル用） */
  const ronSidebarThreads = useMemo(() => {
    if (!selectedTopic) return [];
    return threadsForTopicGiList(state.threads, selectedTopic);
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
    const topic = selectedTopic;
    if (isGakkyuTopic(topic)) return () => ac.abort();
    const topicKey = topic ?? "__none__";
    const pids = projectIdsForTopic(topic);
    const needBust = Boolean(topic && pids?.length && !threadListBustedTopicsRef.current.has(topicKey));
    if (needBust) threadListBustedTopicsRef.current.add(topicKey);
    void fetchThreadListWithTopic(needBust, topic, ac.signal);
    return () => ac.abort();
  }, [selectedTopic, fetchThreadListWithTopic]);

  useEffect(() => {
    if (threadListAfterChatNonce === 0) return;
    if (isGakkyuTopic(selectedTopicRef.current)) return;
    const ac = new AbortController();
    void fetchThreadListWithTopic(true, selectedTopicRef.current, ac.signal);
    return () => ac.abort();
  }, [threadListAfterChatNonce, fetchThreadListWithTopic]);

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

  function selectRonAgendaThread(t: Thread) {
    if (t.projectId === "notebook") {
      gakkyuMessagesLoadThreadIdRef.current = t.id;
    }
    setComposeLocked(false);
    setCurrentThread(t.id);
    const topic = topicUiIdForProjectId(t.projectId);
    if (topic) setSelectedTopic(topic);
    topicBeforeTopicOverlayRef.current = null;
    setRonListOverlayOpen(false);
    scheduleFocusMainPrompt();
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

  function restoreTopicFromBeforeTopicOverlay() {
    const restore = topicBeforeTopicOverlayRef.current;
    if (restore != null) {
      setSelectedTopic(restore);
      topicBeforeTopicOverlayRef.current = null;
    } else if (currentThread) {
      const fromThread = topicUiIdForProjectId(currentThread.projectId);
      if (fromThread) setSelectedTopic(fromThread);
    }
  }

  function restoreTopicFromBeforeSettingsUsage() {
    const restore = topicBeforeSettingsUsageRef.current;
    if (restore != null) {
      setSelectedTopic(restore);
      topicBeforeSettingsUsageRef.current = null;
    } else if (currentThread) {
      const fromThread = topicUiIdForProjectId(currentThread.projectId);
      if (fromThread) setSelectedTopic(fromThread);
    }
  }

  /** 設定・使用量を閉じ、開く前に選んでいた論を押下状態に戻す */
  function closeSettingsUsageOverlay() {
    setSettingsOpen(false);
    setUsageOpen(false);
    restoreTopicFromBeforeSettingsUsage();
    scheduleFocusMainPrompt();
  }

  function openSettingsOverlay() {
    setRonListOverlayOpen(false);
    closeMainSubOverlaysExceptRon();
    topicBeforeSettingsUsageRef.current = selectedTopicRef.current;
    setSelectedTopic(null);
    setSettingsOpen(true);
  }

  function openUsageOverlay() {
    setRonListOverlayOpen(false);
    closeMainSubOverlaysExceptRon();
    topicBeforeSettingsUsageRef.current = selectedTopicRef.current;
    setSelectedTopic(null);
    setUsageOpen(true);
  }

  function openChronicleOverlay() {
    setRonListOverlayOpen(false);
    setContextOpen(false);
    setUsageOpen(false);
    setSettingsOpen(false);
    topicBeforeTopicOverlayRef.current = null;
    setChronicleOpen(true);
    void fetchThreadListWithTopic(false, selectedTopicRef.current);
  }

  function openContextOverlay() {
    setRonListOverlayOpen(false);
    setChronicleOpen(false);
    setUsageOpen(false);
    setSettingsOpen(false);
    topicBeforeTopicOverlayRef.current = null;
    setContextOpen(true);
    void fetchThreadListWithTopic(false, selectedTopicRef.current);
  }

  /** 令旨・年代記オーバーレイを閉じ、未確定の論切替を戻す */
  function closeContextChronicleOverlay() {
    setContextOpen(false);
    setChronicleOpen(false);
    setRonListOverlayOpen(false);
    restoreTopicFromBeforeTopicOverlay();
    scheduleFocusMainPrompt();
  }

  /** 議事一覧オーバーレイを閉じ、新規／過去ログ未選択なら表示中議事の論タブへ戻す */
  function closeRonAgendaOverlay() {
    setContextOpen(false);
    setChronicleOpen(false);
    setSettingsOpen(false);
    setUsageOpen(false);
    setRonListOverlayOpen(false);
    restoreTopicFromBeforeTopicOverlay();
    scheduleFocusMainPrompt();
  }

  /** メイン帯オーバーレイ共通「戻る」 */
  function onMainOverlayBackClick() {
    if (showRonAgendaPanel) {
      closeRonAgendaOverlay();
      return;
    }
    if (settingsOpen || usageOpen) {
      closeSettingsUsageOverlay();
      return;
    }
    if (overlayMode) {
      closeContextChronicleOverlay();
      return;
    }
    setContextOpen(false);
    setChronicleOpen(false);
    setSettingsOpen(false);
    setUsageOpen(false);
    setRonListOverlayOpen(false);
    scheduleFocusMainPrompt();
  }

  function dismissSettingsUsageBeforeTopicNav() {
    if (!settingsOpen && !usageOpen) return;
    setSettingsOpen(false);
    setUsageOpen(false);
    restoreTopicFromBeforeSettingsUsage();
  }

  function topicRonLabelForThread(th: Thread, topic: TopicUiId | null): string {
    const tid = topicUiIdForProjectId(th.projectId);
    const id = tid ?? topic;
    if (!id) return "";
    return AO_TOPICS.find((t) => t.id === id)?.label ?? "";
  }

  /** DELETE /api/threads：404 は他端末等で既に消えている＝ローカル削除を続行 */
  function aoDeleteThreadApiSucceeded(res: Response): boolean {
    return res.ok || res.status === 404;
  }

  function applyRemoveThreadFromState(
    prev: AppState,
    threadId: string,
    topicForRefresh: TopicUiId | null,
  ): AppState {
    const removed = prev.threads.find((t) => t.id === threadId);
    const rest = prev.threads.filter((t) => t.id !== threadId);
    if (prev.currentThreadId !== threadId) {
      return { ...prev, threads: rest };
    }
    const deletedProjectId = removed?.projectId;
    const sameProject = rest.find((t) => t.projectId === deletedProjectId && !t.ephemeral);
    const fallback = sameProject ?? rest.find((t) => t.projectId === deletedProjectId) ?? rest[0];
    if (fallback) {
      return {
        ...prev,
        threads: rest,
        currentThreadId: fallback.id,
        currentProjectId: fallback.projectId,
      };
    }
    if (topicForRefresh) {
      return focusStateOnTopic({ ...prev, threads: rest }, topicForRefresh);
    }
    return {
      ...prev,
      threads: rest.length > 0 ? rest : prev.threads,
      currentThreadId: rest[0]?.id ?? prev.currentThreadId,
      currentProjectId: rest[0]?.projectId ?? prev.currentProjectId,
    };
  }

  function requestDeleteAoThread(threadId: string) {
    const th = state.threads.find((t) => t.id === threadId);
    if (!th || deletingThreadId) return;
    if (!isAoNativeThread(th)) {
      window.alert("取り込み済みの議事はここから削除できません。");
      return;
    }
    setDeleteConfirmThreadId(threadId);
  }

  async function deleteAoThread(threadId: string) {
    const th = state.threads.find((t) => t.id === threadId);
    if (!th || deletingThreadId) return;
    if (!isAoNativeThread(th)) {
      window.alert("取り込み済みの議事はここから削除できません。");
      return;
    }

    setDeleteConfirmThreadId(null);
    setDeletingThreadId(threadId);
    try {
      if (th.supabaseThreadId) {
        const res = await fetch(`/api/threads/${encodeURIComponent(th.supabaseThreadId)}`, {
          method: "DELETE",
        });
        if (!aoDeleteThreadApiSucceeded(res)) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          window.alert(data.error ?? `削除に失敗しました（${res.status}）`);
          return;
        }
      }

      const topicForRefresh = selectedTopicRef.current;
      const wasCurrent = state.currentThreadId === threadId;

      setState((prev) => applyRemoveThreadFromState(prev, threadId, topicForRefresh));

      if (wasCurrent) {
        setComposeLocked(false);
        clearComposeInput();
      }

      if (topicForRefresh) {
        void fetchThreadListWithTopic(false, topicForRefresh);
      }
    } finally {
      setDeletingThreadId(null);
    }
  }

  function onMainRonTabClick(topicId: TopicUiId) {
    const inChronicleOrReijitsu = Boolean(chronicleOpen || contextOpen);

    dismissSettingsUsageBeforeTopicNav();

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
      topicBeforeTopicOverlayRef.current = null;
      return;
    }

    if (inChronicleOrReijitsu) {
      if (prevSel !== topicId) {
        topicBeforeTopicOverlayRef.current = prevSel;
      }
      setSelectedTopic(topicId);
      if (isGakkyuTopic(topicId)) {
        gakkyuMessagesLoadThreadIdRef.current = null;
        setState((prev) => focusStateOnGakkyuBlank(prev));
        setComposeLocked(true);
        setRonListOverlayOpen(true);
      } else {
        setState((prev) => focusStateOnTopic(prev, topicId));
      }
      clearComposeInput();
      return;
    }

    closeMainSubOverlaysExceptRon();
    topicBeforeTopicOverlayRef.current = prevSel;
    if (isGakkyuTopic(topicId)) {
      gakkyuMessagesLoadThreadIdRef.current = null;
      setSelectedTopic(topicId);
      setState((prev) => focusStateOnGakkyuBlank(prev));
      clearComposeInput();
      setComposeLocked(true);
      setRonListOverlayOpen(true);
      return;
    }
    setSelectedTopic(topicId);
    setState((prev) => focusStateOnTopic(prev, topicId));
    clearComposeInput();
    setRonListOverlayOpen(false);
    scheduleFocusMainPrompt();
  }

  function clearComposeInput() {
    setDraft("");
    setPendingAttachments([]);
  }

  async function onComposePaste(e: ReactClipboardEvent<HTMLTextAreaElement>) {
    if (composeLocked || !currentThread || isThinking || isTyping) return;
    if (pendingAttachments.length >= AO_ATTACHMENT_MAX_COUNT) return;
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    const raw = latestClipboardFile(items);
    if (!raw) return;
    try {
      const att = await uploadChatAttachment(raw, currentThread.id);
      setPendingAttachments((prev) => {
        if (prev.length >= AO_ATTACHMENT_MAX_COUNT) return prev;
        return [...prev, att];
      });
    } catch (err) {
      console.error("[attach paste]", err);
    }
  }

  async function onAttachFilesSelected(files: FileList | null) {
    if (!files?.length || !currentThread || composeLocked) return;
    const room = AO_ATTACHMENT_MAX_COUNT - pendingAttachments.length;
    if (room <= 0) return;
    const slice = Array.from(files).slice(0, room);
    const added: AoMsgAttachment[] = [];
    for (const file of slice) {
      try {
        added.push(await uploadChatAttachment(file, currentThread.id));
      } catch (e) {
        console.error("[attach]", e);
      }
    }
    if (added.length) setPendingAttachments((prev) => [...prev, ...added]);
    if (attachInputRef.current) attachInputRef.current.value = "";
  }

  async function sendUserMessage() {
    const text = draft.trim();
    const attachments = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    if ((!text && !attachments?.length) || !currentThread || isThinking || isTyping || composeLocked) return;
    setDraft("");
    setPendingAttachments([]);
    const idx = state.threads.findIndex((t) => t.id === state.currentThreadId);
    if (idx < 0) return;
    const userMsg: Msg = {
      id: aoUid("m"),
      side: "user",
      speaker: "ジュチ",
      text: text || "(画像)",
      attachments,
      createdAt: Date.now(),
    };
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
    setThinkingUiPhase(1);
    setIsThinking(true);
    const streamSpeakerDefault = getPrimarySpeakerForProject(nextThread.projectId);
    let streamMsgIds: string[] = [];
    let sawStreamDelta = false;
    try {
      const history: Array<{
        role: "user" | "assistant";
        content: string;
        id?: string;
        speaker?: string;
        attachments?: AoMsgAttachment[];
      }> = [];
      for (const m of visibleMessages(nextThread.messages)) {
        if (m.side === "user") {
          history.push({ role: "user", content: m.text, id: m.id, attachments: m.attachments });
          continue;
        }
        // B: 表示用のメタ文言は次回リクエスト履歴に混ぜない
        if (isSyntheticAssistantNoiseForHistory(m.text)) continue;
        history.push({
          role: "assistant",
          content: m.text,
          id: m.id,
          speaker: m.speaker,
        });
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          projectId: nextThread.projectId,
          messages: history,
          clientThreadId: nextThread.id,
          threadTitle: resolvedTitle,
          supabaseThreadId: nextThread.supabaseThreadId ?? null,
          historyCompression: nextThread.historyCompression ?? null,
        }),
      });
      const data = await readChatSseDone(res, {
        onPhase: (phase) => {
          if (phase === "final_completion" && currentThreadIdRef.current === nextThread.id) {
            setThinkingUiPhase(2);
          }
        },
        onDelta: ({ content }) => {
          if (currentThreadIdRef.current !== nextThread.id) return;
          sawStreamDelta = true;
          setIsThinking(false);
          setIsTyping(true);
          const preview = previewAssistantStreamChunks(content, streamSpeakerDefault);
          const prevStreamIds = streamMsgIds;
          const nextIds: string[] = [];
          const streamMsgs: Msg[] = [];
          for (let i = 0; i < preview.length; i++) {
            const c = preview[i]!;
            const id = prevStreamIds[i] ?? aoUid("m");
            nextIds.push(id);
            streamMsgs.push({
              id,
              side: "ai",
              speaker: c.speaker || "不明",
              text: c.text,
              createdAt: Date.now(),
            });
          }
          streamMsgIds = nextIds;
          setTypingId(nextIds[nextIds.length - 1] ?? null);
          setState((prev) => {
            const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
            if (ti < 0) return prev;
            const kept = prev.threads[ti].messages.filter((m) => !prevStreamIds.includes(m.id));
            const nt = {
              ...prev.threads[ti],
              messages: [...kept, ...streamMsgs],
              updatedAt: Date.now(),
            };
            const aa = [...prev.threads];
            aa[ti] = nt;
            return { ...prev, threads: aa };
          });
        },
      });
      const chunks = data.chunks as Array<{ speaker: string; text: string }> | undefined;
      if (!chunks?.length) {
        const parts = [data.detail, data.error].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        throw new Error(parts.join(" — ").trim() || "chat error");
      }
      const supabaseThreadId =
        typeof data.supabaseThreadId === "string" ? data.supabaseThreadId : undefined;
      const historyCompressionRaw = data.historyCompression as
        | { fromMessageId?: string; summary?: string }
        | undefined;
      const historyCompression =
        typeof historyCompressionRaw?.fromMessageId === "string" &&
        typeof historyCompressionRaw?.summary === "string"
          ? {
              fromMessageId: historyCompressionRaw.fromMessageId,
              summary: historyCompressionRaw.summary,
            }
          : undefined;
      if (supabaseThreadId || historyCompression) {
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const aa = [...prev.threads];
          aa[ti] = {
            ...aa[ti],
            ...(supabaseThreadId ? { supabaseThreadId } : {}),
            ...(historyCompression ? { historyCompression } : {}),
          };
          return { ...prev, threads: aa };
        });
      }
      setIsThinking(false);
      setThinkingUiPhase(1);
      const batchAiIds: string[] = [];
      const turnRaw = normalizeRawPromptsFromApi(data.rawPrompts);
      const turnCompletionMeta = normalizeCompletionMetaFromApi(data.completionMeta);

      if (sawStreamDelta) {
        const finalIds: string[] = [];
        const finalMsgs: Msg[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i]!;
          const id = streamMsgIds[i] ?? aoUid("m");
          finalIds.push(id);
          batchAiIds.push(id);
          finalMsgs.push({
            id,
            side: "ai",
            speaker: c.speaker || "不明",
            text: c.text || "",
            createdAt: Date.now(),
            rawPrompts: turnRaw,
          });
        }
        const prevStreamIds = streamMsgIds;
        streamMsgIds = finalIds;
        setState((prev) => {
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const kept = prev.threads[ti].messages.filter((m) => !prevStreamIds.includes(m.id));
          const aa = [...prev.threads];
          aa[ti] = {
            ...aa[ti],
            messages: [...kept, ...finalMsgs],
            updatedAt: Date.now(),
          };
          return { ...prev, threads: aa };
        });
        setIsTyping(false);
        setTypingId(null);
      } else {
        setIsTyping(true);
        for (const c of chunks) {
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
      setThinkingUiPhase(1);
      setIsTyping(false);
      scheduleFocusMainPrompt();
    }
  }

  const overlayMode = contextOpen ? "context" : chronicleOpen ? "chronicle" : null;
  const isContextMode = overlayMode === "context";
  const anyMainOverlay = Boolean(overlayMode) || settingsOpen || usageOpen || ronListOverlayOpen;
  const showRonAgendaPanel = Boolean(ronListOverlayOpen && !overlayMode && !settingsOpen && !usageOpen);

  const deleteConfirmThread = useMemo(() => {
    if (!deleteConfirmThreadId) return null;
    return state.threads.find((t) => t.id === deleteConfirmThreadId) ?? null;
  }, [deleteConfirmThreadId, state.threads]);

  const deleteConfirmPopupMarkdown = useMemo(() => {
    if (!deleteConfirmThread) return null;
    const ron = topicRonLabelForThread(deleteConfirmThread, selectedTopic);
    const title = aoThreadTitleForList(deleteConfirmThread);
    const body = substituteAoPopupTemplateMarkdown(deleteLogPopupTemplate, {
      論: ron,
      議題: title,
    });
    return aoPopupMarkdownForBubble(body);
  }, [deleteConfirmThread, deleteLogPopupTemplate, selectedTopic]);

  const deleteConfirmKorguzKin = useMemo(() => {
    const p = NOKOR.find((n) => n.name === "コルグズ");
    if (!p) return null;
    return (
      <div
        className="flex w-fit min-w-0 flex-col items-stretch transition-none translate-x-0 translate-y-0"
        style={{
          paddingTop: 3,
          paddingBottom: 0,
          paddingLeft: 3,
          paddingRight: 0,
        }}
      >
        <AoKinAvatarStack
          face={
            <AoP5FaceFrameMid
              src={p.src}
              alt={p.name}
              width={NOKOR_PORTRAIT_W_PX}
              height={NOKOR_PORTRAIT_BOX_H_PX}
              portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
            />
          }
          name={p.name}
          nameplateFontSizePx={8}
          tightPadXPx={AO_PC_NOKOR_TIGHT_PAD_X_PX}
        />
      </div>
    );
  }, []);

  const showDeleteConfirmPopup = Boolean(
    deleteConfirmThread &&
    deleteConfirmPopupMarkdown &&
    deleteConfirmKorguzKin &&
    (overlayMode === "chronicle" || showRonAgendaPanel),
  );

  const overlayThreadsMaxPageIndex = useMemo(() => {
    if (!overlayMode) return 0;
    const n = topicThreads.length;
    return Math.max(0, Math.ceil(n / AGENDA_PAGE_SIZE) - 1);
  }, [overlayMode, topicThreads]);

  const overlayListPageIndexClamped = useMemo(() => {
    if (!overlayMode) return 0;
    return Math.min(overlayListPageIndex, overlayThreadsMaxPageIndex);
  }, [overlayMode, overlayListPageIndex, overlayThreadsMaxPageIndex]);

  const overlayThreadsSlice = useMemo(() => {
    if (!overlayMode) return [];
    const start = overlayListPageIndexClamped * AGENDA_PAGE_SIZE;
    return topicThreads.slice(start, start + AGENDA_PAGE_SIZE);
  }, [overlayMode, topicThreads, overlayListPageIndexClamped]);

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

  useEffect(() => {
    if (!overlayMode && !showRonAgendaPanel) setDeleteConfirmThreadId(null);
  }, [overlayMode, showRonAgendaPanel]);

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
  /** 議事チップ内（年代記・使用量・設定・令旨） */
  const compactGijiChipIconPx = Math.round(
    (viewportCompact ? 10 : 14) * AO_MAIN_TOOLBAR_ICON_SCALE,
  );
  /** スマホ：メインエリアの主要ボタンを約 25% 大きく */
  const compactGijiChipIconPxBig = viewportCompact ? Math.round(compactGijiChipIconPx * 1.25) : compactGijiChipIconPx;
  const compactReishiBtnMinH = viewportCompact
    ? Math.max(28, Math.round(REISHI_CHRONICLE_BTN_MIN_H_PX * 0.82))
    : REISHI_CHRONICLE_BTN_MIN_H_PX;
  const compactSpeechBubbleH = viewportCompact
    ? Math.round(MAIN_SPEECH_BUBBLE_H_PX * 0.88)
    : MAIN_SPEECH_BUBBLE_H_PX;
  const compactRonTabTopicFs = aoMainRonTabTopicFontPx(viewportCompact);
  const compactGijiTitleFs = viewportCompact ? Math.max(9, AO_GIJI_TITLE_FONT_PX - 3) : AO_GIJI_TITLE_FONT_PX;
  const compactMainTextareaFs = viewportCompact ? COMPACT_COMPOSE_INPUT_FS : 13;
  const compactMainTextareaVisualScale = viewportCompact ? COMPACT_COMPOSE_INPUT_VISUAL_SCALE : 1;
  const compactOrnamentalPadMid = viewportCompact ? "4px" : "6px";
  const compactOrnamentalPadTight = viewportCompact ? "2px" : "3px";
  /** 左・論タブ枠：装飾の内側パディングを詰め、flex 継承で縦伸びしないよう別値 */
  const ronListFrameInsetPx = viewportCompact ? 6 : 7;
  /** 羊皮紙ブロック内の追加余白（テキスト〜内縁） */
  const ronListParchmentPadStr = viewportCompact ? "2px 3px" : "3px 4px";
  const compactRonTitleChipH = viewportCompact ? 26 : 32;
  /** 令旨／年代記／設定／使用量サブページ帯の縦（論リストの実測に合わせる） */
  const ronSubpageBandPx = Math.max(28, Math.round(ronListPx ?? (viewportCompact ? 96 : 140)));

  const chatRowGap = MAIN_BUBBLE_ROW_GAP_PX;
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
      const bleed = viewportCompact ? COMPACT_COMPOSE_BOTTOM_BLEED_PX : 0;
      const h = Math.round(rb.bottom - wt.top + bleed);
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

  function attachmentsForUsageChip(side: "ai" | "user", m: Msg, thread: Thread | undefined): AoMsgAttachment[] | undefined {
    if (side === "user") return m.attachments;
    if (!thread) return undefined;
    const msgs = thread.messages;
    const idx = msgs.findIndex((x) => x.id === m.id);
    if (idx < 0) return undefined;
    for (let i = idx - 1; i >= 0; i--) {
      const row = msgs[i];
      if (row?.side === "user") return row.attachments;
    }
    return undefined;
  }

  function openRawPromptPopover(
    anchorBtn: HTMLElement,
    side: "ai" | "user",
    usage: MsgTurnUsage,
    rawPrompts?: MsgRawPromptBundle,
    anchorMsgId?: string,
    completionMeta?: MsgChatCompletionMeta,
    attachments?: AoMsgAttachment[],
  ) {
    const avatarRect = anchorBtn.getBoundingClientRect();
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
          attachments,
          left: box.left,
          top: box.top,
          panelWidthPx: box.width,
          panelHeightPx: box.height,
        });
        return;
      }
    }

    if (viewportCompact) {
      const row = anchorBtn.closest("[data-ao-chat-row]");
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
    setRawPromptOverlay({ variant: side, usage, completionMeta, rawPrompts, attachments, left, top });
  }

  const hydrateRawFromServerIfNeeded = useCallback(
    async (e: ReactMouseEvent<HTMLButtonElement>, side: "ai" | "user", m: Msg) => {
      /** await 後は SyntheticEvent の currentTarget が null になるため、同期で要素を保持 */
      const anchorBtn = e.currentTarget;
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
      const attachments = attachmentsForUsageChip(side, m, th);
      openRawPromptPopover(anchorBtn, side, usage, rawPrompts, m.id, completionMeta, attachments);
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
                viewportCompact
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
        className={`ao-header-safe-x relative shrink-0 grid grid-cols-[1fr_auto_1fr] items-center ${
          viewportCompact ? "min-h-0 gap-x-1.5 px-2 py-0.5" : "z-10 h-[58px] gap-3 px-4"
        }`}
        style={{
          background: AO_P5_PARCHMENT,
          ...(viewportCompact ? { zIndex: AO_Z_COMPACT_HEADER } : {}),
        }}
      >
        {/* 左: 消費銀バー（スマホは左上端） */}
        <div
          className={`flex min-w-0 items-center justify-self-start ${viewportCompact ? "gap-1" : "gap-1.5"}`}
        >
          <span className={`shrink-0 text-[#6A3F0A] ${viewportCompact ? "text-[9px]" : "text-[10px]"}`}>
            消費銀
          </span>
          <div
            className={`h-[7px] rounded border border-[#C9922A]/40 bg-[#F5EDD6] ${viewportCompact ? "min-w-[56px] max-w-[120px] flex-1" : "min-w-[120px] max-w-[220px] flex-1"}`}
          >
            <div className="h-full w-[72%] rounded bg-[#C9922A]" />
          </div>
        </div>
        {/* 中: ロゴ 3 種。360〜767 で min-[360]:block と md:hidden が競合しうるため、16 Pro は block + max-[359]:hidden + md:hidden で表す */}
        <div className="flex justify-center justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phase5/logo-se1.png"
            alt="Altan Orda"
            className="hidden max-[359px]:block h-[18px] w-auto max-w-[78vw] md:hidden"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/phase5/logo-16pro.png"
            alt="Altan Orda"
            className="block max-[359px]:hidden h-[18px] w-auto max-w-[78vw] md:hidden"
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
        {/* 右: 焼き印スタイルアイコンボタン（スマホは右上端） */}
        <div className={`flex items-center justify-self-end ${viewportCompact ? "gap-1" : "gap-1.5"}`}>
          <a
            className={`ao-seal-btn-p5 inline-flex items-center justify-center ${viewportCompact ? "ao-seal-btn-p5--compact" : ""}`}
            aria-label="ログイン"
            href="/api/ao-login"
          >
            <IcoLogin size={viewportCompact ? compactGijiChipIconPx : 15} />
          </a>
          <form action="/api/ao-logout" method="post" className="inline-flex" suppressHydrationWarning>
            <button
              type="submit"
              className={`ao-seal-btn-p5 ${viewportCompact ? "ao-seal-btn-p5--compact" : ""}`}
              aria-label="ログアウト"
            >
              <IcoLogout size={viewportCompact ? compactGijiChipIconPx : 15} />
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
          style={{
            top: kinDrawerAnchorBottomPx,
            zIndex: leftKinDrawerOpen ? AO_Z_COMPACT_KIN_DRAWER_OPEN : AO_Z_COMPACT_KIN_DRAWER_HOST,
          }}
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
                <AoLeftKinSideColumn
                  measureRef={leftColumnMeasureRef}
                  activeNames={activeNokorNames}
                  viewportCompact={viewportCompact}
                />
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
                ...(viewportCompact ? { zIndex: AO_Z_COMPACT_MAIN } : { zIndex: 20 }),
              }}
              contentClassName="flex shrink-0 flex-col min-w-0"
            >
            <main
              className={`ao-p5-parchment-surface relative box-border flex min-h-0 w-full shrink-0 flex-col min-w-0 ${viewportCompact ? "min-h-0 shrink-0 overflow-x-visible overflow-y-auto" : "overflow-visible"}`}
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
                  viewportCompact ? "min-w-0 flex-1 overflow-x-visible" : "min-w-0 flex-1 overflow-x-visible"
                }`}
              >
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
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
              <div
                className={`relative flex min-h-0 min-w-0 flex-1 flex-col self-stretch ${
                  viewportCompact ? "min-h-0" : ""
                }`}
              >
                {!anyMainOverlay ? (
                <>
                {/* タイトル行（右上：年代記／使用量／設定）＋吹き出し（右にユーザー） */}
                <div
                  className={`mt-0 flex min-h-0 min-w-0 flex-col ${viewportCompact ? "min-h-0 flex-1 overflow-x-visible overflow-y-visible" : "flex-1 overflow-visible"}`}
                  style={{
                    paddingTop: 0,
                    gap: viewportCompact ? 4 : 6,
                    paddingBottom: 0,
                    ...(!viewportCompact && ronListPx ? { height: `${Math.round(ronListPx)}px` } : null),
                  }}
                >
                  {viewportCompact ? (
                    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1">
                      <div
                        className="grid w-full min-w-0 shrink-0"
                        style={{
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          columnGap: MAIN_COMPOSE_AVATAR_GAP_PX,
                          alignItems: "center",
                        }}
                      >
                      <div className="min-w-0">
                      <AoOrnamentalFrame
                        scale={0.5}
                        contentInsetPx={GIJI_CHIP_ORNAMENT_INSET_PX}
                        className="w-full max-w-full overflow-visible"
                        contentClassName="overflow-visible"
                        contentStyle={{ padding: GIJI_TITLE_CHIP_COMPACT_ORNAMENT_CONTENT_PAD }}
                      >
                        <div
                          ref={titleChipParchmentRef}
                          className="ao-p5-parchment-surface box-border flex w-full min-h-0 items-center justify-center px-0"
                          style={{
                            minHeight: compactRonTitleChipH,
                            height: "auto",
                            paddingTop: GIJI_TITLE_CHIP_COMPACT_PARCHMENT_PAD_Y_PX,
                            paddingBottom: GIJI_TITLE_CHIP_COMPACT_PARCHMENT_PAD_Y_PX,
                          }}
                        >
                          {titleEditing && currentThread ? (
                            <AoMainTitleInput
                              inputRef={titleInputRef}
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
                              visualFs={compactGijiTitleFs}
                              useCompactNoZoom={viewportCompact}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setTitleDraft(currentThread?.title ?? "");
                                setTitleEditing(true);
                              }}
                              style={{ fontSize: compactGijiTitleFs }}
                              className="flex min-h-0 w-full min-w-0 items-center justify-center rounded-none border-0 bg-transparent px-0 py-0 text-center font-serif font-semibold leading-tight text-[#3D1C08]"
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
                            className={`${AO_MAIN_HEADER_ICON_BTN_CLASS} ${viewportCompact ? "p-1.5" : ""}`}
                            aria-label="年代記"
                            onClick={() => openChronicleOverlay()}
                          >
                            <span className="ao-p5-kurultai-ink-icon">
                              <IcoBook size={compactGijiChipIconPxBig} />
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`${AO_MAIN_HEADER_ICON_BTN_CLASS} ${viewportCompact ? "p-1.5" : ""}`}
                            aria-label="AI API 使用量を表示"
                            onClick={() => openUsageOverlay()}
                          >
                            <span className="ao-p5-kurultai-ink-icon">
                              <IcoCoinBag size={compactGijiChipIconPxBig} />
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`${AO_MAIN_HEADER_ICON_BTN_CLASS} ${viewportCompact ? "p-1.5" : ""}`}
                            aria-label="設定を開く"
                            onClick={() => openSettingsOverlay()}
                          >
                            <span className="ao-p5-kurultai-ink-icon">
                              <IcoGear size={compactGijiChipIconPxBig} />
                            </span>
                          </button>
                        </div>
                      </div>
                      </div>
                      <div
                        className="flex min-h-0 w-full min-w-0 flex-1 items-stretch"
                        style={mainComposeRowGridStyle()}
                      >
                      <div className="isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-visible pr-0">
                      <div
                        ref={compactTextareaWrapRef}
                        className="mr-0 flex min-h-0 min-w-0 w-full flex-1 flex-col"
                        style={{
                          minHeight: compactSpeechBubbleH,
                          maxHeight: composeTextareaHPx ?? undefined,
                          height: composeTextareaHPx ?? undefined,
                          flex: composeTextareaHPx != null ? "0 0 auto" : "1 1 0%",
                        }}
                      >
                        <AoP5NineSliceBubble
                          variant="user"
                          frameScale={0.5}
                          fillHeight
                          className="flex h-full min-h-0 w-full flex-1 overflow-hidden"
                          contentPadX={8}
                          contentPadY={6}
                          style={{
                            filter: "none",
                            minHeight: compactSpeechBubbleH,
                          }}
                        >
                          <AoComposeAttachments
                            pending={pendingAttachments}
                            onRemove={(path) =>
                              setPendingAttachments((prev) => prev.filter((a) => a.storagePath !== path))
                            }
                            className="mb-1 px-1"
                          />
                          <AoMainComposeTextarea
                            textareaRef={promptTextareaRef}
                            value={draft}
                            readOnly={composeLocked}
                            composeLocked={composeLocked}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (composeLocked) return;
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === "Enter" && e.metaKey) {
                                e.preventDefault();
                                void sendUserMessage();
                              }
                            }}
                            onPaste={(e) => void onComposePaste(e)}
                            placeholder={
                              composeLocked ? "過去ログ（年代記）表示中は入力できません" : undefined
                            }
                            fontSizePx={compactMainTextareaFs}
                            visualScale={compactMainTextareaVisualScale}
                          />
                        </AoP5NineSliceBubble>
                      </div>
                    </div>

                    <div
                      className="relative z-20 box-border flex min-w-0 flex-col items-center justify-end gap-0 self-stretch font-serif"
                      style={{
                        minHeight: compactSpeechBubbleH,
                        marginTop: 0,
                      }}
                    >
                      <div className="flex w-full justify-center">
                        <AoP5FaceFrameMid
                          src="/personas/juci.png"
                          alt="ジュチ"
                          width={NOKOR_PORTRAIT_W_PX}
                          height={JUCHI_PORTRAIT_BOX_H_PX}
                          portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                        />
                      </div>
                      <AoP5NameplateSmFrame
                        width={CHAT_NAMEPLATE_MIN_W_PX}
                        text="ジュチ"
                        {...MAIN_CHAT_NAMEPLATE_OPTS}
                      />
                      <div className="w-full text-center leading-tight">
                        <AoRubyGold
                          main="邦　主"
                          rt="ウルス・ハン"
                          mainClassName={MAIN_JUCHI_RUBY_MAIN_CLASS}
                          rtClassName="text-[8px] font-serif text-[#6A3F0A]/80"
                        />
                      </div>
                      <AoMainJuchiActions
                        attachInputRef={attachInputRef}
                        composeLocked={composeLocked}
                        pendingAttachmentCount={pendingAttachments.length}
                        onAttachSelected={(files) => void onAttachFilesSelected(files)}
                        onSend={() => void sendUserMessage()}
                        onOpenContext={() => openContextOverlay()}
                        iconSize={compactGijiChipIconPxBig}
                        sendBtnClass={AO_MAIN_SEND_BTN_CLASS}
                        iconBtnClass={AO_MAIN_ICON_BTN_CLASS}
                        compactPadding={viewportCompact}
                      />
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
                          {titleEditing && currentThread ? (
                            <AoMainTitleInput
                              inputRef={titleInputRef}
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
                              visualFs={compactGijiTitleFs}
                              useCompactNoZoom={viewportCompact}
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
                          className={`${AO_MAIN_HEADER_ICON_BTN_CLASS} ${viewportCompact ? "p-1.5" : ""}`}
                          aria-label="年代記"
                          onClick={() => openChronicleOverlay()}
                        >
                          <span className="ao-p5-kurultai-ink-icon">
                            <IcoBook size={compactGijiChipIconPxBig} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${AO_MAIN_HEADER_ICON_BTN_CLASS} ${viewportCompact ? "p-1.5" : ""}`}
                          aria-label="AI API 使用量を表示"
                          onClick={() => openUsageOverlay()}
                        >
                          <span className="ao-p5-kurultai-ink-icon">
                            <IcoCoinBag size={compactGijiChipIconPxBig} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${AO_MAIN_HEADER_ICON_BTN_CLASS} ${viewportCompact ? "p-1.5" : ""}`}
                          aria-label="設定を開く"
                          onClick={() => openSettingsOverlay()}
                        >
                          <span className="ao-p5-kurultai-ink-icon">
                            <IcoGear size={compactGijiChipIconPxBig} />
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 min-w-0 flex-1 pb-0" style={mainComposeRowGridStyle()}>
                    <div className="isolate flex min-h-0 min-w-0 flex-col overflow-visible pr-0">
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
                          <AoComposeAttachments
                            pending={pendingAttachments}
                            onRemove={(path) =>
                              setPendingAttachments((prev) => prev.filter((a) => a.storagePath !== path))
                            }
                            className="mb-1 px-1"
                          />
                          <AoMainComposeTextarea
                            textareaRef={promptTextareaRef}
                            value={draft}
                            readOnly={composeLocked}
                            composeLocked={composeLocked}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (composeLocked) return;
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === "Enter" && e.metaKey) {
                                e.preventDefault();
                                void sendUserMessage();
                              }
                            }}
                            onPaste={(e) => void onComposePaste(e)}
                            placeholder={
                              composeLocked ? "過去ログ（年代記）表示中は入力できません" : undefined
                            }
                            fontSizePx={compactMainTextareaFs}
                            visualScale={compactMainTextareaVisualScale}
                          />
                        </AoP5NineSliceBubble>
                      </div>
                    </div>

                    <div
                      className="relative z-20 box-border flex min-w-0 flex-col items-center gap-0 overflow-visible font-serif"
                      style={{
                        minHeight: viewportCompact ? compactSpeechBubbleH : MAIN_SPEECH_BUBBLE_H_PX,
                        marginTop: 0,
                      }}
                    >
                      <div className="flex w-full justify-center">
                        <AoP5FaceFrameMid
                          src="/personas/juci.png"
                          alt="ジュチ"
                          width={NOKOR_PORTRAIT_W_PX}
                          height={JUCHI_PORTRAIT_BOX_H_PX}
                          portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                        />
                      </div>
                      <AoP5NameplateSmFrame
                        width={CHAT_NAMEPLATE_MIN_W_PX}
                        text="ジュチ"
                        {...MAIN_CHAT_NAMEPLATE_OPTS}
                      />
                      <div className="w-full text-center leading-tight">
                        <AoRubyGold
                          main="邦　主"
                          rt="ウルス・ハン"
                          mainClassName={MAIN_JUCHI_RUBY_MAIN_CLASS}
                          rtClassName="text-[8px] font-serif text-[#6A3F0A]/80"
                        />
                      </div>
                      <AoMainJuchiActions
                        attachInputRef={attachInputRef}
                        composeLocked={composeLocked}
                        pendingAttachmentCount={pendingAttachments.length}
                        onAttachSelected={(files) => void onAttachFilesSelected(files)}
                        onSend={() => void sendUserMessage()}
                        onOpenContext={() => openContextOverlay()}
                        iconSize={compactGijiChipIconPxBig}
                        sendBtnClass={AO_MAIN_SEND_BTN_CLASS}
                        iconBtnClass={AO_MAIN_ICON_BTN_CLASS}
                        compactPadding={viewportCompact}
                      />
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
                    className={`pointer-events-auto absolute inset-x-0 top-0 z-[50] box-border flex min-h-0 flex-col ${showDeleteConfirmPopup ? "overflow-visible" : "overflow-hidden"}`}
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
                                    topicBeforeTopicOverlayRef.current = null;
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
                                  onClick={closeRonAgendaOverlay}
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
                            ) : overlayMode === "chronicle" ? (
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
                            ) : overlayMode === "context" ? (
                              <span className="px-1 text-[10px] font-semibold text-[#6A3F0A]/85">
                                {selectedTopic
                                  ? (AO_TOPICS.find((t) => t.id === selectedTopic)?.label ?? "")
                                  : ""}
                              </span>
                            ) : (
                              <span className="inline-block w-0 max-w-0 shrink-0 overflow-hidden" aria-hidden />
                            )}
                          </div>
                          <div className="flex min-w-0 shrink-0 items-center justify-end gap-0.5">
                            {isContextMode ? (
                              <button
                                type="button"
                                className={`${AO_AGENDA_NAV_BTN_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
                                aria-label={reijitsuSavePending ? "保存中" : "令旨を保存"}
                                disabled={reijitsuSavePending || !selectedTopic}
                                onClick={() => {
                                  void (async () => {
                                    if (!reijitsuOverlayRef.current) return;
                                    setReijitsuSavePending(true);
                                    try {
                                      await reijitsuOverlayRef.current.confirmSave();
                                    } finally {
                                      setReijitsuSavePending(false);
                                    }
                                  })();
                                }}
                              >
                                {reijitsuSavePending ? (
                                  <span className="whitespace-nowrap px-0.5 text-[9px] leading-none text-[#8D5400]">
                                    保存中…
                                  </span>
                                ) : (
                                  <IcoCheck size={14} />
                                )}
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
                              onClick={onMainOverlayBackClick}
                            >
                              <IcoArrowLeft size={14} className="shrink-0" />
                            </button>
                          </div>
                        </div>
                        )}
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 pb-0.5">
                          {isContextMode && selectedTopic ? (
                            <div
                              className="min-h-0 flex-1 overflow-y-auto border border-solid [scrollbar-gutter:stable] px-0.5 py-1"
                              style={{ borderColor: "#3D1C08", borderWidth: 1, backgroundColor: "rgba(255,250,240,0.35)" }}
                            >
                              <AoReijitsuOverlay
                                ref={reijitsuOverlayRef}
                                projectId={aoPostingProjectIdForTopic(selectedTopic)}
                                topicLabel={AO_TOPICS.find((t) => t.id === selectedTopic)?.label ?? ""}
                              />
                            </div>
                          ) : null}
                          {overlayMode === "chronicle" ? (
                            <div
                              className="min-h-0 flex-1 overflow-y-scroll border border-solid [scrollbar-gutter:stable]"
                              style={{ borderColor: "#3D1C08", borderWidth: 1, backgroundColor: "rgba(255,255,255,0.0)" }}
                            >
                              {topicThreads.length === 0 ? (
                                <>
                                  <div
                                    className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5 text-[11px] text-[#3D1C08]"
                                    style={{ borderColor: "#3D1C08" }}
                                  >
                                    <div />
                                    <div className="min-w-0 text-left">該当する議事はありません。</div>
                                    <div className="min-w-[52px] shrink-0 text-center text-[11px] leading-tight text-[#c2cad6]" />
                                    <div className="min-w-[108px] shrink-0 pr-[20px] text-right" />
                                  </div>
                                  {Array.from({ length: Math.max(0, AGENDA_PAGE_SIZE - 1) }).map((_, i) => (
                                    <div
                                      key={`sub-empty-row-${i}`}
                                      className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5"
                                      style={{ borderColor: "#3D1C08", minHeight: 18 }}
                                    >
                                      <div />
                                      <div />
                                      <div className="min-w-[52px] shrink-0" />
                                      <div className="min-w-[108px] shrink-0 pr-[20px]" />
                                    </div>
                                  ))}
                                </>
                              ) : (
                                overlayThreadsSlice.map((t) => (
                                  <div
                                    key={t.id}
                                    className="group/row grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-0 border-b px-2 py-0.5 text-left text-[11px] hover:bg-[#143d5e]/60"
                                    style={{ borderColor: "#3D1C08" }}
                                  >
                                    <div className="flex items-center justify-center">
                                      {isAoNativeThread(t) ? (
                                        <button
                                          type="button"
                                          className={AO_AGENDA_NAV_BTN_CLASS}
                                          aria-label={`議事「${aoThreadTitleForList(t)}」を削除`}
                                          disabled={deletingThreadId === t.id}
                                          onClick={() => requestDeleteAoThread(t.id)}
                                        >
                                          <IcoTrash size={12} />
                                        </button>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      className="min-w-0 truncate border-0 bg-transparent p-0 text-left text-[#3D1C08] outline-none group-hover/row:underline"
                                      onClick={() => {
                                        setCurrentThread(t.id);
                                        setComposeLocked(true);
                                        const topic = topicUiIdForProjectId(t.projectId);
                                        if (topic) setSelectedTopic(topic);
                                        topicBeforeTopicOverlayRef.current = null;
                                      }}
                                    >
                                      {aoThreadTitleForList(t)}
                                    </button>
                                    <span className="min-w-[52px] shrink-0 whitespace-nowrap text-center text-[11px] leading-tight text-[#6A3F0A]/80">
                                      {threadSourceProviderUlusLabel(t.sourceProvider)}
                                    </span>
                                    <span className="min-w-0 shrink-0 whitespace-nowrap pr-[20px] text-right text-[11px] leading-tight text-[#6A3F0A]/80 tabular-nums">
                                      {formatDate(t.updatedAt)}
                                    </span>
                                  </div>
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
                                        selectRonAgendaThread(t);
                                      }}
                                    >
                                      <td className="w-[28px] px-0.5 py-0.5">
                                        <button
                                          type="button"
                                          className={AO_AGENDA_NAV_BTN_CLASS}
                                          aria-label={`議事「${aoThreadTitleForList(t)}」を削除`}
                                          disabled={deletingThreadId === t.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            requestDeleteAoThread(t.id);
                                          }}
                                        >
                                          <IcoTrash size={12} />
                                        </button>
                                      </td>
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
                              onClose={closeSettingsUsageOverlay}
                            />
                          ) : null}
                          {usageOpen ? (
                            <AoUsageOverlay
                              embedded
                              open={usageOpen}
                              onClose={closeSettingsUsageOverlay}
                            />
                          ) : null}
                        </div>
                      </div>
                    </AoOrnamentalFrame>
                    {showDeleteConfirmPopup && deleteConfirmPopupMarkdown && deleteConfirmKorguzKin ? (
                      <AoDeleteConfirmPopup
                        kinColumn={deleteConfirmKorguzKin}
                        messageMarkdown={deleteConfirmPopupMarkdown}
                        frameInsetPx={ronListFrameInsetPx}
                        parchmentPadStr={ronListParchmentPadStr}
                        confirmDisabled={Boolean(deletingThreadId)}
                        onCancel={() => setDeleteConfirmThreadId(null)}
                        onConfirm={() => {
                          if (deleteConfirmThreadId) void deleteAoThread(deleteConfirmThreadId);
                        }}
                      />
                    ) : null}
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
              style={viewportCompact ? { zIndex: AO_Z_COMPACT_CHAT } : { zIndex: 10 }}
            >
            <div
              ref={messagesRef}
              className="relative z-10 min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
              style={{
                paddingLeft: CHAT_AREA_PAD_X_PX,
                paddingRight: CHAT_AREA_PAD_RIGHT_PX,
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
                  const { label, avatarSrc } = aiSpeakerUi(currentThread, m, personaCatalog);

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
                          height={NOKOR_PORTRAIT_BOX_H_PX}
                          portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                        />
                      </button>
                    );
                    return (
                      <div
                        key={m.id}
                        data-ao-chat-row
                        data-ao-chat-side="ai"
                        data-ao-msg-id={m.id}
                        className="flex w-full items-start"
                        style={{ gap: chatRowGap }}
                      >
                        <div className="flex shrink-0 flex-col items-stretch gap-0 font-serif">
                          <AoChatAiAvatarStack face={avatarBtn} label={label} />
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
                        height={NOKOR_PORTRAIT_BOX_H_PX}
                        portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                      />
                    </button>
                  );
                  return (
                    <div
                      key={m.id}
                      data-ao-chat-row
                      data-ao-chat-side="user"
                      data-ao-msg-id={m.id}
                      className="grid w-full min-w-0 max-w-full items-start"
                      style={mainComposeRowGridStyle()}
                    >
                      <div
                        data-ao-chat-bubble
                        className="flex min-h-0 min-w-0 flex-col items-end justify-end overflow-visible"
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
                            <>
                              <AoMessageMarkdown text={msgTextForUi(currentThread, m)} />
                              {m.attachments?.length ? (
                                <AoMessageAttachments attachments={m.attachments} />
                              ) : null}
                            </>
                          )}
                        </AoP5NineSliceBubble>
                      </div>
                      <div className="relative z-20 box-border flex min-w-0 flex-col items-center gap-0 font-serif">
                        <div className="flex w-full justify-center">{userAvatarBtn}</div>
                        <div className="flex w-full justify-center">
                          <AoP5NameplateSmFrame
                            width={CHAT_NAMEPLATE_MIN_W_PX}
                            text="ジュチ"
                            {...MAIN_CHAT_NAMEPLATE_OPTS}
                          />
                        </div>
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
                      const thinkingUi = aoThinkingSpeakerUi(currentThread, personaCatalog);
                      return (
                        <>
                          <div className="flex shrink-0 flex-col items-stretch gap-0 font-serif">
                            <AoChatAiAvatarStack
                              face={
                                <AoP5FaceFrameMid
                                  src={thinkingUi.avatarSrc}
                                  alt={thinkingUi.label}
                                  width={NOKOR_PORTRAIT_W_PX}
                                  height={NOKOR_PORTRAIT_BOX_H_PX}
                                  portraitScale={AO_MAIN_CHAT_FACE_PORTRAIT_SCALE}
                                />
                              }
                              label={thinkingUi.label}
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
                              <span
                                className="ao-thinking-dots-text font-serif tabular-nums whitespace-pre-wrap"
                                style={{ color: AO_CHAT_AI_BUBBLE_FG, minHeight: "1.25em", minWidth: "2ch" }}
                              >
                                {thinkingUiPhase === 1 ? (
                                  thinkingDotsText
                                ) : (
                                  <>
                                    ....{"\n"}
                                    {thinkingDotsText}
                                  </>
                                )}
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
                  }}
                >
                  <div
                    className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden"
                    style={{
                      fontSize: RAW_POPOVER_FS_CHIP_PX,
                      lineHeight: 1.35,
                      maxHeight:
                        rawPromptOverlay.panelWidthPx != null && rawPromptOverlay.panelHeightPx != null
                          ? "100%"
                          : RAW_POPOVER_MAX_H_SCROLL,
                      minHeight: 0,
                    }}
                  >
                    <AoUsageChipPanel
                      usage={rawPromptOverlay.usage}
                      completionMeta={rawPromptOverlay.completionMeta}
                      rawPrompts={rawPromptOverlay.rawPrompts}
                      attachments={rawPromptOverlay.attachments}
                      resolveUsd={aoResolveUsdForOverlay}
                      onOpenSent={
                        rawPromptOverlay.rawPrompts
                          ? () =>
                              openRawHtmlInNewTab(
                                "AO Raw — 送信全文",
                                rawPromptOverlay.rawPrompts!.sent,
                              )
                          : undefined
                      }
                      onOpenReceived={
                        rawPromptOverlay.rawPrompts
                          ? () =>
                              openRawHtmlInNewTab(
                                "AO Raw — モデル応答全文",
                                rawPromptOverlay.rawPrompts!.received,
                              )
                          : undefined
                      }
                    />
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

