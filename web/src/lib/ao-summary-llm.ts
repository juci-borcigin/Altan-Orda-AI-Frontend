import { buildHistorySummaryPrompt } from "@/lib/ao-history-compress";

function resolveSummaryLlm(): { baseUrl: string; apiKey: string; model: string } {
  const baseRaw =
    process.env.LLM_API_BASE_URL?.trim() ||
    process.env.OPENAI_API_BASE_URL?.trim() ||
    "https://api.openai.com/v1";
  const baseUrl = baseRaw.replace(/\/$/, "");
  const apiKey =
    process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  const model =
    process.env.AO_SUMMARY_MODEL?.trim() ||
    process.env.LLM_SUMMARY_MODEL?.trim() ||
    "anthropic/claude-haiku-4.5";
  return { baseUrl, apiKey, model };
}

/** 履歴要約用の短い completion（格安モデル推奨） */
export async function summarizeHistoryWithLlm(
  existingSummary: string,
  newTurnsText: string,
): Promise<string> {
  const { baseUrl, apiKey, model } = resolveSummaryLlm();
  if (!apiKey) {
    return [existingSummary.trim(), newTurnsText.trim()].filter(Boolean).join("\n\n---\n\n").slice(0, 12_000);
  }

  const prompt = buildHistorySummaryPrompt(existingSummary, newTurnsText);
  const url = `${baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(baseUrl.includes("openrouter.ai") ? { "HTTP-Referer": "https://altan-orda.local" } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2048,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
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
