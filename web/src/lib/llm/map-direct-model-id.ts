import type { LlmProvider } from "@/lib/llm/types";

/**
 * UI の model slug（`vendor/` 除去後）を各社直結 API の model 名へ。
 */
const ANTHROPIC_DIRECT_OVERRIDES: Readonly<Record<string, string>> = {
  "claude-fable-5": "claude-fable-5",
  "claude-opus-5": "claude-opus-5",
  "claude-sonnet-5": "claude-sonnet-5",
  "claude-opus-4.8": "claude-opus-4-8",
  "claude-opus-4.7": "claude-opus-4-7",
  "claude-opus-4.6": "claude-opus-4-6",
  "claude-sonnet-4.6": "claude-sonnet-4-6",
  "claude-sonnet-4.5": "claude-sonnet-4-5",
  "claude-haiku-4.5": "claude-haiku-4-5",
  "claude-3.5-haiku": "claude-3-5-haiku",
};

function anthropicDirectModelId(slug: string): string {
  const hit = ANTHROPIC_DIRECT_OVERRIDES[slug];
  if (hit) return hit;
  if (/^claude-/.test(slug) && slug.includes(".")) {
    return slug.replace(/\./g, "-");
  }
  return slug;
}

export function toDirectApiModelId(provider: LlmProvider, modelSlug: string): string {
  const slug = modelSlug.trim();
  if (!slug) return slug;
  switch (provider) {
    case "anthropic":
      return anthropicDirectModelId(slug);
    case "google":
    case "openai":
    case "xai":
    case "deepseek":
    case "perplexity":
    case "openrouter":
    default:
      return slug;
  }
}
