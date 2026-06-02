import type { Msg, Thread } from "@/lib/ao-state";
import {
  AO_THREAD_TITLE_MAX_UNITS,
  aoClampStoredTitleByUnits,
  formatTitleForDisplayUnits,
  sliceByMaxTitleUnits,
} from "@/lib/ao-title-width";

/** 議事タイトル自動生成：最初のユーザー投稿から、先頭の改行より前で最初の「。」まで（「。」が無ければその行全体）。最大 16 単位まで。 */
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
  const trimmed = segment.trim();
  if (!trimmed) return "";
  return aoClampStoredTitleByUnits(trimmed, AO_THREAD_TITLE_MAX_UNITS);
}

/** 一覧・見出し表示の既定最大（幅単位で超えたら「…」） */
export const AO_THREAD_TITLE_DISPLAY_MAX_CHARS = AO_THREAD_TITLE_MAX_UNITS;

/** 保存・入力の最大（幅単位。半角は 0.5） */
export const AO_THREAD_TITLE_STORE_MAX_CHARS = AO_THREAD_TITLE_MAX_UNITS;

/** 一覧・見出し表示用：stored が maxUnits を超える場合のみ省略（「…」） */
export function aoDisplayThreadTitle(storedTitle: string, maxUnits = AO_THREAD_TITLE_DISPLAY_MAX_CHARS): string {
  return formatTitleForDisplayUnits(storedTitle, maxUnits);
}

/** 保存用：先頭から最大 maxUnits（半角 0.5） */
export function aoClampStoredThreadTitle(raw: string, maxUnits = AO_THREAD_TITLE_STORE_MAX_CHARS): string {
  return aoClampStoredTitleByUnits(raw, maxUnits);
}

/** 入力中：trim せずに単位上限で切る（IME 中の揺れを避ける） */
export function aoClampTitleDraftInput(raw: string, maxUnits = AO_THREAD_TITLE_STORE_MAX_CHARS): string {
  return sliceByMaxTitleUnits(raw, maxUnits);
}

function aoFirstUserPlainText(messages: readonly Msg[]): string {
  for (const m of messages) {
    if (m.side === "user" && m.text.trim()) return m.text;
  }
  return "";
}

export function isKoukanThread(thread: Pick<Thread, "projectId">): boolean {
  return thread.projectId === "chat";
}

/** サイド／オーバーレイ一覧：保存タイトルが空なら初回ユーザー投稿からスニペットを表示 */
export function aoThreadTitleForList(thread: Thread, maxUnits = AO_THREAD_TITLE_DISPLAY_MAX_CHARS): string {
  const stored = thread.title.trim();
  if (stored) return aoDisplayThreadTitle(stored, maxUnits);
  const snippet = aoTitleSnippetFromFirstUserPost(aoFirstUserPlainText(thread.messages));
  if (snippet) return aoDisplayThreadTitle(snippet, maxUnits);
  return "（無題）";
}

/** メイン議事タイトル帯：保存が空のときは一覧と同じスニペット／無題はプレースホルダ */
export function aoThreadTitleChipLabel(thread: Thread | null, maxUnits = AO_THREAD_TITLE_DISPLAY_MAX_CHARS): string {
  if (!thread) return "タイトル未設定";
  const stored = thread.title.trim();
  if (stored) return aoDisplayThreadTitle(stored, maxUnits);
  const listLabel = aoThreadTitleForList(thread, maxUnits);
  if (listLabel !== "（無題）") return listLabel;
  return "タイトル未設定";
}
