import { buildHistorySummaryPrompt } from "@/lib/ao-history-compress";
import { estimateCompletionUsdForModel } from "@/lib/ao-usage-estimate";
import { resolveLlmRoute } from "@/lib/llm/resolve-route";
import { completionHeaders } from "@/lib/llm/router";

function resolveSummaryModelId(): string {
  return (
    process.env.AO_SUMMARY_MODEL?.trim() ||
    process.env.LLM_SUMMARY_MODEL?.trim() ||
    "anthropic/claude-haiku-4.5"
  );
}

export type SummarizeHistoryResult = {
  text: string;
  promptTokens: number;
  completionTokens: number;
  modelId: string;
  estimatedUsd: number | null;
};

/** 履歴要約用の短い completion（格安モデル推奨） */
export async function summarizeHistoryWithLlm(
  existingSummary: string,
  newTurnsText: string,
): Promise<SummarizeHistoryResult> {
  const configuredModelId = resolveSummaryModelId();
  const fallbackText = [existingSummary.trim(), newTurnsText.trim()]
    .filter(Boolean)
    .join("\n\n---\n\n")
    .slice(0, 12_000);
  const emptyUsage = {
    promptTokens: 0,
    completionTokens: 0,
    modelId: configuredModelId,
    estimatedUsd: null as number | null,
  };

  const route = resolveLlmRoute(configuredModelId);
  if (!route.apiKey) {
    return { text: fallbackText, ...emptyUsage };
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
    return { text: fallbackText, ...emptyUsage };
  }

  let json: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    return {
      text: existingSummary.trim() || newTurnsText.trim().slice(0, 8000),
      ...emptyUsage,
    };
  }
  const text =
    json.choices?.[0]?.message?.content?.trim() ||
    existingSummary.trim() ||
    newTurnsText.trim().slice(0, 8000);
  const promptTokens = Math.max(0, Math.floor(json.usage?.prompt_tokens ?? 0));
  const completionTokens = Math.max(0, Math.floor(json.usage?.completion_tokens ?? 0));
  const estimatedUsd = await estimateCompletionUsdForModel(
    promptTokens,
    completionTokens,
    configuredModelId,
  );
  return {
    text,
    promptTokens,
    completionTokens,
    modelId: configuredModelId,
    estimatedUsd,
  };
}
