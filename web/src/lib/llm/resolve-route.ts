import { toDirectApiModelId } from "@/lib/llm/map-direct-model-id";
import type { LlmProvider, LlmRoute } from "@/lib/llm/types";

/** 環境既定（脱 OR: OpenAI 直結を既定とする） */
export function resolveEnvLlmDefaults(): { baseUrl: string; apiKey: string; model: string } {
  const baseRaw =
    process.env.LLM_API_BASE_URL?.trim() ||
    process.env.OPENAI_API_BASE_URL?.trim() ||
    "https://api.openai.com/v1";
  const baseUrl = baseRaw.replace(/\/$/, "");
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    "";
  const model =
    process.env.LLM_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "openai/gpt-5.4-mini";
  return { baseUrl, apiKey, model };
}

export function hasAnyLlmCredential(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.LLM_API_KEY?.trim() ||
      resolveGoogleApiKey() ||
      process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.XAI_API_KEY?.trim() ||
      process.env.DEEPSEEK_API_KEY?.trim() ||
      process.env.PERPLEXITY_API_KEY?.trim(),
  );
}

function parseModelVendor(modelId: string): LlmProvider | null {
  const slash = modelId.indexOf("/");
  if (slash < 0) return null;
  const prefix = modelId.slice(0, slash);
  if (
    prefix === "google" ||
    prefix === "anthropic" ||
    prefix === "openai" ||
    prefix === "xai" ||
    prefix === "deepseek" ||
    prefix === "perplexity"
  ) {
    return prefix;
  }
  return null;
}

/** プレフィックス無し ID からベンダー推定（環境既定向け） */
function inferVendorFromSlug(modelId: string): LlmProvider | null {
  const id = modelId.trim().toLowerCase();
  if (!id) return null;
  if (id.startsWith("claude-")) return "anthropic";
  if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3")) return "openai";
  if (id.startsWith("gemini-")) return "google";
  if (id.startsWith("grok-")) return "xai";
  if (id.startsWith("deepseek")) return "deepseek";
  if (id.startsWith("sonar")) return "perplexity";
  return null;
}

function stripVendorPrefix(modelId: string): string {
  const slash = modelId.indexOf("/");
  return slash >= 0 ? modelId.slice(slash + 1) : modelId;
}

/** Google AI Studio の Gemini API キー（`GEMINI_API_KEY` 優先、互換で `GOOGLE_API_KEY`） */
export function resolveGoogleApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
}

function emptyRoute(provider: LlmProvider, modelId: string, baseUrl: string): LlmRoute {
  return { provider, baseUrl, apiKey: "", modelId };
}

function openRouterRoute(configuredModelId: string): LlmRoute {
  const env = resolveEnvLlmDefaults();
  const apiKey = process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  const base =
    process.env.LLM_API_BASE_URL?.trim()?.replace(/\/$/, "") || "https://openrouter.ai/api/v1";
  return {
    provider: "openrouter",
    baseUrl: base.includes("openrouter") ? base : "https://openrouter.ai/api/v1",
    apiKey,
    modelId: configuredModelId.trim() || env.model,
  };
}

function forceOpenRouter(): boolean {
  const v = (process.env.AO_LLM_FORCE_OPENROUTER ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * 論設定の model_id（vendor/slug）から直結ルートを決める。
 * 方針: 常時直結。例外は `AO_LLM_FORCE_OPENROUTER=1` のみ（開発時に明示）。
 * キー欠落時は apiKey 空のルートを返し、呼び出し側でエラーにする（OR へ黙って落とさない）。
 */
export function resolveLlmRoute(configuredModelId: string): LlmRoute {
  const env = resolveEnvLlmDefaults();
  const raw = configuredModelId.trim() || env.model;

  if (forceOpenRouter()) return openRouterRoute(raw);

  const vendor = parseModelVendor(raw) ?? inferVendorFromSlug(stripVendorPrefix(raw));
  const slug = stripVendorPrefix(raw);

  if (vendor === "google") {
    const key = resolveGoogleApiKey();
    return {
      provider: "google",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: key,
      modelId: toDirectApiModelId("google", slug),
    };
  }
  if (vendor === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim() || "";
    return {
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: key,
      modelId: toDirectApiModelId("anthropic", slug),
    };
  }
  if (vendor === "openai") {
    const key = process.env.OPENAI_API_KEY?.trim() || "";
    return {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: key,
      modelId: toDirectApiModelId("openai", slug),
    };
  }
  if (vendor === "xai") {
    const key = process.env.XAI_API_KEY?.trim() || "";
    return {
      provider: "xai",
      baseUrl: "https://api.x.ai/v1",
      apiKey: key,
      modelId: toDirectApiModelId("xai", slug),
    };
  }
  if (vendor === "deepseek") {
    const key = process.env.DEEPSEEK_API_KEY?.trim() || "";
    return {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      apiKey: key,
      modelId: toDirectApiModelId("deepseek", slug),
    };
  }
  if (vendor === "perplexity") {
    const key = process.env.PERPLEXITY_API_KEY?.trim() || "";
    return {
      provider: "perplexity",
      baseUrl: "https://api.perplexity.ai",
      apiKey: key,
      modelId: toDirectApiModelId("perplexity", slug),
    };
  }

  // ベンダー不明: OpenAI キーがあれば直結、なければ空（エラー）
  const oai = process.env.OPENAI_API_KEY?.trim() || "";
  if (oai) {
    return {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: oai,
      modelId: toDirectApiModelId("openai", slug || raw),
    };
  }
  return emptyRoute("openai", slug || raw, "https://api.openai.com/v1");
}

/** Perplexity Sonar 系（内蔵検索あり）。Tavily 二重検索を避ける判定用 */
export function isPerplexitySonarModelId(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  return id.startsWith("perplexity/") || id.startsWith("sonar");
}
