/**
 * 設定 UI のモデル候補（OpenRouter model ID を `value` に格納）。
 * 単価は OpenRouter API `GET /api/v1/models` の prompt/completion（$/トークン）× 1M（2026-07-08 取得）。
 * @see https://openrouter.ai/docs/api/api-reference/models/get-models
 */

function aoOpenRouterPresetLabel(
  openRouterId: string,
  inUsdPerMillion: number,
  outUsdPerMillion: number,
  /** プルダウン表示名（省略時は ID のスラッシュ右側） */
  displayName?: string,
): { value: string; label: string } {
  const slash = openRouterId.indexOf("/");
  const name = displayName ?? (slash >= 0 ? openRouterId.slice(slash + 1) : openRouterId);
  const ins = inUsdPerMillion.toFixed(2);
  const outs = outUsdPerMillion.toFixed(2);
  return {
    value: openRouterId,
    label: `${name}(IN:$${ins}/OUT:$${outs})`,
  };
}

function aoLlmPresetModelSortKey(p: { value: string; label: string }): string {
  const i = p.label.indexOf("(");
  return (i >= 0 ? p.label.slice(0, i) : p.label).toLowerCase();
}

function aoSortPresets(rows: ReadonlyArray<{ value: string; label: string }>) {
  return [...rows].sort((a, b) => aoLlmPresetModelSortKey(a).localeCompare(aoLlmPresetModelSortKey(b), "en"));
}

/** 画像添付（vision）対応 */
const AO_LLM_MODEL_PRESET_VISION_UNSORTED: ReadonlyArray<{ value: string; label: string }> = [
  aoOpenRouterPresetLabel("google/gemini-2.5-flash-lite", 0.1, 0.4, "gemini-2.5-flash-lite"),
  aoOpenRouterPresetLabel("openai/gpt-4o-mini", 0.15, 0.6),
  aoOpenRouterPresetLabel("google/gemini-2.5-flash", 0.3, 2.5),
  aoOpenRouterPresetLabel("openai/gpt-4.1-mini", 0.4, 1.6),
  aoOpenRouterPresetLabel("google/gemini-3.1-flash-lite", 0.25, 1.5, "gemini-3.1-flash-lite"),
  aoOpenRouterPresetLabel("openai/gpt-5-mini", 0.25, 2.0, "gpt-5-mini"),
  aoOpenRouterPresetLabel("openai/gpt-5.4-mini", 0.75, 4.5),
  aoOpenRouterPresetLabel("anthropic/claude-haiku-4.5", 1.0, 5.0, "claude-4.5-haiku"),
  aoOpenRouterPresetLabel("google/gemini-2.5-pro", 1.25, 10.0),
  aoOpenRouterPresetLabel("openai/gpt-5", 1.25, 10.0, "gpt-5"),
  aoOpenRouterPresetLabel("google/gemini-3.5-flash", 1.5, 9.0, "gemini-3.5-flash"),
  aoOpenRouterPresetLabel("openai/gpt-4.1", 2.0, 8.0),
  aoOpenRouterPresetLabel("openai/gpt-5.4", 2.5, 15.0),
  aoOpenRouterPresetLabel("google/gemini-3.1-pro-preview", 2.0, 12.0, "gemini-3.1-pro"),
  aoOpenRouterPresetLabel("anthropic/claude-sonnet-4.5", 3.0, 15.0, "claude-sonnet-4.5"),
  aoOpenRouterPresetLabel("anthropic/claude-sonnet-4.6", 3.0, 15.0, "claude-sonnet-4.6"),
  aoOpenRouterPresetLabel("anthropic/claude-opus-4.6", 5.0, 25.0),
];

/**
 * 試験用・テキストのみ（OpenRouter 上 vision 非対応。画像添付は不可）。
 */
const AO_LLM_MODEL_PRESET_TEXT_EXPERIMENTAL_UNSORTED: ReadonlyArray<{ value: string; label: string }> = [
  aoOpenRouterPresetLabel("deepseek/deepseek-chat", 0.2, 0.8, "deepseek-v3"),
  aoOpenRouterPresetLabel("deepseek/deepseek-v3.2", 0.23, 0.34, "deepseek-v3.2"),
  aoOpenRouterPresetLabel("deepseek/deepseek-r1", 0.7, 2.5, "deepseek-r1"),
  aoOpenRouterPresetLabel("deepseek/deepseek-r1-0528", 0.5, 2.15, "deepseek-r1-0528"),
];

export const AO_LLM_MODEL_PRESETS_VISION = aoSortPresets(AO_LLM_MODEL_PRESET_VISION_UNSORTED);

export const AO_LLM_MODEL_PRESETS_TEXT_EXPERIMENTAL = aoSortPresets(
  AO_LLM_MODEL_PRESET_TEXT_EXPERIMENTAL_UNSORTED,
);

/** 令旨 UI・表示用（vision + 試験テキスト） */
export const AO_LLM_MODEL_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "環境既定（LLM_MODEL / OPENAI_MODEL）" },
  ...AO_LLM_MODEL_PRESETS_VISION,
  ...AO_LLM_MODEL_PRESETS_TEXT_EXPERIMENTAL,
];
