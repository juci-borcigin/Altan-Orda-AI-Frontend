import { NextResponse } from "next/server";
import {
  buildAoSystemPrompt,
  detectNamedSpeaker,
  FOUR_LORDS,
} from "@/lib/ao-prompts";
import type { ProjectId } from "@/lib/ao-types";

type InMsg = {
  role: "user" | "assistant";
  content: string;
};

type ReqBody = {
  projectId: ProjectId;
  messages: InMsg[];
};

type OutChunk = { speaker: string; text: string };

const MAX_TOOL_ROUNDS = 2;
const REQUEST_TIMEOUT_MS = 10_000;

const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "Search the web for current facts, news, or verification. Use only when necessary. Argument: query string only.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
};

type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};

function trimHistory(projectId: ProjectId, messages: InMsg[]): InMsg[] {
  const max =
    projectId === "kurultai" ||
    projectId === "gemini" ||
    projectId === "claude"
      ? 12
      : 20;
  if (messages.length <= max) return messages;
  return messages.slice(messages.length - max);
}

function parseJsonl(text: string): OutChunk[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: OutChunk[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Partial<OutChunk>;
      if (typeof obj.speaker === "string" && typeof obj.text === "string") {
        out.push({ speaker: obj.speaker, text: obj.text });
      }
    } catch {
      // ignore invalid lines
    }
  }

  if (out.length) return out;

  return [{ speaker: "不明", text: text.trim() || "（空）" }];
}

function isValidLord(name: string): boolean {
  return (FOUR_LORDS as readonly string[]).includes(name);
}

/**
 * 名指しがあるターンはその speaker のみ。
 * それ以外はゲルごとの許可集合。
 */
function allowedSpeakers(
  projectId: ProjectId,
  namedSpeaker: string | null,
): Set<string> {
  if (namedSpeaker && isValidLord(namedSpeaker)) {
    return new Set([namedSpeaker]);
  }
  if (projectId === "nesho") {
    return new Set(["バイジュ"]);
  }
  return new Set(FOUR_LORDS);
}

function filterChunks(
  chunks: OutChunk[],
  projectId: ProjectId,
  namedSpeaker: string | null,
): OutChunk[] {
  const allow = allowedSpeakers(projectId, namedSpeaker);
  return chunks.map((c) => {
    if (allow.has(c.speaker)) return c;
    return {
      speaker: "不明",
      text: `（speaker不許可: ${c.speaker}）${c.text}`,
    };
  });
}

function resolveLlmConfig(): { baseUrl: string; apiKey: string; model: string } {
  const baseRaw =
    process.env.LLM_API_BASE_URL?.trim() ||
    process.env.OPENAI_API_BASE_URL?.trim() ||
    "https://api.openai.com/v1";
  const baseUrl = baseRaw.replace(/\/$/, "");
  const apiKey =
    process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  const model =
    process.env.LLM_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini";
  return { baseUrl, apiKey, model };
}

function completionHeaders(apiKey: string, baseUrl: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (baseUrl.includes("openrouter.ai")) {
    const referer = process.env.OPENROUTER_SITE_URL?.trim();
    if (referer) h["HTTP-Referer"] = referer;
    h["X-Title"] = "Altan Orda AI";
  }
  return h;
}

async function tavilySearch(query: string, signal: AbortSignal): Promise<string> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) {
    return JSON.stringify({ error: "TAVILY_API_KEY is not configured" });
  }
  const q = query.trim();
  if (!q) {
    return JSON.stringify({ error: "empty query" });
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: q,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    }),
    signal,
  });

  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    return JSON.stringify({
      error: "Tavily request failed",
      status: res.status,
      detail: rawText.slice(0, 800),
    });
  }

  let data: {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  try {
    data = JSON.parse(rawText) as typeof data;
  } catch {
    return JSON.stringify({ error: "invalid Tavily JSON", detail: rawText.slice(0, 400) });
  }

  const lines: string[] = [];
  if (typeof data.answer === "string" && data.answer.trim()) {
    lines.push(`要約: ${data.answer.trim()}`);
  }
  for (const r of data.results ?? []) {
    const title = r.title ?? "";
    const url = r.url ?? "";
    const snippet = (r.content ?? "").slice(0, 450).trim();
    if (title || url) {
      lines.push([title && url ? `${title} — ${url}` : title || url, snippet].filter(Boolean).join("\n"));
    }
  }
  return lines.length ? lines.join("\n\n---\n\n") : "(検索結果なし)";
}

type CompletionJson = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
};

async function postChatCompletion(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<CompletionJson> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  const errText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 2000)}`);
  }
  try {
    return JSON.parse(errText) as CompletionJson;
  } catch {
    throw new Error(`LLM invalid JSON: ${errText.slice(0, 500)}`);
  }
}

export async function POST(req: Request) {
  const { baseUrl, apiKey, model } = resolveLlmConfig();
  if (!apiKey) {
    return NextResponse.json(
      { error: "LLM_API_KEY or OPENAI_API_KEY is not set" },
      { status: 500 },
    );
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = body.projectId;
  const userMsgs = Array.isArray(body.messages) ? body.messages : [];
  const trimmed = trimHistory(projectId, userMsgs);

  const userOnly = trimmed.filter((m) => m.role === "user");
  const lastUser = userOnly[userOnly.length - 1]?.content ?? "";
  const isFirstUserTurn = userOnly.length === 1;
  const casualMode = lastUser.includes("雑談");
  const namedSpeaker = detectNamedSpeaker(lastUser);

  let system = buildAoSystemPrompt({
    projectId,
    lastUserText: lastUser,
    isFirstUserTurn,
    casualMode,
    namedSpeaker,
  });

  const tavilyEnabled = Boolean(process.env.TAVILY_API_KEY?.trim());
  if (tavilyEnabled) {
    system +=
      "\n\n【ツール】最新の事実・ニュース・数値の確認などに必要なときのみ `web_search` を使う（引数は query のみ）。不要な検索はしない。";
  }

  const messages: ChatMessage[] = [{ role: "system", content: system }, ...trimmed];

  const url = `${baseUrl}/chat/completions`;
  const headers = completionHeaders(apiKey, baseUrl);
  const tools = tavilyEnabled ? [WEB_SEARCH_TOOL] : undefined;

  let finalContent = "";
  let toolRounds = 0;

  try {
    while (true) {
      const forceNoTools = toolRounds >= MAX_TOOL_ROUNDS;
      const payload: Record<string, unknown> = {
        model,
        temperature: 0.7,
        messages,
      };
      if (tools && !forceNoTools) {
        payload.tools = tools;
        payload.tool_choice = "auto";
      } else if (tools && forceNoTools) {
        payload.tools = tools;
        payload.tool_choice = "none";
      }

      const json = await postChatCompletion(
        url,
        headers,
        payload,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      );

      const msg = json.choices?.[0]?.message;
      if (!msg) {
        throw new Error("LLM response missing choices[0].message");
      }

      const calls = msg.tool_calls;
      if (forceNoTools || !calls?.length) {
        finalContent = typeof msg.content === "string" ? msg.content : "";
        break;
      }

      toolRounds += 1;
      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: calls,
      });

      for (const tc of calls) {
        const name = tc.function?.name ?? "";
        const id = tc.id ?? `call_${Math.random().toString(36).slice(2)}`;
        if (name === "web_search") {
          let query = "";
          try {
            const args = JSON.parse(tc.function.arguments || "{}") as { query?: unknown };
            query = typeof args.query === "string" ? args.query : "";
          } catch {
            query = "";
          }
          let toolText: string;
          try {
            toolText = await tavilySearch(query, AbortSignal.timeout(REQUEST_TIMEOUT_MS));
          } catch (e: unknown) {
            toolText = JSON.stringify({
              error: "search_failed",
              detail: e instanceof Error ? e.message : String(e),
            });
          }
          messages.push({ role: "tool", tool_call_id: id, content: toolText });
        } else {
          messages.push({
            role: "tool",
            tool_call_id: id,
            content: JSON.stringify({ error: `unsupported tool: ${name}` }),
          });
        }
      }
    }
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "LLM or search error", detail: detail.slice(0, 2000) },
      { status: 502 },
    );
  }

  const rawChunks = parseJsonl(finalContent);
  const chunks = filterChunks(rawChunks, projectId, namedSpeaker);
  return NextResponse.json({ chunks, rawContent: finalContent });
}
