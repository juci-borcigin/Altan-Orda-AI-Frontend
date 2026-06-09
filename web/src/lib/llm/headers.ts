import type { LlmRoute } from "@/lib/llm/types";

export function completionHeaders(route: LlmRoute): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${route.apiKey}`,
  };
  if (route.provider === "openrouter" || route.baseUrl.includes("openrouter.ai")) {
    const referer = process.env.OPENROUTER_SITE_URL?.trim();
    if (referer) h["HTTP-Referer"] = referer;
    h["X-Title"] = "Altan Orda AI";
  }
  if (route.provider === "anthropic") {
    h["anthropic-version"] = "2023-06-01";
  }
  return h;
}
