/** 設定 UI のモデル候補（OpenRouter 形式の ID を想定）。先頭の空値は環境既定。 */
export const AO_LLM_MODEL_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "環境既定（LLM_MODEL / OPENAI_MODEL）" },
  { value: "openai/gpt-4.1-mini", label: "openai/gpt-4.1-mini" },
  { value: "openai/gpt-5.4-mini", label: "openai/gpt-5.4-mini" },
  { value: "anthropic/claude-sonnet-4.5", label: "anthropic/claude-sonnet-4.5" },
  { value: "google/gemini-2.5-flash", label: "google/gemini-2.5-flash" },
  { value: "google/gemini-2.5-pro", label: "google/gemini-2.5-pro" },
];
