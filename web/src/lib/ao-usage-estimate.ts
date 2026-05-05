import { getOpenRouterTokenRates } from "@/lib/ao-openrouter-pricing";

/**
 * 概算 USD（粗い既定単価）。未設定なら null。
 * OpenRouter の models API でモデル別単価を取れる場合は estimateCompletionUsdForModel を使う。
 */
function envPerMillion(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** prompt / completion をそれぞれ $ / 1M tok で見積もる（環境変数フォールバック） */
export function estimateCompletionUsd(
  promptTokens: number,
  completionTokens: number,
): number | null {
  const inPerM = envPerMillion("AO_USD_PER_MTOK_PROMPT");
  const outPerM = envPerMillion("AO_USD_PER_MTOK_COMPLETION");
  if (inPerM == null || outPerM == null) return null;
  return (promptTokens / 1_000_000) * inPerM + (completionTokens / 1_000_000) * outPerM;
}

/**
 * model_id が OpenRouter 公開一覧に載っているときはその単価で算出。
 * 載っていない／取得失敗時は estimateCompletionUsd（AO_USD_*）へフォールバック。
 */
export async function estimateCompletionUsdForModel(
  promptTokens: number,
  completionTokens: number,
  modelId: string,
): Promise<number | null> {
  const rates = await getOpenRouterTokenRates(modelId);
  if (rates) {
    const raw = promptTokens * rates.promptPerTok + completionTokens * rates.completionPerTok;
    if (!Number.isFinite(raw)) return estimateCompletionUsd(promptTokens, completionTokens);
    return Math.round(raw * 1e6) / 1e6;
  }
  return estimateCompletionUsd(promptTokens, completionTokens);
}

/** model_id のベンダー相当（表示・集計用） */
export function vendorPrefixFromModelId(modelId: string): string {
  const m = modelId.trim();
  const i = m.indexOf("/");
  if (i <= 0) return "(その他)";
  return m.slice(0, i);
}
