/** OpenAI Chat Completions の `stream: true` 応答（`data: {...}` 行）を読む */

export type OpenAiStreamCompletion = {
  content: string;
  finishReason: string | null;
  nativeFinishReason: string | null;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
};

function extractDeltaText(delta: unknown): string {
  if (!delta || typeof delta !== "object") return "";
  const d = delta as Record<string, unknown>;
  const content = d.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    let out = "";
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "text" && typeof p.text === "string") out += p.text;
      else if (typeof p.text === "string") out += p.text;
    }
    return out;
  }
  return "";
}

function parseSseDataLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const lines: string[] = [];
  for (const line of parts) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith("data:")) lines.push(trimmed.slice(5).trimStart());
  }
  return { lines, rest };
}

/**
 * `stream: true` の chat/completions 応答本文を蓄積する。
 * `onContent` は増分ごとに呼ばれる（UI 更新用）。
 */
export async function readOpenAiChatCompletionStream(
  res: Response,
  onContent: (fullContent: string, delta: string) => void,
): Promise<OpenAiStreamCompletion> {
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 2000)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("LLM stream body missing");

  const dec = new TextDecoder();
  let buf = "";
  let content = "";
  let finishReason: string | null = null;
  let nativeFinishReason: string | null = null;
  let usage: OpenAiStreamCompletion["usage"] = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const { lines, rest } = parseSseDataLines(buf);
    buf = rest;
    for (const data of lines) {
      if (!data || data === "[DONE]") continue;
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }
      const u = json.usage;
      if (u && typeof u === "object") {
        usage = u as OpenAiStreamCompletion["usage"];
      }
      const choice0 = Array.isArray(json.choices) ? json.choices[0] : null;
      if (!choice0 || typeof choice0 !== "object") continue;
      const c0 = choice0 as Record<string, unknown>;
      if (typeof c0.finish_reason === "string") finishReason = c0.finish_reason;
      if (typeof c0.native_finish_reason === "string") nativeFinishReason = c0.native_finish_reason;
      const delta = c0.delta;
      const piece = extractDeltaText(delta);
      if (!piece) continue;
      content += piece;
      onContent(content, piece);
    }
  }

  return { content, finishReason, nativeFinishReason, usage };
}

export async function postOpenAiChatCompletionStream(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onContent: (fullContent: string, delta: string) => void,
): Promise<OpenAiStreamCompletion> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (name === "AbortError" || msg.includes("aborted")) {
      throw new Error("LLM ストリームがタイムアウトまたは中断されました。");
    }
    throw e;
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream") && !ct.includes("application/x-ndjson")) {
    const errText = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 2000)}`);
    try {
      const json = JSON.parse(errText) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: OpenAiStreamCompletion["usage"];
      };
      const msg = json.choices?.[0]?.message;
      const text =
        typeof msg?.content === "string"
          ? msg.content
          : "";
      if (text) onContent(text, text);
      return {
        content: text,
        finishReason: json.choices?.[0]?.finish_reason ?? null,
        nativeFinishReason: null,
        usage: json.usage ?? null,
      };
    } catch {
      throw new Error(`LLM stream expected SSE, got: ${errText.slice(0, 240)}`);
    }
  }
  return readOpenAiChatCompletionStream(res, onContent);
}
