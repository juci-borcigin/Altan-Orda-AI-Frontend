/**
 * ベンダー直結のテキスト単価（USD / 1M tokens）。概算表示の正本。
 * 取得日: 2026-08-04（OpenAI / Anthropic / xAI / DeepSeek / Perplexity 公開価格）
 * 鮮度: AO 動作時に付帯単価は env 再読込。本表はコード更新時に日付を上げること。
 * Sonnet 5 は導入価格 $2/$10（〜2026-08-31）。以降は標準 $3/$15 に更新すること。
 */

export type VendorTokenRatesPerMillion = { inPerM: number; outPerM: number };

/** OpenRouter 形式 ID（vendor/slug）→ 直結単価 */
const VENDOR_RATES_PER_M: Readonly<Record<string, VendorTokenRatesPerMillion>> = {
  // Anthropic
  "anthropic/claude-fable-5": { inPerM: 10, outPerM: 50 },
  "anthropic/claude-opus-5": { inPerM: 5, outPerM: 25 },
  "anthropic/claude-opus-4.8": { inPerM: 5, outPerM: 25 },
  "anthropic/claude-opus-4.7": { inPerM: 5, outPerM: 25 },
  "anthropic/claude-opus-4.6": { inPerM: 5, outPerM: 25 },
  "anthropic/claude-sonnet-5": { inPerM: 2, outPerM: 10 }, // intro through 2026-08-31
  "anthropic/claude-sonnet-4.6": { inPerM: 3, outPerM: 15 },
  "anthropic/claude-sonnet-4.5": { inPerM: 3, outPerM: 15 },
  "anthropic/claude-haiku-4.5": { inPerM: 1, outPerM: 5 },

  // OpenAI
  "openai/gpt-5.6-sol": { inPerM: 5, outPerM: 30 },
  "openai/gpt-5.6-terra": { inPerM: 2, outPerM: 12 },
  "openai/gpt-5.6-luna": { inPerM: 0.2, outPerM: 1.2 },
  "openai/gpt-5.5": { inPerM: 5, outPerM: 30 },
  "openai/gpt-5.4": { inPerM: 2.5, outPerM: 15 },
  "openai/gpt-5.4-mini": { inPerM: 0.75, outPerM: 4.5 },
  "openai/gpt-5.4-nano": { inPerM: 0.2, outPerM: 1.25 },

  // xAI Grok（<200k prompt）
  "xai/grok-4.5": { inPerM: 2, outPerM: 6 },
  "xai/grok-4.3": { inPerM: 1.25, outPerM: 2.5 },
  "xai/grok-4.1-fast": { inPerM: 0.2, outPerM: 0.5 },

  // DeepSeek（cache miss）
  "deepseek/deepseek-v4-flash": { inPerM: 0.14, outPerM: 0.28 },
  "deepseek/deepseek-v4-pro": { inPerM: 0.435, outPerM: 0.87 },

  // Perplexity Sonar（トークンのみ。リクエスト課金は別途）
  "perplexity/sonar": { inPerM: 1, outPerM: 1 },
  "perplexity/sonar-pro": { inPerM: 3, outPerM: 15 },
};

function normalizeModelKey(modelId: string): string {
  return modelId.trim();
}

/** 直結単価表に載っているとき USD/トークンを返す */
export function getVendorTokenRates(modelId: string): {
  promptPerTok: number;
  completionPerTok: number;
} | null {
  const key = normalizeModelKey(modelId);
  const row = VENDOR_RATES_PER_M[key];
  if (!row) return null;
  return {
    promptPerTok: row.inPerM / 1_000_000,
    completionPerTok: row.outPerM / 1_000_000,
  };
}

export function listVendorPricedModelIds(): string[] {
  return Object.keys(VENDOR_RATES_PER_M);
}
