/**
 * 設定 UI のモデル候補（vision 対応のみ。OpenRouter model ID を `value` に格納）。
 * 単価は OpenRouter 掲載の $/100万トークン（2026-05 時点の目安）。改定は各モデルページで要確認。
 * @see https://openrouter.ai/
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

/** vision 対応モデルのみ（添付画像利用時） */
const AO_LLM_MODEL_PRESET_ROWS_UNSORTED: ReadonlyArray<{ value: string; label: string }> = [
  aoOpenRouterPresetLabel("google/gemini-2.0-flash-001", 0.1, 0.4),
  aoOpenRouterPresetLabel("openai/gpt-4o-mini", 0.15, 0.6),
  aoOpenRouterPresetLabel("google/gemini-2.5-flash", 0.3, 2.5),
  aoOpenRouterPresetLabel("openai/gpt-4.1-mini", 0.4, 1.6),
  aoOpenRouterPresetLabel("openai/gpt-5.4-mini", 0.75, 4.5),
  aoOpenRouterPresetLabel("anthropic/claude-3.5-haiku", 0.8, 4.0),
  aoOpenRouterPresetLabel("anthropic/claude-haiku-4.5", 1.0, 5.0, "claude-4.5-haiku"),
  aoOpenRouterPresetLabel("google/gemini-2.5-pro", 1.25, 10.0),
  aoOpenRouterPresetLabel("openai/gpt-5.4", 2.5, 15.0),
  aoOpenRouterPresetLabel("anthropic/claude-sonnet-4.5", 3.0, 15.0),
  aoOpenRouterPresetLabel("anthropic/claude-sonnet-4.6", 3.0, 15.0),
  aoOpenRouterPresetLabel("anthropic/claude-opus-4.6", 5.0, 25.0),
];

export const AO_LLM_MODEL_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "環境既定（LLM_MODEL / OPENAI_MODEL）" },
  ...[...AO_LLM_MODEL_PRESET_ROWS_UNSORTED].sort((a, b) =>
    aoLlmPresetModelSortKey(a).localeCompare(aoLlmPresetModelSortKey(b), "en"),
  ),
];
