import { buildHistorySummaryPrompt } from "@/lib/ao-history-compress";
import { resolveLlmRoute } from "@/lib/llm/resolve-route";
import { completionHeaders } from "@/lib/llm/router";

function resolveSummaryModelId(): string {
  return (
    process.env.AO_SUMMARY_MODEL?.trim() ||
    process.env.LLM_SUMMARY_MODEL?.trim() ||
    "anthropic/claude-haiku-4.5"
  );
}

/** 履歴要約用の短い completion（格安モデル推奨） */
export async function summarizeHistoryWithLlm(
  existingSummary: string,
  newTurnsText: string,
): Promise<string> {
  const configuredModelId = resolveSummaryModelId();
  const route = resolveLlmRoute(configuredModelId);
  if (!route.apiKey) {
    return [existingSummary.trim(), newTurnsText.trim()].filter(Boolean).join("\n\n---\n\n").slice(0, 12_000);
  }

  const prompt = buildHistorySummaryPrompt(existingSummary, newTurnsText);
  const url = `${route.baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: completionHeaders(route),
    body: JSON.stringify({
      model: route.modelId,
      max_tokens: 2048,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error("[history-summary] LLM error", res.status, raw.slice(0, 400));
    return [existingSummary.trim(), newTurnsText.trim()].filter(Boolean).join("\n\n---\n\n").slice(0, 12_000);
  }

  let json: { choices?: Array<{ message?: { content?: string } }> };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    return existingSummary.trim() || newTurnsText.trim().slice(0, 8000);
  }
  const text = json.choices?.[0]?.message?.content?.trim();
  return text || existingSummary.trim() || newTurnsText.trim().slice(0, 8000);
}
