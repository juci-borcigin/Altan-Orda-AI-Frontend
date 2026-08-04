import type { LlmRoute } from "@/lib/llm/types";

/** OpenAI 直結の新系モデルは `max_tokens` 非対応（`max_completion_tokens` のみ） */
function openAiUsesMaxCompletionTokens(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (!id) return false;
  if (id.startsWith("gpt-5")) return true;
  if (id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4")) return true;
  return false;
}

/**
 * sampling（temperature 等）を拒否するモデル。
 * - Anthropic: Sonnet 5 / Opus 5 / Opus 4.7+ / Fable 5（非デフォルト値で 400）
 * - OpenAI: GPT-5 系・o 系（temperature 非対応または 1 以外不可）
 */
export function llmRejectsSamplingParams(route: LlmRoute): boolean {
  const id = route.modelId.trim().toLowerCase();
  if (!id) return false;

  if (route.provider === "openai" || route.provider === "openrouter") {
    if (id.startsWith("gpt-5")) return true;
    if (id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4")) return true;
    // openrouter 形式 openai/gpt-5...
    if (id.includes("/gpt-5")) return true;
  }

  if (route.provider === "anthropic" || route.provider === "openrouter") {
    if (id.includes("claude-sonnet-5")) return true;
    if (id.includes("claude-opus-5")) return true;
    if (id.includes("claude-fable-5")) return true;
    if (id.includes("claude-mythos-5")) return true;
    // Opus 4.7 / 4.8（4.6 以前は temperature 可）
    if (/claude-opus-4-[78]/.test(id) || /claude-opus-4\.[78]/.test(id)) return true;
  }

  return false;
}

/** chat/completions ペイロードへ出力トークン上限を載せる（プロバイダ差を吸収） */
export function applyCompletionBudgetToPayload(
  payload: Record<string, unknown>,
  route: LlmRoute,
  budget: number,
): void {
  delete payload.max_tokens;
  delete payload.max_completion_tokens;

  if (route.provider === "openai" && openAiUsesMaxCompletionTokens(route.modelId)) {
    payload.max_completion_tokens = budget;
    return;
  }
  // OpenRouter 経由でも gpt-5 は max_completion_tokens
  if (route.provider === "openrouter" && openAiUsesMaxCompletionTokens(stripVendor(route.modelId))) {
    payload.max_completion_tokens = budget;
    return;
  }
  payload.max_tokens = budget;
}

function stripVendor(modelId: string): string {
  const i = modelId.indexOf("/");
  return i >= 0 ? modelId.slice(i + 1) : modelId;
}

/**
 * モデル非対応の sampling パラメータを落とす。
 * 既定 temperature を載せる前に呼ぶか、載せたあとに呼ぶ。
 */
export function stripUnsupportedSamplingFromPayload(
  payload: Record<string, unknown>,
  route: LlmRoute,
): void {
  if (!llmRejectsSamplingParams(route)) return;
  delete payload.temperature;
  delete payload.top_p;
  delete payload.top_k;
  delete payload.presence_penalty;
  delete payload.frequency_penalty;
}
