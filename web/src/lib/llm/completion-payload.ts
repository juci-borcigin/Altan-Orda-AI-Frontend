import type { LlmRoute } from "@/lib/llm/types";

function stripVendor(modelId: string): string {
  const i = modelId.indexOf("/");
  return i >= 0 ? modelId.slice(i + 1) : modelId;
}

function normalizedModelSlug(modelId: string): string {
  return stripVendor(modelId).trim().toLowerCase();
}

/**
 * OpenAI: GPT-5 以降・o 系は `max_tokens` 非対応（`max_completion_tokens`）。
 * 将来の gpt-6 等もメジャー >= 5 で拾う。
 */
function openAiUsesMaxCompletionTokens(modelId: string): boolean {
  const id = normalizedModelSlug(modelId);
  if (!id) return false;
  if (/^gpt-([5-9]|\d{2,})([.-]|$)/.test(id)) return true;
  if (/^o[1-9]\b/.test(id)) return true;
  return false;
}

/**
 * OpenAI / OR: sampling を拒否する系（GPT-5 以降・o 系）。
 */
function openAiRejectsSampling(modelId: string): boolean {
  return openAiUsesMaxCompletionTokens(modelId);
}

/**
 * Anthropic: sampling（temperature 等）を拒否する系。
 * - 世代メジャー >= 5（Sonnet/Opus/Fable/Mythos 5, 6, …）
 * - Opus 4.7 以降（4.6 以前は従来どおり temperature 可。Haiku 4.5 も可）
 */
function anthropicRejectsSampling(modelId: string): boolean {
  const id = normalizedModelSlug(modelId);
  if (!id.includes("claude")) return false;

  const major = id.match(/claude-(?:sonnet|opus|fable|mythos)-(\d+)\b/);
  if (major && Number(major[1]) >= 5) return true;

  const opus4 = id.match(/claude-opus-4(?:[-.](\d+))?/);
  if (opus4) {
    const minor = opus4[1] != null ? Number(opus4[1]) : 0;
    if (minor >= 7) return true;
  }
  return false;
}

/**
 * sampling（temperature 等）を拒否するモデルか。
 * 方針: AO は原則 sampling を送らない。本判定は万一載った場合の保険。
 * 個別 ID 列挙ではなく世代ルールで将来モデルも拾う。
 */
export function llmRejectsSamplingParams(route: LlmRoute): boolean {
  const id = route.modelId.trim();
  if (!id) return false;

  if (route.provider === "openai") return openAiRejectsSampling(id);
  if (route.provider === "anthropic") return anthropicRejectsSampling(id);

  // OpenRouter 例外経路: スラッグから判定
  if (route.provider === "openrouter") {
    return openAiRejectsSampling(id) || anthropicRejectsSampling(id);
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

  const slug = route.modelId;
  const useMaxCompletion =
    (route.provider === "openai" && openAiUsesMaxCompletionTokens(slug)) ||
    (route.provider === "openrouter" && openAiUsesMaxCompletionTokens(slug));

  if (useMaxCompletion) {
    payload.max_completion_tokens = budget;
    return;
  }
  payload.max_tokens = budget;
}

/**
 * モデル非対応の sampling パラメータを落とす。
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

/**
 * `/v1/chat/completions` + function tools では reasoning 付きが不可な系がある
 *（例: gpt-5.6-*）。tools 付き時は `reasoning_effort: "none"` を明示する。
 */
export function applyChatCompletionsToolReasoningCompat(
  payload: Record<string, unknown>,
  route: LlmRoute,
): void {
  if (!payload.tools) return;
  if (route.provider !== "openai" && route.provider !== "openrouter") return;
  const id = normalizedModelSlug(route.modelId);
  // GPT-5.6 系（sol/terra/luna 等）。将来同制約なら gpt-5.7+ もここへ広げる。
  if (!/^gpt-5\.6\b/.test(id)) return;
  payload.reasoning_effort = "none";
}
