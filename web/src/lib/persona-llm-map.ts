/**
 * 全ペルソナを OpenRouter 経由に統一。直 API は使用しない。
 * メタデータ（messages.model_id）用。実 LLM 呼び出しは route.ts の単一モデル設定。
 * マップに無い speaker は LLM_MODEL / OPENAI_MODEL にフォールバック。
 */
export const PERSONA_LLM_MAP: Record<
  string,
  {
    model: string;
    maxHistory?: number;
  }
> = {
  フナン: { model: "openai/gpt-4.1-mini" }, // 正式ID: openai/gpt-4.1-mini
  モンケウール: { model: "openai/gpt-4.1-mini" }, // 正式ID: openai/gpt-4.1-mini
  ケテ: { model: "openai/gpt-4.1-mini" }, // 正式ID: openai/gpt-4.1-mini
  バイジュ: { model: "openai/gpt-4.1-mini" }, // 正式ID: openai/gpt-4.1-mini
  耶律楚材: { model: "anthropic/claude-sonnet-4.5" }, // 正式ID: anthropic/claude-sonnet-4.5
  ソルコクタニ: { model: "google/gemini-2.5-flash" }, // 正式ID: google/gemini-2.5-flash
};

export function resolvePersonaModelId(persona: string, fallbackModel: string): string {
  const row = PERSONA_LLM_MAP[persona];
  return row?.model ?? fallbackModel;
}
