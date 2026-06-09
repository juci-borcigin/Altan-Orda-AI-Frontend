import type { LlmRoute } from "@/lib/llm/types";

/** OpenAI 直結の新系モデルは `max_tokens` 非対応（`max_completion_tokens` のみ） */
function openAiUsesMaxCompletionTokens(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (!id) return false;
  if (id.startsWith("gpt-5")) return true;
  if (id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4")) return true;
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
  payload.max_tokens = budget;
}
