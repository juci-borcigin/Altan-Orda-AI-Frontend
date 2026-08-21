/** Format v2 定数 — Web記事型講義 */

/** 1回（1記事）の本文目標字数（Intro/Outro/中身合計） */
export const CHARS_PER_SESSION = 5000;

/** ユーザーが指定できる回数 */
export const MIN_SESSION_COUNT = 4;
export const MAX_SESSION_COUNT = 10;

/**
 * 1回あたりの講義セクション数（Intro + 中身 + Outro）。
 * 中身 5±1 → 総セクション 6〜8。
 */
export const MIN_SECTIONS_PER_SESSION = 6;
export const MAX_SECTIONS_PER_SESSION = 8;
export const PREFERRED_CONTENT_SECTIONS = 5;

/** セクションあたり目安（5000 / 6 ≒ 833）。プロンプト誘導用 */
export const PREFERRED_SECTION_CHARS = Math.round(
  CHARS_PER_SESSION / (2 + PREFERRED_CONTENT_SECTIONS),
);

/** 読了目安表示用（生成ターゲットには使わない） */
export const READING_CHARS_PER_MINUTE = 250;

export function readingMinutesForSession(chars = CHARS_PER_SESSION): number {
  return Math.max(1, Math.round(chars / READING_CHARS_PER_MINUTE));
}

/** 旧 min×200 互換: 呼び出し側が残っていても v2 では無視して 5000 を返す */
export function targetCharsForDuration(_min?: number): number {
  return CHARS_PER_SESSION;
}
