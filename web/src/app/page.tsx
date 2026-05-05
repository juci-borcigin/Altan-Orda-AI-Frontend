"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
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
import { IcoArrowLeft, IcoBook, IcoCoinBag, IcoExecute, IcoGear, IcoScroll } from "@/components/ao-action-icons";
import { AoMessageMarkdown } from "@/components/AoMessageMarkdown";
import { AoSettingsOverlay } from "@/components/AoSettingsOverlay";
import { AoUsageOverlay } from "@/components/AoUsageOverlay";
import { runTypewriter } from "@/lib/ao-typewriter";
import {
  type AppState,
  type Msg,
  type MsgTurnUsage,
  type Thread,
  aoUid,
  describeAppStateCoreRejection,
  isAppStateCore,
  makeDefaultAppState,
  parseAppStateJson,
  pruneEphemeralEmptyThreads,
} from "@/lib/ao-state";
import { displayTextForClaudeImportedAssistant } from "@/lib/ao-claude-display-text";
import { AoAiBubbleUsageTooltip } from "@/components/AoAiBubbleUsageTooltip";

const STORAGE_KEY = "ao_state_v1";
/** メイン枠左上：使用量・設定アイコン寸法（歯車は以前の 150% 相当） */
const MAIN_HEADER_ICON_PX = 18;
/** メイン左上アイコン：枠なし・クリック時はわずかに縮小 */
const AO_MAIN_ICON_BTN_CLASS =
  "rounded-none border-0 bg-transparent p-1 text-[#DBB961] outline-none transition-[transform,opacity,filter] hover:brightness-110 active:scale-[0.88] active:opacity-90";

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
/** 顔グラ画像のみへ適用（親に filter を付けると子の text-shadow が潰れることがある） */
const AO_CHAT_AVATAR_DROP_SHADOW_FILTER = "drop-shadow(1px 1px 1px rgba(236,224,200,0.85))";

/**
 * 僚友レイアウト（内側から決定）→ ⑤ をメインカラム幅にする。
 * ① 顔グラの幅
 * ② 名下バンド幅＝全角8文字分（想定1文字幅 × 8）
 * ③ 顔グラ同士の見かけの間隔：②が①より広いとき列内の左右余白として自然に発生
 * ④ max(①,②) ＋ 横パディング ＝ 1人分の列幅
 * ⑤ ④ × 8 ＝ 僚友帯全体幅 ＝ メインカラム固定幅（中央「3」）
 */
const NOKOR_PORTRAIT_W_PX = 52;
/** 令旨／年代記：従来 min-h-[52px] の 66％ */
const REISHI_CHRONICLE_BTN_MIN_H_PX = Math.round(52 * 0.66);
/** ≫ 送信：令旨と同系見た目だが縦は約33％（52px×0.33） */
const JUCHI_SEND_BTN_MIN_H_PX = Math.round(52 * 0.33);
/** 論タブ：字サイズ（style）／パディングは選択時 translate 用に若干広め */
const AO_RON_TAB_FONT_PX = 14;
const AO_RON_TAB_PAD_X_PX = 7;
const AO_RON_TAB_PAD_Y_PX = 4;
/** 名下など「8文字分」の換算用（全角想定・調整はこの値のみで可） */
const NOKOR_NAME_EM_W_PX = 10;
const NOKOR_NAME_MAX_CHARS = 8;
const NOKOR_TEXT_BAND_W_PX = NOKOR_NAME_EM_W_PX * NOKOR_NAME_MAX_CHARS;
const NOKOR_COL_PAD_X_PX = 4;
const NOKOR_COL_INNER_W_PX = Math.max(NOKOR_PORTRAIT_W_PX, NOKOR_TEXT_BAND_W_PX);
const NOKOR_COL_W_PX = NOKOR_COL_INNER_W_PX + NOKOR_COL_PAD_X_PX * 2;

/** 顔グラ：縦5・横4 → CSS aspect-ratio は width/height = 4/5 */
const NOKOR_PORTRAIT_ASPECT_CLASS = "aspect-[4/5]";

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

/** ⑤ 僚友帯の論理幅（px） */
const NOKOR_STRIP_W_PX = NOKOR_COL_W_PX * NOKOR.length;
/** 僚友：下側枠外を旧 pb-1 の40%。内枠 margin は旧 3px の40%を縦のみ（横ははみ出し防止で 0） */
const NOKOR_AREA_OUTER_PAD_BOTTOM_BEFORE_PX = 4; /* 旧 pb-1 */
const NOKOR_AREA_OUTER_PAD_BOTTOM_PX = Math.round(NOKOR_AREA_OUTER_PAD_BOTTOM_BEFORE_PX * 0.4);
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
/** 下枠が main/section のスクロール／ズームで欠けるのを防ぐ外ラッパー床側の余白 */
const NOKOR_AREA_BOTTOM_SAFE_PX = 18;
/** ④ 吹き出し〜僚友：中段 pad が底まで詰まっている場合でも詰めるため、内枠上マージンから削る */
const NOKOR_INNER_FRAME_MARGIN_TOP_SHRINK_PX = 1;
/** メイン列の内側パディング（MAIN_COLUMN_W_PX 算出と main の padding で共通） */
const MAIN_COLUMN_PAD_PX = 5;
const MAIN_COLUMN_W_PX = NOKOR_STRIP_W_PX + MAIN_COLUMN_PAD_PX * 2;
/** メイン中段の横パディング（px-3）— チャット吹き出し幅をメインと揃える */
const MAIN_MIDDLE_SECTION_PAD_X_PX = 12;
const MAIN_BUBBLE_ROW_GAP_PX = 10;
const MAIN_BUBBLE_TEXTAREA_ML_PX = 8;
/** 令旨／年代記列の参照幅（実装とずれたらこの値のみ調整） */
const MAIN_LEFT_TOOLS_COL_W_PX = 80;
const CHAT_SECTION_CONTENT_INNER_W_PX = MAIN_COLUMN_W_PX - 2 * (MAIN_COLUMN_PAD_PX + MAIN_MIDDLE_SECTION_PAD_X_PX);
const CHAT_BUBBLE_INNER_W_PX =
  CHAT_SECTION_CONTENT_INNER_W_PX -
  MAIN_LEFT_TOOLS_COL_W_PX -
  MAIN_BUBBLE_ROW_GAP_PX -
  MAIN_BUBBLE_TEXTAREA_ML_PX -
  MAIN_BUBBLE_ROW_GAP_PX -
  NOKOR_COL_W_PX;

/** チャット履歴吹き出しの最小高さ（約1行＋パディング。入力欄の MAIN_SPEECH_BUBBLE_H_PX は別） */
const CHAT_HISTORY_BUBBLE_MIN_H_PX = Math.ceil(13 * 1.42) + 8;

/** 論〜メイン枠の上側・論〜議事タイトルは別途 GIKUJI_* */
const MAIN_OUTER_TOP_GAP_BEFORE_PX = 3;
const MAIN_OUTER_TOP_GAP_PX = Math.round(MAIN_OUTER_TOP_GAP_BEFORE_PX * 0.3);
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
const GIKUJI_MID_BLOCK_PAD_BOTTOM_PX = Math.max(
  0,
  GIKUJI_MID_BLOCK_PAD_BOTTOM_BEFORE_PX - GIKUJI_MID_BLOCK_PAD_BOTTOM_SHRINK_TOTAL_PX - 1,
);

/** 図②-2: ヘッダ下の「メイン部」固定高（変更しない） */
const MAIN_TOP_FIXED_H_PX = 360;
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

let storageWarned = false;

function visibleMessages(messages: Msg[]) {
  return messages.filter((m) => !m.hiddenFromUi);
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

function loadState(): AppState {
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
    "rounded-none box-border flex shrink-0 flex-col items-center gap-[3px] py-[3px] transition-none bg-transparent font-serif border border-transparent";
  if (active) return `${base} ${AO_PUSH_INSET_NOKOR_ACTIVE}`;
  return `${base}`;
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
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  /** 初期議事が兵馬論（work）に合わせる */
  const [selectedTopic, setSelectedTopic] = useState<TopicUiId | null>("heiba");
  const [postMenuTopicId, setPostMenuTopicId] = useState<TopicUiId | null>(null);
  /** 年代記オーバーレイから議事を開いたあとはメイン入力をロックする（投稿メニュー等で解除） */
  const [composeLocked, setComposeLocked] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [contextChecks, setContextChecks] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);

  const lastSavedRef = useRef(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const postMenuAnchorRef = useRef<HTMLDivElement | null>(null);
  const currentThreadIdRef = useRef<string | null>(null);
  const selectedTopicRef = useRef<TopicUiId | null>(selectedTopic);
  const composeLockedRef = useRef(composeLocked);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    setMounted(true);
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/state");
        if (cancelled) return;
        if (r.ok) {
          const data = (await r.json()) as { state?: unknown; error?: string };
          if (data.error) console.error("[ao] /api/state:", data.error);
          if (data.state && isAppStateCore(data.state)) {
            setState(data.state);
            saveState(data.state);
            return;
          }
          if (data.state) console.error(describeAppStateCoreRejection(data.state));
        }
      } catch {}
      if (!cancelled) setState(loadState());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const t = Date.now();
    if (t - lastSavedRef.current < 400) return;
    lastSavedRef.current = t;
    saveState(state);
  }, [state]);

  const currentThread = useMemo(() => {
    if (!state) return null;
    return state.threads.find((t) => t.id === state.currentThreadId) ?? null;
  }, [state]);
  const topicProjectIds = useMemo(() => projectIdsForTopic(selectedTopic), [selectedTopic]);

  function toggleTopic(id: TopicUiId) {
    setComposeLocked(false);
    setSelectedTopic((prev) => (prev === id ? null : id));
  }
  const activeNokorNames = useMemo(() => activeNokorNamesForTopic(selectedTopic), [selectedTopic]);

  const topicThreads = useMemo(() => {
    if (!state || !topicProjectIds?.length) return [];
    const allow = new Set(topicProjectIds);
    return state.threads
      .filter((t) => allow.has(t.projectId) && !t.ephemeral)
      .sort(compareThreadsForGiList);
  }, [state, topicProjectIds]);

  const postMenuThreads = useMemo(() => {
    if (!state || !postMenuTopicId) return [];
    return aoThreadsForPostMenu(state.threads, postMenuTopicId);
  }, [state, postMenuTopicId]);

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

  useLayoutEffect(() => {
    scrollChatPaneToBottom();
  }, [chatScrollSignature]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pane = messagesRef.current;
      if (pane) pane.scrollTop = pane.scrollHeight;
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
    currentThreadIdRef.current = state?.currentThreadId ?? null;
  }, [state?.currentThreadId]);

  useEffect(() => {
    selectedTopicRef.current = selectedTopic;
  }, [selectedTopic]);

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

  useEffect(() => {
    if (!postMenuTopicId) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = postMenuAnchorRef.current;
      if (el && !el.contains(e.target as Node)) {
        setPostMenuTopicId(null);
        setSelectedTopic(null);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [postMenuTopicId]);

  function setCurrentThread(threadId: string) {
    setState((prev) => {
      if (!prev) return prev;
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

  function onMainRonTabClick(topicId: TopicUiId) {
    const prevSel = selectedTopicRef.current;
    setComposeLocked(false);

    if (topicId === "koukan") {
      setPostMenuTopicId(null);
      setSelectedTopic(topicId);
      setState((prev) => {
        if (!prev) return prev;
        const pruned = prevSel !== topicId ? pruneEphemeralEmptyThreads(prev) : prev;
        const pid = aoPostingProjectIdForTopic("koukan");
        const candidates = pruned.threads.filter((t) => t.projectId === pid && isAoNativeThread(t));
        const sorted = [...candidates].sort((a, b) => b.updatedAt - a.updatedAt);
        let th = sorted[0];
        let threads = pruned.threads;
        if (!th) {
          th = createAoThreadForTopic("koukan");
          threads = [th, ...threads];
        }
        const idx = threads.findIndex((t) => t.id === th.id);
        const arr = [...threads];
        arr[idx] = { ...arr[idx], title: "" };
        return {
          ...pruned,
          threads: arr,
          currentThreadId: th.id,
          currentProjectId: pid,
        };
      });
      setDraft("");
      return;
    }

    setPostMenuTopicId((prev) => (prev === topicId ? null : topicId));
    setSelectedTopic(topicId);
    if (prevSel !== topicId) {
      setState((prev) => (prev ? pruneEphemeralEmptyThreads(prev) : prev));
    }
  }

  async function sendUserMessage() {
    const text = draft.trim();
    if (!text || !state || !currentThread || isThinking || isTyping || composeLocked) return;
    setDraft("");
    const idx = state.threads.findIndex((t) => t.id === state.currentThreadId);
    if (idx < 0) return;
    const userMsg: Msg = { id: aoUid("m"), side: "user", speaker: "ジュチ", text, createdAt: Date.now() };
    const th = state.threads[idx];
    const firstLine = text.split("\n")[0].trim().slice(0, 500);
    const isKoukan = selectedTopicRef.current === "koukan";
    const resolvedTitle = isKoukan ? firstLine || "巷間論" : th.title.trim() || firstLine || "議事";
    const { ephemeral: _dropEphemeral, ...thPersist } = th;
    const nextThread: Thread = {
      ...thPersist,
      title: isKoukan ? "" : th.title.trim() ? th.title : resolvedTitle,
      messages: [...th.messages, userMsg],
      updatedAt: Date.now(),
    };
    const arr = [...state.threads];
    arr[idx] = nextThread;
    setState({ ...state, threads: arr });
    setIsThinking(true);
    try {
      const history = visibleMessages(nextThread.messages).map((m) => ({ role: m.side === "user" ? "user" : "assistant", content: m.text }));
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
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.chunks) {
        const parts = [data.detail, data.error].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        throw new Error(parts.join(" — ").trim() || "chat error");
      }
      if (data.supabaseThreadId) {
        setState((prev) => {
          if (!prev) return prev;
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
      for (const c of data.chunks) {
        const msgId = aoUid("m");
        batchAiIds.push(msgId);
        const shell: Msg = { id: msgId, side: "ai", speaker: c.speaker || "不明", text: "", createdAt: Date.now() };
        setState((prev) => {
          if (!prev) return prev;
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
            if (!prev) return prev;
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
      const turnUsage = data.usage;
      if (turnUsage && batchAiIds.length > 0) {
        setState((prev) => {
          if (!prev) return prev;
          const ti = prev.threads.findIndex((t) => t.id === nextThread.id);
          if (ti < 0) return prev;
          const msgs = [...prev.threads[ti].messages];
          for (const id of batchAiIds) {
            const mi = msgs.findIndex((x) => x.id === id);
            if (mi >= 0) msgs[mi] = { ...msgs[mi], usage: turnUsage };
          }
          const aa = [...prev.threads];
          aa[ti] = { ...aa[ti], messages: msgs, updatedAt: Date.now() };
          return { ...prev, threads: aa };
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTypingId(null);
      setIsThinking(false);
      setIsTyping(false);
      scheduleFocusMainPrompt();
    }
  }

  if (!mounted) return <main className="h-screen" style={{ backgroundColor: AO_MAIN_BG }} />;
  const overlayMode = contextOpen ? "context" : chronicleOpen ? "chronicle" : null;
  const isContextMode = overlayMode === "context";
  const anyMainOverlay = Boolean(overlayMode) || settingsOpen || usageOpen;

  return (
    <div className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[var(--ao-navy)] text-[var(--ao-white)]">

      <header className="relative z-10 grid h-[58px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b-2 border-[var(--ao-gold)] bg-[var(--ao-navy)] px-4">
        <div className="flex min-w-0 items-center gap-2 justify-self-start">
          <span className="shrink-0 text-[10px] text-[var(--ao-gold-l)]">消費銀</span>
          <div className="h-[8px] min-w-[120px] max-w-[220px] flex-1 rounded border border-[var(--ao-gold-dim)] bg-[#10263f]">
            <div className="h-full w-[72%] rounded bg-[var(--ao-gold)]" />
          </div>
        </div>
        <div className="justify-self-center">
          <Image src="/phase4/top-logo.png" alt="Altan Orda" width={220} height={48} className="h-[40px] w-auto object-contain" priority />
        </div>
        <div className="flex items-center gap-2 justify-self-end">
          <input readOnly placeholder="諜報…（準備中）" className="h-[28px] w-[128px] rounded border border-[var(--ao-gold-dim)] bg-white/95 px-2 text-[11px] text-[#1a1208] placeholder:text-[#5c4830]" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* ①-2 ヘッダより下全体: 白地 + 地図60% */}
        <div className="pointer-events-none absolute inset-0 bg-white" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: "url('/phase4/map-mongolia.png')" }}
          aria-hidden
        />

        {/* ②-1 左:中:右 = 2:3:2 */}
        <div className="relative z-10 grid h-full min-h-0 grid-cols-[2fr_3fr_2fr] overflow-x-hidden overflow-y-auto">
          <aside className="min-h-0" aria-hidden />

          <div
            className="min-h-0 box-border flex flex-col items-center"
            style={{ paddingTop: MAIN_OUTER_TOP_GAP_PX, gap: MAIN_COLUMN_STACK_GAP_PX }}
          >
            <div
              className="relative flex shrink-0 flex-col"
              style={{ width: MAIN_COLUMN_W_PX, boxShadow: AO_DROP_SHADOW_MAIN_FRAME }}
            >
            <main
              className="relative box-border flex min-h-0 w-full shrink-0 flex-col overflow-hidden"
              style={{
                backgroundColor: AO_MAIN_BG,
                /* メイン部：論〜入力〜僚友をこの固定高に収める（令旨オーバーレイはこの箱内） */
                height: MAIN_TOP_FIXED_H_PX,
                minHeight: MAIN_TOP_FIXED_H_PX,
                maxHeight: MAIN_TOP_FIXED_H_PX,
                paddingLeft: MAIN_COLUMN_PAD_PX,
                paddingRight: MAIN_COLUMN_PAD_PX,
                paddingBottom: MAIN_COLUMN_PAD_PX,
                paddingTop: MAIN_INNER_TOP_PAD_PX,
              }}
            >
              <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {!anyMainOverlay ? (
            <div className="absolute left-2 top-2 z-40 flex items-center gap-0.5">
              <button
                type="button"
                className={AO_MAIN_ICON_BTN_CLASS}
                aria-label="AI API 使用量を表示"
                onClick={() => {
                  setPostMenuTopicId(null);
                  setContextOpen(false);
                  setChronicleOpen(false);
                  setSettingsOpen(false);
                  setUsageOpen(true);
                }}
              >
                <IcoCoinBag size={MAIN_HEADER_ICON_PX} />
              </button>
              <button
                type="button"
                className={AO_MAIN_ICON_BTN_CLASS}
                aria-label="設定を開く"
                onClick={() => {
                  setPostMenuTopicId(null);
                  setContextOpen(false);
                  setChronicleOpen(false);
                  setUsageOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <IcoGear size={MAIN_HEADER_ICON_PX} />
              </button>
            </div>
          ) : null}
          {overlayMode && (
            <div
              className="absolute inset-0 z-50 flex min-h-0 flex-col p-3 box-border"
              style={{ backgroundColor: AO_MAIN_BG }}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-[3px]">
                {/* grid で中央列に minmax(0,1fr) を確保し「論エリア」が左右に潰れないようにする */}
                <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3">
                  <div className="shrink-0 pl-[25px] pt-1 text-left leading-tight whitespace-nowrap">
                    {isContextMode ? (
                      <AoRubyGold main="令　旨" rt="ジャルリグ" mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#DBB961]" rtClassName="text-[9px] font-serif text-[#DBB961]/80" />
                    ) : (
                      <AoRubyGold main="年 代 記" rt="トプチヤン" mainClassName="text-[14px] font-semibold font-serif tracking-[0.12em] text-[#DBB961]" rtClassName="text-[9px] font-serif text-[#DBB961]/80" />
                    )}
                  </div>

                  {/* メイン画面の論エリアと同一構造（中央列のみが縮み、タブは横スクロール） */}
                  <div className="flex min-w-0 justify-center self-start pt-1">
                    <div
                      className="inline-flex max-w-full flex-nowrap items-center justify-center gap-1 overflow-x-auto border border-solid p-px"
                      style={{ borderColor: AO_GOLD_UI, borderWidth: 1 }}
                    >
                      {AO_TOPICS.map((tp) => {
                        const on = selectedTopic === tp.id;
                        return (
                          <button
                            key={tp.id}
                            type="button"
                            className={aoRonTabClasses(tp.id, on)}
                            style={aoRonTabInlineStyle(tp.id, on)}
                            onClick={() => toggleTopic(tp.id)}
                            aria-pressed={selectedTopic === tp.id}
                          >
                            <span className={aoRonTabLabelOffsetClass(on)}>{tp.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-1 self-start pt-1 pr-[25px]">
                    {isContextMode ? (
                      <button
                        type="button"
                        className="flex items-center justify-center rounded-sm border-0 bg-transparent p-1.5 text-[#DBB961] transition-[transform,opacity,filter] hover:bg-[#143d5e]/80 hover:brightness-110 active:scale-[0.88] active:opacity-90"
                        aria-label="令旨を閉じる"
                        onClick={() => {
                          setPostMenuTopicId(null);
                          setContextOpen(false);
                          scheduleFocusMainPrompt();
                        }}
                      >
                        <IcoExecute size={20} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="flex items-center justify-center rounded-sm border-0 bg-transparent p-1.5 text-[#DBB961] transition-[transform,opacity,filter] hover:bg-[#143d5e]/80 hover:brightness-110 active:scale-[0.88] active:opacity-90"
                      aria-label="戻る"
                      onClick={() => {
                        setPostMenuTopicId(null);
                        setContextOpen(false);
                        setChronicleOpen(false);
                        scheduleFocusMainPrompt();
                      }}
                    >
                      <IcoArrowLeft size={20} />
                    </button>
                  </div>
                </div>

                <div
                  className="min-h-0 flex-1 overflow-y-scroll border border-solid [scrollbar-gutter:stable]"
                  style={{ borderColor: AO_GOLD_UI, borderWidth: 1, backgroundColor: AO_MAIN_BG }}
                >
                  {topicThreads.length === 0 ? (
                    <>
                      <div
                        className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-0 border-b px-2 py-1.5 text-[12px] text-[#DBB961]"
                        style={{ borderColor: AO_GOLD_UI }}
                      >
                        <div className="w-[24px]" />
                        <div className="min-w-0 text-left">該当する議事はありません。</div>
                        <div className="min-w-[52px] shrink-0 text-center text-[11px] leading-tight text-[#c2cad6]" />
                        <div className="min-w-[108px] shrink-0 pr-[20px] text-right" />
                      </div>
                      {Array.from({ length: 14 }).map((_, i) => (
                        <div
                          key={`empty-row-${i}`}
                          className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-0 border-b px-2 py-1.5"
                          style={{ borderColor: AO_GOLD_UI, minHeight: 36 }}
                        >
                          <div className="w-[24px]" />
                          <div />
                          <div className="min-w-[52px] shrink-0" />
                          <div className="min-w-[108px] shrink-0 pr-[20px]" />
                        </div>
                      ))}
                    </>
                  ) : (
                    topicThreads.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="group/row grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-0 border-b px-2 py-1.5 text-left text-[12px] hover:bg-[#143d5e]/60"
                        style={{ borderColor: AO_GOLD_UI }}
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
                            <input type="checkbox" checked={contextChecks.includes(t.id)} readOnly className="ao-overlay-checkbox" />
                          ) : null}
                        </div>
                        <span className="min-w-0 truncate text-[#c2cad6] group-hover/row:underline">{t.title}</span>
                        <span className="min-w-[52px] shrink-0 whitespace-nowrap text-center text-[11px] leading-tight text-[#c2cad6]">
                          {threadSourceProviderUlusLabel(t.sourceProvider)}
                        </span>
                        <span className="min-w-0 shrink-0 whitespace-nowrap pr-[20px] text-right text-[12px] leading-tight text-[#c2cad6] tabular-nums">
                          {formatDate(t.updatedAt)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          {settingsOpen ? (
            <AoSettingsOverlay
              open={settingsOpen}
              onClose={() => {
                setSettingsOpen(false);
                scheduleFocusMainPrompt();
              }}
            />
          ) : null}
          {usageOpen ? (
            <AoUsageOverlay
              open={usageOpen}
              onClose={() => {
                setUsageOpen(false);
                scheduleFocusMainPrompt();
              }}
            />
          ) : null}

          {/* ③ 論・投稿メニュー（メニューは absolute で議事タイトル／入力帯の上に重ね、レイアウトを押し下げない） */}
          <div className="shrink-0 px-3" style={{ paddingTop: RON_AREA_PAD_TOP_PX }}>
            <div ref={postMenuAnchorRef} className="relative z-[35]">
              <div className="flex justify-center">
                <div
                  className="inline-flex max-w-full flex-wrap items-center justify-center gap-1 border border-solid p-px"
                  style={{ borderColor: AO_GOLD_UI, borderWidth: 1 }}
                >
                  {AO_TOPICS.map((tp) => {
                    const on = selectedTopic === tp.id;
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        onClick={() => onMainRonTabClick(tp.id)}
                        className={aoRonTabClasses(tp.id, on)}
                        style={aoRonTabInlineStyle(tp.id, on)}
                      >
                        <span className={aoRonTabLabelOffsetClass(on)}>{tp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {postMenuTopicId ? (
                <div
                  role="dialog"
                  aria-label="議事の選択"
                  className="absolute left-0 right-0 top-full z-40 mt-0 border border-solid px-2 py-1.5"
                  style={{
                    borderColor: AO_GOLD_UI,
                    borderWidth: 1,
                    backgroundColor: "#17496d",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.42)",
                  }}
                >
                  <div
                    className="mb-1 border-b pb-1 text-center text-[11px] font-semibold text-[#DBB961]/90"
                    style={{ borderColor: AO_GOLD_UI }}
                  >
                    {AO_TOPICS.find((x) => x.id === postMenuTopicId)?.label ?? ""} — 議事
                  </div>
                  <button
                    type="button"
                    className="mb-1 w-full rounded-none border border-solid px-2 py-1.5 text-left text-[12px] font-semibold text-[#FAF3E6] hover:bg-[#1e5c88]"
                    style={{ borderColor: AO_GOLD_UI, backgroundColor: "#1a5080" }}
                    onClick={() => {
                      const nt = createAoThreadForTopic(postMenuTopicId);
                      setComposeLocked(false);
                      setState((prev) => {
                        if (!prev) return prev;
                        const withoutGhost = prev.threads.filter(
                          (t) => !(t.ephemeral && t.messages.length === 0 && t.projectId === nt.projectId),
                        );
                        return {
                          ...prev,
                          threads: [nt, ...withoutGhost],
                          currentThreadId: nt.id,
                          currentProjectId: nt.projectId,
                        };
                      });
                      setDraft("");
                      setPostMenuTopicId(null);
                      scheduleFocusMainPrompt();
                    }}
                  >
                    新規
                  </button>
                  <div className="max-h-[132px] overflow-y-auto pr-0.5">
                    {postMenuThreads.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 border-b px-1 py-1 text-left text-[11px] text-[#c2cad6] last:border-b-0 hover:bg-[#1e5c88]/80"
                        style={{ borderColor: `${AO_GOLD_UI}55` }}
                        onClick={() => {
                          setComposeLocked(false);
                          setCurrentThread(t.id);
                          setPostMenuTopicId(null);
                          scheduleFocusMainPrompt();
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{t.title.trim() || "（無題）"}</span>
                        <span className="shrink-0 tabular-nums text-[10px] text-[#9eb3c9]">{formatDateDay(t.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* 中段：吹き出し高さ＝JUCHI_COLUMN−15 で下端＝送信下端・顔は15px上／余白は flex-1 の僚友へ */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden px-3"
            style={{
              paddingTop: GIKUJI_TITLE_PAD_TOP_PX,
              gap: GIKUJI_TITLE_GAP_AFTER_PX,
              paddingBottom: GIKUJI_MID_BLOCK_PAD_BOTTOM_PX,
            }}
          >
            {/* 巷間論は議事タイトルを出さないが、高さは確保して吹き出し位置を揃える */}
            <div className="mt-0 w-full shrink-0 text-left" style={{ paddingLeft: 140 }}>
              {selectedTopic !== "koukan" ? (
                titleEditing ? (
                  <input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      setTitleEditing(false);
                      if (!state || !currentThread) return;
                      if (!isAoNativeThread(currentThread)) {
                        setTitleDraft(currentThread.title);
                        return;
                      }
                      const trimmed = titleDraft.trim();
                      setState((prev) => {
                        if (!prev) return prev;
                        const ti = prev.threads.findIndex((t) => t.id === currentThread.id);
                        if (ti < 0) return prev;
                        const arr = [...prev.threads];
                        arr[ti] = { ...arr[ti], title: trimmed };
                        return { ...prev, threads: arr };
                      });
                    }}
                    style={{ fontSize: AO_RON_TAB_FONT_PX }}
                    className="h-[26px] w-full rounded-none border-0 bg-transparent pl-0 pr-2 text-left font-serif font-semibold text-[#DBB961] outline-none ring-0 placeholder:text-[#DBB961]/45 focus:ring-0"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(currentThread?.title ?? "");
                      setTitleEditing(true);
                    }}
                    style={{ fontSize: AO_RON_TAB_FONT_PX }}
                    className="flex h-[26px] w-full items-center justify-start rounded-none border-0 bg-transparent pl-0 pr-2 text-left font-serif font-semibold text-[#DBB961]"
                  >
                    『{currentThread?.title?.trim() ? currentThread.title : "タイトル未設定"}』
                  </button>
                )
              ) : (
                <div className="h-[26px] w-full shrink-0" aria-hidden />
              )}
            </div>

            <div className="flex shrink-0 items-start pb-0" style={{ gap: MAIN_BUBBLE_ROW_GAP_PX }}>
              <div
                className="flex shrink-0 flex-col justify-center gap-2"
                style={{ height: MAIN_SPEECH_BUBBLE_H_PX }}
              >
                <button
                  type="button"
                  className={`flex items-center justify-center ${AO_MAIN_ICON_BTN_CLASS}`}
                  style={{ minHeight: REISHI_CHRONICLE_BTN_MIN_H_PX }}
                  aria-label="令旨"
                  onClick={() => {
                    setPostMenuTopicId(null);
                    setContextOpen(true);
                    setChronicleOpen(false);
                  }}
                >
                  <IcoScroll size={22} />
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center ${AO_MAIN_ICON_BTN_CLASS}`}
                  style={{ minHeight: REISHI_CHRONICLE_BTN_MIN_H_PX }}
                  aria-label="年代記"
                  onClick={() => {
                    setPostMenuTopicId(null);
                    setChronicleOpen(true);
                    setContextOpen(false);
                  }}
                >
                  <IcoBook size={22} />
                </button>
              </div>

              <div className="isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-visible pr-0">
                {/* rounded はラッパーで clip。textarea 単体の角丸は親の overflow-x-clip と相性が悪く左下が角ばって見えることがある */}
                <div className="mr-0 w-full" style={{ marginLeft: MAIN_BUBBLE_TEXTAREA_ML_PX, height: MAIN_SPEECH_BUBBLE_H_PX }}>
                  <div
                    className="box-border h-full min-h-0 w-full overflow-hidden rounded-tl-lg rounded-tr-none rounded-br-lg rounded-bl-lg bg-white"
                    style={{ boxShadow: AO_DROP_SHADOW_BUBBLE }}
                  >
                    <textarea
                      ref={promptTextareaRef}
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
                      className={`box-border h-full min-h-0 w-full resize-none overflow-y-auto rounded-none border-0 bg-transparent font-serif text-[13px] text-[#1a1208] outline-none ring-0 focus:ring-0 ${composeLocked ? "cursor-not-allowed opacity-60" : ""}`}
                      style={{ padding: "3px 10px" }}
                    />
                  </div>
                </div>
              </div>

              {/* ユーザー：チャット帯より前面にしクリックを拾う／送信は令旨系・低い黄 */}
              <div
                className="relative z-20 box-border flex shrink-0 flex-col items-center gap-0.5 pl-1 font-serif"
                style={{ width: NOKOR_COL_W_PX, marginTop: -JUCHI_PORTRAIT_RAISE_ABOVE_BUBBLE_PX }}
              >
                <div className={`relative shrink-0 overflow-hidden rounded-none bg-black/15 ${NOKOR_PORTRAIT_ASPECT_CLASS}`} style={{ width: NOKOR_PORTRAIT_W_PX }}>
                  <Image src="/personas/juci.png" alt="ジュチ" fill sizes={`${NOKOR_PORTRAIT_W_PX}px`} className="object-cover object-top" priority />
                </div>
                <div className="w-full text-center text-[10px] font-semibold leading-tight text-[#DBB961]">ジュチ</div>
                <div className="w-full text-center leading-tight">
                  <AoRubyGold main="邦　主" rt="ウルス・ハン" mainClassName="text-[10px] font-semibold font-serif text-[#DBB961]" rtClassName="text-[8px] font-serif text-[#DBB961]/80" />
                </div>
                <div className="relative z-30 flex w-full justify-center pt-0.5">
                  <button
                    type="button"
                    disabled={composeLocked}
                    onClick={() => void sendUserMessage()}
                    aria-label="送信"
                    className={`relative z-30 shrink-0 cursor-pointer touch-manipulation select-none disabled:cursor-not-allowed disabled:opacity-40 ${AO_MAIN_ICON_BTN_CLASS}`}
                  >
                    <IcoExecute size={Math.max(16, Math.round(JUCHI_SEND_BTN_MIN_H_PX * 1.25))} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ④⑤ 僚友：flex-1・上詰めスクロール。下辺は border と別レイヤの 1px バーで補強（ズーム時の欠け対策） */}
          <div
            className="flex min-h-0 flex-1 flex-col justify-start overflow-x-auto overflow-y-auto pt-0"
            style={{
              paddingBottom: NOKOR_AREA_OUTER_PAD_BOTTOM_PX + NOKOR_AREA_BOTTOM_SAFE_PX,
              paddingLeft: 0,
              paddingRight: 0,
              scrollPaddingBottom: 12,
            }}
          >
            <div className="mx-auto flex w-full max-w-full shrink-0 flex-col">
              <div
                className="flex w-full max-w-full flex-col items-center border border-solid border-b-0 py-[3px]"
                style={{
                  borderColor: AO_GOLD_UI,
                  borderWidth: 1,
                  backgroundColor: AO_MAIN_BG,
                  marginTop: Math.max(0, NOKOR_FRAME_MARGIN_V_PX - NOKOR_INNER_FRAME_MARGIN_TOP_SHRINK_PX),
                  marginBottom: 0,
                  marginLeft: 0,
                  marginRight: 0,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  transform: "translateZ(0)",
                }}
              >
              <div
                className="flex w-full flex-col items-center"
                style={{
                  gap: `${NOKOR_CAPTION_STRIP_GAP_PX}px`,
                  rowGap: `${NOKOR_CAPTION_STRIP_GAP_PX}px`,
                }}
              >
                <div
                  className="rounded-none px-2 text-center leading-none"
                  style={{
                    backgroundColor: AO_MAIN_BG,
                    paddingTop: NOKOR_CAPTION_CHIP_PAD_TOP_PX,
                    paddingBottom: NOKOR_CAPTION_CHIP_PAD_BOTTOM_PX,
                  }}
                >
                  <AoRubyGold main="僚　友" rt="ノコル" mainClassName="text-[13px] font-semibold tracking-[0.25em] font-serif text-[#DBB961]" rtClassName="text-[8px] tracking-normal font-serif text-[#DBB961]/80" />
                </div>
                <div style={{ width: NOKOR_STRIP_W_PX }}>
                  <div className="flex items-start">
                    {NOKOR.map((p) => {
                      const active = activeNokorNames.has(p.name);
                      return (
                        <div
                          key={p.name}
                          role="presentation"
                          style={{
                            width: NOKOR_COL_W_PX,
                            paddingLeft: NOKOR_COL_PAD_X_PX,
                            paddingRight: NOKOR_COL_PAD_X_PX,
                          }}
                          className={aoNokorCellClasses(active)}
                        >
                          <div
                            className={`flex w-full flex-col items-center gap-[3px] px-[3px] pb-[3px] transition-none ${active ? "translate-x-px translate-y-px" : "translate-x-0 translate-y-0"}`}
                            style={{
                              width: NOKOR_COL_INNER_W_PX,
                              paddingTop: 3,
                            }}
                          >
                            <div className={`relative shrink-0 overflow-hidden rounded-none bg-black/15 ${NOKOR_PORTRAIT_ASPECT_CLASS}`} style={{ width: NOKOR_PORTRAIT_W_PX }}>
                              <Image src={p.src} alt={p.name} fill sizes={`${NOKOR_PORTRAIT_W_PX}px`} className="object-cover object-top" />
                            </div>
                            <div className="w-full min-w-0 text-center text-[10px] font-semibold leading-tight text-[#DBB961]">{p.name}</div>
                            <div className="w-full min-w-0 text-center text-[10px] font-semibold leading-[1.15] text-[#DBB961]" style={{ maxWidth: NOKOR_TEXT_BAND_W_PX }}>
                              {p.captionPrefix ? <span>{p.captionPrefix}</span> : null}
                              <ruby className="font-serif">
                                {p.captionRubyBase}
                                <rt className="font-serif text-[8px] text-[#DBB961]/80">{p.captionRubyRt}</rt>
                              </ruby>
                            </div>
                            <div className="w-full min-w-0 text-center text-[10px] font-semibold leading-[1.1] text-[#DBB961]" style={{ maxWidth: NOKOR_TEXT_BAND_W_PX }}>
                              {p.line2}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
              {/* 下辺のみ別要素にしてスクロール下端での subpixel 欠けを抑える */}
              <div
                className="mx-auto w-full max-w-full shrink-0"
                style={{
                  height: 1,
                  backgroundColor: AO_GOLD_UI,
                  boxSizing: "border-box",
                }}
                aria-hidden
              />
            </div>
          </div>
          </div>
              </section>
            </main>
            </div>

            {/* ②-3 メイン部下: チャット部（メイン吹き出しと幅・X 揃え／角・配色 TO-BE） */}
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-transparent font-serif" style={{ width: MAIN_COLUMN_W_PX }}>
            <div
              ref={messagesRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto"
              style={{
                paddingLeft: MAIN_COLUMN_PAD_PX + MAIN_MIDDLE_SECTION_PAD_X_PX,
                paddingRight: MAIN_COLUMN_PAD_PX + MAIN_MIDDLE_SECTION_PAD_X_PX,
                paddingTop: MAIN_MIDDLE_SECTION_PAD_X_PX,
                paddingBottom: MAIN_MIDDLE_SECTION_PAD_X_PX,
              }}
            >
              <div className="flex min-h-full flex-col justify-start gap-3">
                {visibleMessages(currentThread?.messages ?? []).map((m) => {
                  const label = aiAvatarCaptionLabel(currentThread, m);
                  const avatarKey =
                    m.side === "user" ? "ジュチ" : label in AVATAR_SRC ? label : "不明";
                  const avatarSrc = AVATAR_SRC[avatarKey];

                  const chatBubblePadStyle: CSSProperties = {
                    boxSizing: "border-box",
                    maxWidth: CHAT_BUBBLE_INNER_W_PX,
                    width: "fit-content",
                    minWidth: 0,
                    minHeight: CHAT_HISTORY_BUBBLE_MIN_H_PX,
                    padding: "3px 10px",
                    boxShadow: AO_DROP_SHADOW_BUBBLE,
                    overflowWrap: "break-word",
                  };

                  if (m.side === "ai") {
                    return (
                      <div key={m.id} className="flex w-full items-start" style={{ gap: MAIN_BUBBLE_ROW_GAP_PX }}>
                        <div className="flex shrink-0 flex-col items-center gap-0.5 font-serif" style={{ width: MAIN_LEFT_TOOLS_COL_W_PX }}>
                          <div style={{ filter: AO_CHAT_AVATAR_DROP_SHADOW_FILTER }}>
                            <div
                              className={`relative shrink-0 overflow-hidden rounded-none bg-black/15 ${NOKOR_PORTRAIT_ASPECT_CLASS}`}
                              style={{ width: NOKOR_PORTRAIT_W_PX }}
                            >
                              <Image src={avatarSrc} alt={label} fill sizes={`${NOKOR_PORTRAIT_W_PX}px`} className="object-cover object-top" />
                            </div>
                          </div>
                          <div className="ao-chat-avatar-caption-wrap">
                            <div className="ao-chat-avatar-caption-pill">
                              <span className="ao-chat-avatar-caption-text">{label}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-start justify-start overflow-visible">
                          <AoAiBubbleUsageTooltip usage={m.usage}>
                            <div
                              className="rounded-tr-lg rounded-br-lg rounded-bl-lg rounded-tl-none border-0 font-serif text-[13px] leading-relaxed"
                              style={{
                                ...chatBubblePadStyle,
                                marginLeft: MAIN_BUBBLE_TEXTAREA_ML_PX,
                                backgroundColor: AO_CHAT_AI_BUBBLE_BG,
                                color: AO_CHAT_AI_BUBBLE_FG,
                              }}
                            >
                              {typingId === m.id ? (
                                <span style={{ color: AO_CHAT_AI_BUBBLE_FG }}>{msgTextForUi(currentThread, m)}</span>
                              ) : (
                                <AoMessageMarkdown text={msgTextForUi(currentThread, m)} className="ao-chat-ai-bubble-md" />
                              )}
                            </div>
                          </AoAiBubbleUsageTooltip>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.id} className="flex w-full flex-row-reverse items-start" style={{ gap: MAIN_BUBBLE_ROW_GAP_PX }}>
                      <div className="relative z-20 box-border flex shrink-0 flex-col items-center gap-0.5 pl-1 font-serif" style={{ width: NOKOR_COL_W_PX }}>
                        <div style={{ filter: AO_CHAT_AVATAR_DROP_SHADOW_FILTER }}>
                          <div
                            className={`relative shrink-0 overflow-hidden rounded-none bg-black/15 ${NOKOR_PORTRAIT_ASPECT_CLASS}`}
                            style={{ width: NOKOR_PORTRAIT_W_PX }}
                          >
                            <Image src={avatarSrc} alt={label} fill sizes={`${NOKOR_PORTRAIT_W_PX}px`} className="object-cover object-top" priority />
                          </div>
                        </div>
                        <div className="ao-chat-avatar-caption-wrap">
                          <div className="ao-chat-avatar-caption-pill">
                            <span className="ao-chat-avatar-caption-text">ジュチ</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-end justify-start overflow-visible">
                        <div
                          className="rounded-tl-lg rounded-bl-lg rounded-br-lg rounded-tr-none border-0 bg-white font-serif text-[13px] leading-relaxed text-[#1a1208]"
                          style={{
                            ...chatBubblePadStyle,
                            marginRight: MAIN_BUBBLE_TEXTAREA_ML_PX,
                          }}
                        >
                          {typingId === m.id ? (
                            <span>{msgTextForUi(currentThread, m)}</span>
                          ) : (
                            <AoMessageMarkdown text={msgTextForUi(currentThread, m)} />
                          )}
                        </div>
                      </div>
                      <div className="shrink-0" style={{ width: MAIN_LEFT_TOOLS_COL_W_PX }} aria-hidden />
                    </div>
                  );
                })}
                {isThinking ? (
                  <div className="text-[11px]" style={{ color: AO_GOLD_UI }}>
                    応答生成中...
                  </div>
                ) : null}
              </div>
            </div>
            </section>
          </div>

          <aside className="min-h-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}

