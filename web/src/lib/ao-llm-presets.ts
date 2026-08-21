/**
 * 設定 UI のモデル候補（`vendor/slug`。直結ルーティングのキー）。
 * 単価ラベルはベンダー直結（2026-08-02）。Sonnet 5 は導入価格 $2/$10（〜8/31）。
 */

function aoVendorPresetLabel(
  openRouterStyleId: string,
  inUsdPerMillion: number,
  outUsdPerMillion: number,
  displayName?: string,
): { value: string; label: string } {
  const slash = openRouterStyleId.indexOf("/");
  const name = displayName ?? (slash >= 0 ? openRouterStyleId.slice(slash + 1) : openRouterStyleId);
  const ins = inUsdPerMillion.toFixed(2);
  const outs = outUsdPerMillion.toFixed(2);
  return {
    value: openRouterStyleId,
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

/** 常用・画像添付対応（Anthropic / OpenAI 必須ライン） */
const AO_LLM_MODEL_PRESET_VISION_UNSORTED: ReadonlyArray<{ value: string; label: string }> = [
  aoVendorPresetLabel("anthropic/claude-haiku-4.5", 1.0, 5.0, "claude-haiku-4.5"),
  aoVendorPresetLabel("anthropic/claude-sonnet-4.5", 3.0, 15.0, "claude-sonnet-4.5"),
  aoVendorPresetLabel("anthropic/claude-sonnet-4.6", 3.0, 15.0, "claude-sonnet-4.6"),
  aoVendorPresetLabel("anthropic/claude-sonnet-5", 2.0, 10.0, "claude-sonnet-5★intro"),
  aoVendorPresetLabel("anthropic/claude-opus-4.6", 5.0, 25.0, "claude-opus-4.6"),
  aoVendorPresetLabel("anthropic/claude-opus-4.7", 5.0, 25.0, "claude-opus-4.7"),
  aoVendorPresetLabel("anthropic/claude-opus-4.8", 5.0, 25.0, "claude-opus-4.8"),
  aoVendorPresetLabel("anthropic/claude-opus-5", 5.0, 25.0, "claude-opus-5"),
  aoVendorPresetLabel("openai/gpt-5.4-mini", 0.75, 4.5, "gpt-5.4-mini"),
  aoVendorPresetLabel("openai/gpt-5.4", 2.5, 15.0, "gpt-5.4"),
  aoVendorPresetLabel("openai/gpt-5.5", 5.0, 30.0, "gpt-5.5"),
  aoVendorPresetLabel("openai/gpt-5.6-luna", 0.2, 1.2, "gpt-5.6-luna"),
  aoVendorPresetLabel("openai/gpt-5.6-terra", 2.0, 12.0, "gpt-5.6-terra"),
  aoVendorPresetLabel("openai/gpt-5.6-sol", 5.0, 30.0, "gpt-5.6-sol"),
];

/**
 * 試験枠（直結設定 → UI で検証。失敗時のみ例外で OR を検討）。
 * 添付可否はモデル次第。迷ったらテキストのみ想定。
 */
const AO_LLM_MODEL_PRESET_TEXT_EXPERIMENTAL_UNSORTED: ReadonlyArray<{ value: string; label: string }> = [
  aoVendorPresetLabel("anthropic/claude-fable-5", 10.0, 50.0, "claude-fable-5·試験"),
  aoVendorPresetLabel("openai/gpt-5.4-nano", 0.2, 1.25, "gpt-5.4-nano·試験"),
  aoVendorPresetLabel("xai/grok-4.5", 2.0, 6.0, "grok-4.5·試験"),
  aoVendorPresetLabel("xai/grok-4.3", 1.25, 2.5, "grok-4.3·試験"),
  aoVendorPresetLabel("xai/grok-4.1-fast", 0.2, 0.5, "grok-4.1-fast·試験"),
  aoVendorPresetLabel("deepseek/deepseek-v4-flash", 0.14, 0.28, "deepseek-v4-flash·試験"),
  aoVendorPresetLabel("deepseek/deepseek-v4-pro", 0.435, 0.87, "deepseek-v4-pro·試験"),
  aoVendorPresetLabel("perplexity/sonar", 1.0, 1.0, "sonar·試験(+req)"),
  aoVendorPresetLabel("perplexity/sonar-pro", 3.0, 15.0, "sonar-pro·試験(+req)"),
];

export const AO_LLM_MODEL_PRESETS_VISION = aoSortPresets(AO_LLM_MODEL_PRESET_VISION_UNSORTED);

export const AO_LLM_MODEL_PRESETS_TEXT_EXPERIMENTAL = aoSortPresets(
  AO_LLM_MODEL_PRESET_TEXT_EXPERIMENTAL_UNSORTED,
);

/** 令旨 UI・表示用（常用 vision + 試験） */
export const AO_LLM_MODEL_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "環境既定（LLM_MODEL / OPENAI_MODEL）" },
  ...AO_LLM_MODEL_PRESETS_VISION,
  ...AO_LLM_MODEL_PRESETS_TEXT_EXPERIMENTAL,
];
