/**
 * ブラウザ用の概算 USD（ツールチップ等）。NEXT_PUBLIC_* が両方あればサーバ未設定でも表示できる。
 */
function parsePerMillion(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function estimateUsdFromTokensClient(promptTokens: number, completionTokens: number): number | null {
  const inPerM = parsePerMillion(process.env.NEXT_PUBLIC_AO_USD_PER_MTOK_PROMPT);
  const outPerM = parsePerMillion(process.env.NEXT_PUBLIC_AO_USD_PER_MTOK_COMPLETION);
  if (inPerM == null || outPerM == null) return null;
  return (promptTokens / 1_000_000) * inPerM + (completionTokens / 1_000_000) * outPerM;
}
