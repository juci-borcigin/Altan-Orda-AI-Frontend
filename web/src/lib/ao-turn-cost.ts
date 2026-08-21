/**
 * 発言ごとの付帯単価（Tavily / embedding）と鮮度。
 * ベンダー LLM 表は ao-vendor-pricing.ts。動作中に TTL 経過で再読込を試みる。
 */

/** 手書き単価のレビュー日（YYYY-MM-DD）。コード更新時に合わせて上げる */
export const AO_ANCILLARY_PRICING_AS_OF = "2026-08-04";

/** 約 14 日（月 2 回程度） */
export const AO_PRICING_FRESHNESS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const DEFAULT_TAVILY_USD = 0.008;
/** text-embedding-3-small おおよそ（USD / 1M tokens） */
const DEFAULT_EMBED_USD_PER_M = 0.02;

type AncillaryRates = {
  tavilyUsdPerQuery: number;
  embeddingUsdPerMTok: number;
  asOf: string;
  loadedAt: number;
};

let ratesMem: AncillaryRates | null = null;
let lastStaleWarnedAt = 0;

function readAncillaryFromEnv(): Pick<AncillaryRates, "tavilyUsdPerQuery" | "embeddingUsdPerMTok" | "asOf"> {
  const tavilyRaw = process.env.AO_TAVILY_USD_PER_QUERY?.trim();
  const embedRaw = process.env.AO_EMBEDDING_USD_PER_MTOK?.trim();
  const asOfEnv = process.env.AO_PRICING_RATES_AS_OF?.trim();
  const tavily = tavilyRaw != null && tavilyRaw !== "" ? Number(tavilyRaw) : DEFAULT_TAVILY_USD;
  const embed = embedRaw != null && embedRaw !== "" ? Number(embedRaw) : DEFAULT_EMBED_USD_PER_M;
  return {
    tavilyUsdPerQuery: Number.isFinite(tavily) && tavily >= 0 ? tavily : DEFAULT_TAVILY_USD,
    embeddingUsdPerMTok: Number.isFinite(embed) && embed >= 0 ? embed : DEFAULT_EMBED_USD_PER_M,
    asOf: asOfEnv || AO_ANCILLARY_PRICING_AS_OF,
  };
}

function asOfToMs(asOf: string): number {
  const t = Date.parse(`${asOf}T00:00:00Z`);
  return Number.isFinite(t) ? t : 0;
}

function loadAncillaryRates(force: boolean): AncillaryRates {
  const now = Date.now();
  if (!force && ratesMem && now - ratesMem.loadedAt < AO_PRICING_FRESHNESS_TTL_MS) {
    return ratesMem;
  }
  const base = readAncillaryFromEnv();
  ratesMem = { ...base, loadedAt: now };
  return ratesMem;
}

/**
 * チャット等の処理のついでに呼ぶ。TTL 超えなら env を再読込し、OR 単価キャッシュを捨てる。
 * バッチジョブは作らない。
 */
export async function maybeRefreshPricingOnAoActivity(): Promise<{
  asOf: string;
  refreshed: boolean;
  stale: boolean;
}> {
  const prev = ratesMem;
  const now = Date.now();
  const need =
    !prev || now - prev.loadedAt >= AO_PRICING_FRESHNESS_TTL_MS;
  const rates = loadAncillaryRates(need);
  const stale = now - asOfToMs(rates.asOf) >= AO_PRICING_FRESHNESS_TTL_MS;

  if (need) {
    try {
      const { invalidateOpenRouterPricingCache } = await import("@/lib/ao-openrouter-pricing");
      invalidateOpenRouterPricingCache();
    } catch {
      /* ignore */
    }
  }

  if (stale && now - lastStaleWarnedAt > AO_PRICING_FRESHNESS_TTL_MS) {
    lastStaleWarnedAt = now;
    console.warn(
      `[ao-pricing] rates may be stale (asOf=${rates.asOf}). Update ao-vendor-pricing / AO_PRICING_RATES_AS_OF or env overrides.`,
    );
  }

  return { asOf: rates.asOf, refreshed: need, stale };
}

export function getTavilyUsdPerQuery(): number {
  return loadAncillaryRates(false).tavilyUsdPerQuery;
}

export function getEmbeddingUsdPerMTok(): number {
  return loadAncillaryRates(false).embeddingUsdPerMTok;
}

export function getAncillaryPricingAsOf(): string {
  return loadAncillaryRates(false).asOf;
}

/** 文字数から embedding トークン概算（日本語混じり ≈ 4 文字/tok） */
export function approxEmbedTokensFromChars(chars: number): number {
  return Math.max(0, Math.ceil(Math.max(0, chars) / 4));
}

export function estimateEmbeddingUsdFromChars(chars: number): number {
  const tok = approxEmbedTokensFromChars(chars);
  const usd = (tok / 1_000_000) * getEmbeddingUsdPerMTok();
  return Math.round(usd * 1e6) / 1e6;
}

export function estimateTavilyUsd(queryCount: number): number {
  const n = Math.max(0, Math.floor(queryCount));
  return Math.round(n * getTavilyUsdPerQuery() * 1e6) / 1e6;
}

export type TurnCostBreakdown = {
  llmUsd: number | null;
  summaryUsd: number | null;
  tavilyUsd: number | null;
  embeddingUsd: number | null;
  totalUsd: number | null;
  tavilyQueries: number;
  summaryPromptTokens?: number;
  summaryCompletionTokens?: number;
  embeddingApproxTokens?: number;
  pricingAsOf: string;
};

function finiteOrNull(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function sumTurnCostUsd(parts: Array<number | null | undefined>): number | null {
  const nums = parts.map(finiteOrNull).filter((x): x is number => x != null);
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
}

export function buildTurnCostBreakdown(opts: {
  llmUsd: number | null;
  summaryUsd?: number | null;
  summaryPromptTokens?: number;
  summaryCompletionTokens?: number;
  tavilyQueries?: number;
  embeddingChars?: number;
}): TurnCostBreakdown {
  const tavilyQueries = Math.max(0, Math.floor(opts.tavilyQueries ?? 0));
  const tavilyUsd = tavilyQueries > 0 ? estimateTavilyUsd(tavilyQueries) : null;
  const embChars = opts.embeddingChars ?? 0;
  const embTok = embChars > 0 ? approxEmbedTokensFromChars(embChars) : 0;
  const embeddingUsd = embChars > 0 ? estimateEmbeddingUsdFromChars(embChars) : null;
  const summaryUsd = finiteOrNull(opts.summaryUsd);
  const llmUsd = finiteOrNull(opts.llmUsd);
  const totalUsd = sumTurnCostUsd([llmUsd, summaryUsd, tavilyUsd, embeddingUsd]);
  return {
    llmUsd,
    summaryUsd,
    tavilyUsd,
    embeddingUsd,
    totalUsd,
    tavilyQueries,
    ...(opts.summaryPromptTokens != null ? { summaryPromptTokens: opts.summaryPromptTokens } : {}),
    ...(opts.summaryCompletionTokens != null
      ? { summaryCompletionTokens: opts.summaryCompletionTokens }
      : {}),
    ...(embTok > 0 ? { embeddingApproxTokens: embTok } : {}),
    pricingAsOf: getAncillaryPricingAsOf(),
  };
}
