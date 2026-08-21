import { estimateCompletionUsdForModel } from "@/lib/ao-usage-estimate";

/** USD / 1M tokens（OpenAI 公式。直結 API 用フォールバック） */
const DIRECT_LLM_USD_PER_M: Record<string, { in: number; out: number }> = {
  "gpt-5.6-luna": { in: 1.0, out: 6.0 },
  "gpt-5.6-terra": { in: 2.5, out: 15.0 },
  "gpt-5.6-sol": { in: 5.0, out: 30.0 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1": { in: 2.0, out: 8.0 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10.0 },
};

/**
 * 画像モデル別の公式系単価例（USD / 枚）。
 * テキスト入力トークン分はプロンプトが短いため省略（誤差）。
 */
const GPT_IMAGE_1_MINI_USD: Record<string, Record<string, number>> = {
  low: { "1024x1024": 0.005, "1024x1536": 0.006, "1536x1024": 0.006 },
  medium: { "1024x1024": 0.011, "1024x1536": 0.015, "1536x1024": 0.015 },
  high: { "1024x1024": 0.036, "1024x1536": 0.052, "1536x1024": 0.052 },
};

/** gpt-image-2（OpenAI 公開の出力例に基づく概算） */
const GPT_IMAGE_2_USD: Record<string, Record<string, number>> = {
  low: {
    "1024x1024": 0.006,
    "1024x1536": 0.005,
    "1536x1024": 0.005,
    "2048x1152": 0.006,
  },
  medium: {
    "1024x1024": 0.053,
    "1024x1536": 0.041,
    "1536x1024": 0.041,
    "2048x1152": 0.048,
  },
  high: {
    "1024x1024": 0.211,
    "1024x1536": 0.165,
    "1536x1024": 0.165,
    "2048x1152": 0.192,
  },
};

export function imageGenerationUsdPerImage(
  modelId = "gpt-image-2",
  opts?: { size?: string; quality?: string },
): number {
  const env = process.env.AO_COURSE_IMAGE_USD_PER_IMAGE?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n >= 0) return n;
  }

  const quality = (opts?.quality ?? "low").toLowerCase();
  const size = opts?.size ?? "1536x1024";
  if (modelId.includes("gpt-image-2")) {
    const byQ = GPT_IMAGE_2_USD[quality] ?? GPT_IMAGE_2_USD.low!;
    return byQ[size] ?? byQ["1536x1024"] ?? 0.005;
  }
  if (modelId.includes("gpt-image-1-mini") || modelId === "gpt-image-1-mini") {
    const byQ = GPT_IMAGE_1_MINI_USD[quality] ?? GPT_IMAGE_1_MINI_USD.low!;
    return byQ[size] ?? byQ["1536x1024"] ?? 0.006;
  }
  if (modelId.includes("1.5") || modelId.includes("gpt-image-1")) return 0.04;
  return 0.01;
}

function directRatesForModel(modelId: string): { in: number; out: number } | null {
  const bare = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  return DIRECT_LLM_USD_PER_M[bare] ?? null;
}

export async function estimateLlmCostUsd(
  promptTokens: number,
  completionTokens: number,
  modelId: string,
): Promise<number | null> {
  const fromOr = await estimateCompletionUsdForModel(promptTokens, completionTokens, modelId);
  if (fromOr != null) return fromOr;

  const direct = directRatesForModel(modelId);
  if (!direct) return null;
  const raw =
    (promptTokens / 1_000_000) * direct.in + (completionTokens / 1_000_000) * direct.out;
  return Math.round(raw * 1e6) / 1e6;
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 0.0001) return `<$0.0001`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

/** 画像生成時に付与（既存プロンプトが「漢字禁止」でも漢字テストできるよう） */
export const COURSE_IMAGE_LABEL_LANG_NOTE =
  " Labels in the diagram may be English or Japanese kanji (漢字). Prefer short words; avoid long sentences. Include at least a few Japanese kanji labels when the diagram teaches a concept (e.g. 光, 電子, 波, 確率).";

export function withImageLabelLangNote(prompt: string): string {
  const p = prompt.trim();
  if (!p) return p;
  if (/kanji|漢字|日本語/.test(p)) return p;
  return `${p}${COURSE_IMAGE_LABEL_LANG_NOTE}`;
}
