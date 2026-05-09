import type { Msg, Thread } from "@/lib/ao-state";

/** メイン議事タイトル欄（巷間論タブ時）：編集不可・中央表示の固定文言 */
export const AO_KOUKAN_MAIN_TITLE_FIXED = "　巷　間　論　";

/** 議事タイトル自動生成：最初のユーザー投稿から、先頭の改行より前で最初の「。」まで（「。」が無ければその行全体） */
export function aoTitleSnippetFromFirstUserPost(text: string): string {
  const lines = text.split(/\r?\n/);
  let line = "";
  for (const L of lines) {
    if (L.trim().length > 0) {
      line = L;
      break;
    }
  }
  if (!line.trim()) return "";
  const periodIdx = line.indexOf("。");
  const segment = periodIdx >= 0 ? line.slice(0, periodIdx) : line;
  return segment.trim();
}

/** メイン以外も含む一覧表示の既定の最大文字数（これを超えたら「...」） */
export const AO_THREAD_TITLE_DISPLAY_MAX_CHARS = 24;

/** 一覧・見出し表示用：長すぎる stored タイトルを maxChars 文字まで「...」省略 */
export function aoDisplayThreadTitle(storedTitle: string, maxChars = AO_THREAD_TITLE_DISPLAY_MAX_CHARS): string {
  const t = storedTitle.trim();
  if (!t) return "";
  const chars = [...t];
  if (chars.length <= maxChars) return t;
  return chars.slice(0, maxChars).join("") + "...";
}

function aoFirstUserPlainText(messages: readonly Msg[]): string {
  for (const m of messages) {
    if (m.side === "user" && m.text.trim()) return m.text;
  }
  return "";
}

/** サイド／オーバーレイ一覧：保存タイトルが空なら初回ユーザー投稿からスニペットを表示 */
export function aoThreadTitleForList(thread: Thread, maxChars = AO_THREAD_TITLE_DISPLAY_MAX_CHARS): string {
  const stored = thread.title.trim();
  if (stored) return aoDisplayThreadTitle(stored, maxChars);
  const snippet = aoTitleSnippetFromFirstUserPost(aoFirstUserPlainText(thread.messages));
  if (snippet) return aoDisplayThreadTitle(snippet, maxChars);
  return "（無題）";
}
