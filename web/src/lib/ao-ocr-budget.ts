/** OpenAI Vision OCR の冊あたり予算（円）。超過見込みは OCR 中止。 */
export const OCR_MAX_YEN_PER_BOOK = Number(
  process.env.AO_OCR_MAX_YEN_PER_BOOK ?? 1000,
);

/** 1 ページあたりの保守的見積（円）。gpt-4o-mini + scale2 想定の上振れ用。 */
export const OCR_YEN_PER_PAGE_ESTIMATE = Number(
  process.env.AO_OCR_YEN_PER_PAGE_ESTIMATE ?? 3,
);

export function estimateOcrYen(remainingPages: number): number {
  return Math.round(remainingPages * OCR_YEN_PER_PAGE_ESTIMATE);
}

export function isOcrOverBudget(remainingPages: number): boolean {
  return estimateOcrYen(remainingPages) > OCR_MAX_YEN_PER_BOOK;
}
