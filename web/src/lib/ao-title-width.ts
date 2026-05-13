/**
 * 議事タイトル幅：全角相当を 1、ASCII・半角カナ等を 0.5 として最大 16 単位まで。
 * DB 保存・自動取得・編集の上限と、表示用の省略に共通利用する。
 */

export const AO_THREAD_TITLE_MAX_UNITS = 16;

/** 1 書記素（サロゲートペアを 1 文字）あたりのタイトル幅単位 */
export function charTitleWidthUnits(ch: string): number {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return 0;
  if (cp === 0x0a || cp === 0x0d) return 0;
  // ASCII（半角英数・記号・スペース）
  if (cp >= 0x20 && cp <= 0x7e) return 0.5;
  // 半角カタカナ
  if (cp >= 0xff61 && cp <= 0xff9f) return 0.5;
  return 1;
}

export function totalTitleWidthUnits(s: string): number {
  let sum = 0;
  for (const ch of s) sum += charTitleWidthUnits(ch);
  return sum;
}

/** 先頭から単位が maxUnits を超えないように切る（境界は次の文字を入れると超えるなら含めない） */
export function sliceByMaxTitleUnits(raw: string, maxUnits: number): string {
  let u = 0;
  const out: string[] = [];
  for (const ch of raw) {
    const w = charTitleWidthUnits(ch);
    if (w === 0) {
      out.push(ch);
      continue;
    }
    if (u + w > maxUnits) break;
    u += w;
    out.push(ch);
  }
  return out.join("");
}

export function aoClampStoredTitleByUnits(raw: string, maxUnits = AO_THREAD_TITLE_MAX_UNITS): string {
  return sliceByMaxTitleUnits(raw.trim(), maxUnits);
}

/** 一覧・チップ表示：16 単位超なら 16 単位まで＋省略記号 */
export function formatTitleForDisplayUnits(stored: string, maxUnits = AO_THREAD_TITLE_MAX_UNITS): string {
  const t = stored.trim();
  if (!t) return "";
  if (totalTitleWidthUnits(t) <= maxUnits) return t;
  return sliceByMaxTitleUnits(t, maxUnits) + "…";
}
