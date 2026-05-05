/**
 * OpenRouter 公開 API のモデル単価（USD / トークン）をメモリキャッシュする。
 * /api/chat の概算 USD に利用。フェッチ失敗時は呼び出し側で env フォールバック。
 */

const MODELS_URL = "https://openrouter.ai/api/v1/models";

export type OpenRouterTokenRates = { promptPerTok: number; completionPerTok: number };

type Cache = { loadedAt: number; byId: Map<string, OpenRouterTokenRates> };

let memoryCache: Cache | null = null;

function ttlMs(): number {
  const sec = Number(process.env.AO_OPENROUTER_PRICING_TTL_SEC ?? "3600");
  return (Number.isFinite(sec) && sec >= 60 ? sec : 3600) * 1000;
}

async function fetchPricingMapFresh(): Promise<Map<string, OpenRouterTokenRates>> {
  const map = new Map<string, OpenRouterTokenRates>();
  try {
    const res = await fetch(MODELS_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[ao-openrouter-pricing] models HTTP", res.status);
      return map;
    }
    const json = (await res.json()) as {
      data?: Array<{ id?: string; pricing?: { prompt?: string; completion?: string } }>;
    };
    for (const m of json.data ?? []) {
      const mid = typeof m.id === "string" ? m.id.trim() : "";
      if (!mid) continue;
      const pp = Number(m.pricing?.prompt);
      const cc = Number(m.pricing?.completion);
      if (!Number.isFinite(pp) || !Number.isFinite(cc)) continue;
      map.set(mid, { promptPerTok: pp, completionPerTok: cc });
    }
  } catch (e) {
    console.error("[ao-openrouter-pricing]", e instanceof Error ? e.message : e);
  }
  return map;
}

async function loadPricingMap(): Promise<Map<string, OpenRouterTokenRates>> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.loadedAt < ttlMs()) return memoryCache.byId;

  const byId = await fetchPricingMapFresh();
  memoryCache = { loadedAt: now, byId };
  return byId;
}

/** OpenRouter の models に載っている id と一致するとき、USD/トークン単価を返す */
export async function getOpenRouterTokenRates(modelId: string): Promise<OpenRouterTokenRates | null> {
  const id = modelId.trim();
  if (!id) return null;
  const map = await loadPricingMap();
  return map.get(id) ?? null;
}
