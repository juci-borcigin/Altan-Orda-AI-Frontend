/** 設定 UI のモデル候補（OpenRouter 形式の ID を想定）。先頭の空値は環境既定。 */
export const AO_LLM_MODEL_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "環境既定（LLM_MODEL / OPENAI_MODEL）" },
  // Anthropic
  { value: "anthropic/claude-sonnet-4.6", label: "anthropic/claude-sonnet-4.6" },
  { value: "anthropic/claude-sonnet-4.5", label: "anthropic/claude-sonnet-4.5" },
  // OpenAI
  { value: "openai/gpt-5.4", label: "openai/gpt-5.4" },
  { value: "openai/gpt-5.4-mini", label: "openai/gpt-5.4-mini" },
  { value: "openai/gpt-4.1-mini", label: "openai/gpt-4.1-mini" },
  // Google
  { value: "google/gemini-2.5-pro-preview", label: "google/gemini-2.5-pro-preview" },
  { value: "google/gemini-2.5-pro", label: "google/gemini-2.5-pro" },
  { value: "google/gemini-2.5-flash", label: "google/gemini-2.5-flash" },
];
