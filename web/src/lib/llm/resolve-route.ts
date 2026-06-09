import { toDirectApiModelId } from "@/lib/llm/map-direct-model-id";
import type { LlmProvider, LlmRoute } from "@/lib/llm/types";

/** 環境既定（OpenRouter 互換ベース URL + 既定 model） */
export function resolveEnvLlmDefaults(): { baseUrl: string; apiKey: string; model: string } {
  const baseRaw =
    process.env.LLM_API_BASE_URL?.trim() ||
    process.env.OPENAI_API_BASE_URL?.trim() ||
    "https://api.openai.com/v1";
  const baseUrl = baseRaw.replace(/\/$/, "");
  const apiKey =
    process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  const model =
    process.env.LLM_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini";
  return { baseUrl, apiKey, model };
}

export function hasAnyLlmCredential(): boolean {
  return Boolean(
    process.env.LLM_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      resolveGoogleApiKey() ||
      process.env.ANTHROPIC_API_KEY?.trim(),
  );
}

function parseModelVendor(modelId: string): LlmProvider | null {
  const slash = modelId.indexOf("/");
  if (slash < 0) return null;
  const prefix = modelId.slice(0, slash);
  if (prefix === "google" || prefix === "anthropic" || prefix === "openai") return prefix;
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

function openRouterRoute(configuredModelId: string): LlmRoute {
  const env = resolveEnvLlmDefaults();
  return {
    provider: "openrouter",
    baseUrl: env.baseUrl,
    apiKey: env.apiKey,
    modelId: configuredModelId.trim() || env.model,
  };
}

/**
 * 論設定の model_id（OpenRouter 形式）から、直結 or OpenRouter のルートを決める。
 * `AO_LLM_FORCE_OPENROUTER=1` で常に OpenRouter。
 */
export function resolveLlmRoute(configuredModelId: string): LlmRoute {
  const forceOr =
    (process.env.AO_LLM_FORCE_OPENROUTER ?? "").trim().toLowerCase() === "1" ||
    (process.env.AO_LLM_FORCE_OPENROUTER ?? "").trim().toLowerCase() === "true";

  if (forceOr) return openRouterRoute(configuredModelId);

  const vendor = parseModelVendor(configuredModelId);
  if (vendor === "google") {
    const key = resolveGoogleApiKey();
    if (key) {
      return {
        provider: "google",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: key,
        modelId: toDirectApiModelId("google", stripVendorPrefix(configuredModelId)),
      };
    }
  }
  if (vendor === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (key) {
      const slug = stripVendorPrefix(configuredModelId);
      return {
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: key,
        modelId: toDirectApiModelId("anthropic", slug),
      };
    }
  }
  if (vendor === "openai") {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (key) {
      return {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: key,
        modelId: toDirectApiModelId("openai", stripVendorPrefix(configuredModelId)),
      };
    }
  }

  return openRouterRoute(configuredModelId);
}
