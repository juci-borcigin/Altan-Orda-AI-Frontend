import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAoPromptOverrides } from "@/lib/ao-prompt-supabase";
import { loadProjectLlmModel } from "@/lib/ao-project-llm-supabase";
import {
  type AoPromptSectionKey,
  buildAoSystemPrompt,
  detectNamedSpeaker,
  getSpeakerAllowSet,
} from "@/lib/ao-prompts";
import type { ProjectId } from "@/lib/ao-types";
import { storeEmbeddingsForMessageTexts } from "@/lib/embedding-pipeline";
import { buildJapanNowSystemPrefix } from "@/lib/ao-chat-context";
import { buildRagInjectionBlock } from "@/lib/rag-context";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { addCompletionUsageToAgg } from "@/lib/ao-completion-usage";
import { estimateCompletionUsdForModel } from "@/lib/ao-usage-estimate";

type InMsg = {
  role: "user" | "assistant";
  content: string;
};

type ReqBody = {
  projectId: ProjectId;
  messages: InMsg[];
  /** クライアント議事 ID（th_*）。永続化時に必須 */
  clientThreadId?: string;
  threadTitle?: string;
  /** Supabase threads.id（uuid） */
  supabaseThreadId?: string | null;
};

type OutChunk = { speaker: string; text: string };

const MAX_TOOL_ROUNDS = 2;
const MAX_FORMAT_RETRY = 2;

/** LLM / Tavily の 1 リクエストあたり（秒）。既定はツール経路を考慮して長め。Vercel の関数上限に合わせて短くする場合は env で調整 */
function requestTimeoutMs(): number {
  const raw = process.env.AO_CHAT_REQUEST_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 5_000) return Math.floor(n);
  return 120_000;
}

const DEFAULT_MAX_TOKENS = 2048;

function isMockMode(): boolean {
  const v = (process.env.AO_MOCK_LLM ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isDryRunMode(): boolean {
  const v = (process.env.AO_LLM_DRY_RUN ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Tavily / tool 経路の確認用。本番では通常オフ。 */
function isChatDebugMode(): boolean {
  const v = (process.env.AO_CHAT_DEBUG ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * 完了トークン上限の天井。8192 はモデル／ゲートウェイによっては拒否されるため既定 4096。
 * それでも上げる場合のみ LLM_MAX_TOKENS_CEILING を設定する。
 */
function resolveCompletionCeiling(): number {
  const raw = process.env.LLM_MAX_TOKENS_CEILING?.trim();
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 4096;
  return Math.max(256, Math.min(8192, Math.floor(n)));
}

function resolveMaxTokens(): number {
  const ceiling = resolveCompletionCeiling();
  const raw = process.env.LLM_MAX_TOKENS?.trim();
  const n = raw ? Number(raw) : NaN;
  const requested = Number.isFinite(n) ? Math.floor(n) : DEFAULT_MAX_TOKENS;
  return Math.max(256, Math.min(ceiling, requested));
}

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

function serializeOutboundChatMessages(messages: ChatMessage[]): string {
  try {
    return JSON.stringify(messages, null, 2);
  } catch {
    return "[serialize error]";
  }
}

function trimHistory(projectId: ProjectId, messages: InMsg[]): InMsg[] {
  const short =
    projectId === "debate" ||
    projectId === "gemini" ||
    projectId === "claude" ||
    projectId === "chat" ||
    projectId === "chatgpt";
  const max = short ? 12 : 20;
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

function isJsonlParseFallback(chunks: OutChunk[], rawText: string): boolean {
  if (chunks.length !== 1) return false;
  const c = chunks[0];
  if (c.speaker !== "不明") return false;
  const t = (rawText ?? "").trim();
  // raw が空 or JSONL として 1 行も成立しない場合のフォールバック
  return c.text === "（空）" || t.length === 0 || c.text === t;
}

/**
 * 名指しがあるターンはその speaker のみ（僚友8名のいずれか）。
 * それ以外は論ごとの許可集合。
 */
function allowedSpeakers(projectId: ProjectId, namedSpeaker: string | null): Set<string> {
  return getSpeakerAllowSet(projectId, namedSpeaker);
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
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type ChatTurnUsagePayload = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number | null;
  modelId: string;
};

async function buildTurnUsagePayload(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): Promise<ChatTurnUsagePayload> {
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedUsd: await estimateCompletionUsdForModel(promptTokens, completionTokens, modelId),
    modelId,
  };
}

async function postChatCompletion(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<CompletionJson> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (name === "AbortError" || msg.includes("aborted")) {
      throw new Error(
        `LLM リクエストがタイムアウトまたは中断されました（AO_CHAT_REQUEST_TIMEOUT_MS=${requestTimeoutMs()}）。ツール検索後の再生成には時間がかかることがあります。`,
      );
    }
    throw e;
  }
  const errText = await res.text().catch(() => "");
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 2000)}`);
  }
  try {
    return JSON.parse(errText) as CompletionJson;
  } catch {
    const preview = errText.trim().slice(0, 240).replace(/\s+/g, " ");
    const sseHint =
      preview.startsWith("data:") || errText.includes("\ndata:")
        ? " （応答が SSE ストリーム形式です。stream:false を付与済みかゲートウェイ設定を確認してください）"
        : "";
    throw new Error(
      `LLM invalid JSON${sseHint} content-type=${ct || "?"} len=${errText.length} preview=${JSON.stringify(preview)}`,
    );
  }
}

function normalizeDbSourceProvider(sp: string | null | undefined): string | null {
  if (sp == null) return null;
  const t = String(sp).trim();
  return t.length ? t : null;
}

/** 巷間論（project_id=chat）はログに残さない */
function allowsSupabaseThreadPersist(projectId: ProjectId): boolean {
  return projectId !== "chat";
}

/**
 * AO ネイティブ（source_provider=ao）のみ threads/messages を更新。
 * 書庫取り込み（claude / chatgpt / gemini 等）は閲覧のみで永続化しない。
 */
async function prepareChatPersistence(
  supa: SupabaseClient,
  body: ReqBody,
): Promise<{ threadUuid: string | null; persistMessages: boolean }> {
  const cid = body.clientThreadId?.trim();
  if (!cid || !allowsSupabaseThreadPersist(body.projectId)) {
    return { threadUuid: null, persistMessages: false };
  }

  const titleFromClient = body.threadTitle?.trim() ?? "";
  const titleForRow = titleFromClient || "議事";

  if (body.supabaseThreadId?.trim()) {
    const sid = body.supabaseThreadId.trim();
    const { data: byPk, error: e1 } = await supa
      .from("threads")
      .select("id, source_provider")
      .eq("id", sid)
      .maybeSingle();
    if (e1) console.error("[chat] fetch thread:", e1.message);
    if (byPk?.id) {
      const sp = normalizeDbSourceProvider(byPk.source_provider as string | null);
      if (sp != null && sp.toLowerCase() !== "ao") {
        return { threadUuid: null, persistMessages: false };
      }
      await supa
        .from("threads")
        .update({
          title: titleForRow,
          client_thread_id: cid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", byPk.id);
      return { threadUuid: byPk.id as string, persistMessages: true };
    }
  }

  const { data: byClient, error: e2 } = await supa
    .from("threads")
    .select("id, source_provider")
    .eq("client_thread_id", cid)
    .maybeSingle();
  if (e2) console.error("[chat] fetch thread by client:", e2.message);
  if (byClient?.id) {
    const sp = normalizeDbSourceProvider(byClient.source_provider as string | null);
    if (sp != null && sp.toLowerCase() !== "ao") {
      return { threadUuid: null, persistMessages: false };
    }
    await supa
      .from("threads")
      .update({
        title: titleForRow,
        updated_at: new Date().toISOString(),
      })
      .eq("id", byClient.id);
    return { threadUuid: byClient.id as string, persistMessages: true };
  }

  const { data: ins, error: e3 } = await supa
    .from("threads")
    .insert({
      title: titleForRow,
      project_id: body.projectId,
      client_thread_id: cid,
      source_provider: "ao",
    })
    .select("id")
    .single();

  if (e3 || !ins?.id) {
    console.error("[chat] thread insert:", e3?.message);
    return { threadUuid: null, persistMessages: false };
  }
  return { threadUuid: ins.id as string, persistMessages: true };
}

export async function POST(req: Request) {
  const maxTokens = resolveMaxTokens();
  const mockMode = isMockMode();
  const dryRunMode = isDryRunMode();

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = body.projectId;

  const { baseUrl, apiKey, model } = resolveLlmConfig();
  if (!apiKey && !mockMode && !dryRunMode) {
    return NextResponse.json(
      { error: "LLM_API_KEY or OPENAI_API_KEY is not set" },
      { status: 500 },
    );
  }

  const supaForModel = getSupabaseAdmin();
  let effectiveModel = model;
  if (supaForModel) {
    try {
      const ov = await loadProjectLlmModel(supaForModel, projectId);
      if (ov?.trim()) effectiveModel = ov.trim();
    } catch (e) {
      console.error("[chat] loadProjectLlmModel", e);
    }
  }
  const userMsgs = Array.isArray(body.messages) ? body.messages : [];
  const trimmed = trimHistory(projectId, userMsgs);

  const userOnly = trimmed.filter((m) => m.role === "user");
  const lastUser = userOnly[userOnly.length - 1]?.content ?? "";
  const isFirstUserTurn = userOnly.length === 1;
  const casualMode = lastUser.includes("雑談");
  const namedSpeaker = detectNamedSpeaker(lastUser);

  const tavilyEnabled = Boolean(process.env.TAVILY_API_KEY?.trim());
  const tavilySuffix = tavilyEnabled
    ? "\n\n【ツール】最新の事実・ニュース・数値の確認などに必要なときのみ `web_search` を使う（引数は query のみ）。不要な検索はしない。"
    : "";

  const supa = supaForModel;
  let promptOverrides: Partial<Record<AoPromptSectionKey, string>> = {};
  if (supa) {
    try {
      promptOverrides = await loadAoPromptOverrides(supa);
    } catch (e) {
      console.error("[chat] loadAoPromptOverrides", e);
    }
  }

  const nowPrefix = buildJapanNowSystemPrefix();

  let system =
    nowPrefix +
    "\n\n" +
    buildAoSystemPrompt(
      {
        projectId,
        lastUserText: lastUser,
        isFirstUserTurn,
        casualMode,
        namedSpeaker,
      },
      promptOverrides,
    ) +
    tavilySuffix;

  if (dryRunMode) {
    const provider = baseUrl.includes("openrouter.ai") ? "openrouter" : "openai_direct";
    const headers = completionHeaders(apiKey || "DUMMY", baseUrl);
    // 秘密情報は返さない（Authorization は常に伏せる）
    const safeHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === "authorization") safeHeaders[k] = "Bearer ***";
      else safeHeaders[k] = v;
    }

    const text =
      [
        `{"speaker":"モンケウール","text":"（dry-run）外部LLMは呼ばれていません。スイッチ判定のみ実行しました。"}`,
        `{"speaker":"モンケウール","text":"provider=${provider}, baseUrl=${baseUrl}"}`,
        `{"speaker":"モンケウール","text":"model=${effectiveModel}, max_tokens=${maxTokens}, tavilyEnabled=${tavilyEnabled}"}`,
      ].join("\n") + "\n";
    const rawChunks = parseJsonl(text);
    const chunks = filterChunks(rawChunks, projectId, namedSpeaker);
    const usageDry = await buildTurnUsagePayload(effectiveModel, 0, 0);
    const dryOutbound: ChatMessage[] = [
      { role: "system", content: system },
      ...trimmed.map((m) => ({ role: m.role, content: m.content })),
    ];
    const rawPromptSentDry = serializeOutboundChatMessages(dryOutbound);
    return NextResponse.json({
      chunks,
      rawContent: text,
      usage: usageDry,
      rawPrompts: { sent: rawPromptSentDry, received: text },
      llm: {
        mode: "dry-run",
        provider,
        baseUrl,
        model: effectiveModel,
        max_tokens: maxTokens,
        headers: safeHeaders,
        toolsEnabled: tavilyEnabled,
      },
      ...(isChatDebugMode()
        ? {
            chatDebug: {
              phase: "dry-run",
              note: "外部 LLM / Tavily は実行されていません",
              tavilyApiKeyPresent: tavilyEnabled,
              toolsWouldAttachToLiveRequest: tavilyEnabled,
              completionRoundCount: 0,
              toolFollowupLoops: 0,
              webSearchInvocations: 0,
              webSearchQueries: [] as string[],
              usage: usageDry,
            },
          }
        : {}),
    });
  }

  if (mockMode) {
    const named = namedSpeaker ? `（名指し: ${namedSpeaker}）` : "";
    const text =
      [
        `{"speaker":"不明","text":"（モック応答）外部LLMは呼ばれていません。${named}"}`,
        `{"speaker":"不明","text":"projectId=${projectId}, messages=${trimmed.length}, tavilyEnabled=${tavilyEnabled}"}`,
        `{"speaker":"不明","text":"lastUser=${lastUser.replace(/\\s+/g, " ").slice(0, 160)}"}`,
      ].join("\n") + "\n";
    const rawChunks = parseJsonl(text);
    const chunks = filterChunks(rawChunks, projectId, namedSpeaker);
    const usageMock = await buildTurnUsagePayload(effectiveModel, 0, 0);
    const mockOutbound: ChatMessage[] = [
      { role: "system", content: system },
      ...trimmed.map((m) => ({ role: m.role, content: m.content })),
    ];
    const rawPromptSentMock = serializeOutboundChatMessages(mockOutbound);
    return NextResponse.json({
      chunks,
      rawContent: text,
      usage: usageMock,
      rawPrompts: { sent: rawPromptSentMock, received: text },
      llm: {
        mode: "mock",
        model: effectiveModel,
        max_tokens: maxTokens,
        toolsEnabled: tavilyEnabled,
      },
      ...(isChatDebugMode()
        ? {
            chatDebug: {
              phase: "mock",
              note: "外部 LLM / Tavily は実行されていません",
              tavilyApiKeyPresent: tavilyEnabled,
              toolsWouldAttachToLiveRequest: tavilyEnabled,
              completionRoundCount: 0,
              toolFollowupLoops: 0,
              webSearchInvocations: 0,
              webSearchQueries: [] as string[],
              usage: usageMock,
            },
          }
        : {}),
    });
  }

  let injectionBlock = "";
  if (supa) {
    try {
      injectionBlock = await buildRagInjectionBlock({
        supa,
        userMessage: lastUser,
        isFirstUserTurn,
        openAiKey: process.env.OPENAI_API_KEY,
      });
    } catch (e) {
      console.error("[chat] rag injection", e);
    }
  }

  system =
    nowPrefix +
    "\n\n" +
    buildAoSystemPrompt(
      {
        projectId,
        lastUserText: lastUser,
        isFirstUserTurn,
        casualMode,
        namedSpeaker,
        injectionBlock: injectionBlock || undefined,
      },
      promptOverrides,
    ) +
    tavilySuffix;

  let persistedThreadUuid: string | null = null;
  let persistMessages = false;
  let lastCompletionJson: CompletionJson | null = null;

  if (supa && body.clientThreadId?.trim()) {
    try {
      const plan = await prepareChatPersistence(supa, body);
      persistMessages = plan.persistMessages;
      persistedThreadUuid = plan.threadUuid;
      if (persistMessages && persistedThreadUuid) {
        const { error: ue } = await supa.from("messages").insert({
          thread_id: persistedThreadUuid,
          role: "user",
          text: lastUser,
          provider: "openrouter",
          model_id: effectiveModel,
        });
        if (ue) console.error("[chat] persist user message:", ue.message);
      }
    } catch (e) {
      console.error("[chat] supabase user persist", e);
    }
  }

  const messages: ChatMessage[] = [{ role: "system", content: system }, ...trimmed];

  const url = `${baseUrl}/chat/completions`;
  const headers = completionHeaders(apiKey, baseUrl);
  const tools = tavilyEnabled ? [WEB_SEARCH_TOOL] : undefined;

  let finalContent = "";
  let formatRetry = 0;
  let toolRounds = 0;
  let completionRoundCount = 0;
  let webSearchInvocationCount = 0;
  const webSearchQueriesForDebug: string[] = [];
  const unsupportedToolNamesForDebug: string[] = [];
  const usageAgg = { prompt: 0, completion: 0 };

  try {
    while (true) {
      completionRoundCount += 1;
      const forceNoTools = toolRounds >= MAX_TOOL_ROUNDS;
      const payload: Record<string, unknown> = {
        model: effectiveModel,
        temperature: 0.7,
        max_tokens: maxTokens,
        messages,
        /** ゲートウェイによっては既定がストリームになり JSON.parse が失敗するため明示 */
        stream: false,
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
        AbortSignal.timeout(requestTimeoutMs()),
      );

      addCompletionUsageToAgg(usageAgg, json);

      const msg = json.choices?.[0]?.message;
      if (!msg) {
        throw new Error("LLM response missing choices[0].message");
      }

      const calls = msg.tool_calls;
      if (forceNoTools || !calls?.length) {
        finalContent = typeof msg.content === "string" ? msg.content : "";
        lastCompletionJson = json;
        if (isChatDebugMode()) {
          console.log(
            "[chat-debug] final assistant message: tool_calls=",
            calls?.length ?? 0,
            "forceNoTools=",
            forceNoTools,
            "completionRounds=",
            completionRoundCount,
          );
        }
        // C: JSONL 形式が崩れている（1行も JSON として読めない）場合は、最大2回だけ再思考させる
        const probeChunks = parseJsonl(finalContent);
        if (formatRetry < MAX_FORMAT_RETRY && isJsonlParseFallback(probeChunks, finalContent)) {
          formatRetry += 1;
          // 次ラウンドはツール無しで、形式強制の追記を入れて再実行
          messages.push({
            role: "system",
            content:
              "【重要: 出力形式の再実行】直前の出力が JSON Lines 形式ではありませんでした。必ず 1行=1発言の JSON のみで出力せよ。余計な文字（説明・空行・見出し・Markdown）は一切出さない。",
          });
          // toolRounds を MAX にして強制的に tool_choice=none へ
          toolRounds = MAX_TOOL_ROUNDS;
          continue;
        }
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
          webSearchInvocationCount += 1;
          if (isChatDebugMode()) {
            webSearchQueriesForDebug.push(query.trim().slice(0, 320));
            console.log("[chat-debug] web_search invocation", webSearchInvocationCount, "query=", query.slice(0, 120));
          }
          let toolText: string;
          try {
            toolText = await tavilySearch(query, AbortSignal.timeout(requestTimeoutMs()));
          } catch (e: unknown) {
            toolText = JSON.stringify({
              error: "search_failed",
              detail: e instanceof Error ? e.message : String(e),
            });
          }
          messages.push({ role: "tool", tool_call_id: id, content: toolText });
        } else {
          if (isChatDebugMode() && name && unsupportedToolNamesForDebug.length < 12) {
            unsupportedToolNamesForDebug.push(name);
          }
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
      {
        error: "LLM or search error",
        detail: detail.slice(0, 2000),
        // デバッグ用（秘密は含めない）
        llm: {
          baseUrl,
          model: effectiveModel,
          max_tokens: maxTokens,
          toolsEnabled: Boolean(process.env.TAVILY_API_KEY?.trim()),
        },
        ...(isChatDebugMode()
          ? {
              chatDebug: {
                phase: "error",
                tavilyApiKeyPresent: Boolean(process.env.TAVILY_API_KEY?.trim()),
                completionRoundCount,
                toolFollowupLoops: toolRounds,
                webSearchInvocations: webSearchInvocationCount,
                webSearchQueries: [...webSearchQueriesForDebug],
                unsupportedToolNames: [...unsupportedToolNamesForDebug],
              },
            }
          : {}),
      },
      { status: 502 },
    );
  }

  const usagePayload = await buildTurnUsagePayload(effectiveModel, usageAgg.prompt, usageAgg.completion);

  const rawChunks = parseJsonl(finalContent);
  const chunks = filterChunks(rawChunks, projectId, namedSpeaker);
  const rawPromptSentLive = serializeOutboundChatMessages(messages);
  const rawPromptReceivedLive = finalContent;

  if (persistMessages && persistedThreadUuid && supa && chunks.length > 0) {
    try {
      const rawPayload = {
        rawContent: finalContent,
        completion: lastCompletionJson,
      };
      const usdRow = usagePayload.estimatedUsd;
      const rows = chunks.map((c, i) => ({
        thread_id: persistedThreadUuid,
        role: "assistant",
        text: c.text,
        persona: c.speaker,
        provider: "openrouter",
        model_id: effectiveModel,
        raw_response: i === 0 ? rawPayload : null,
        prompt_tokens: i === 0 ? usageAgg.prompt : null,
        completion_tokens: i === 0 ? usageAgg.completion : null,
        token_count: i === 0 ? usageAgg.prompt + usageAgg.completion : null,
        usd_estimate: i === 0 ? usdRow : null,
        raw_prompt_sent: i === 0 ? rawPromptSentLive : null,
        raw_prompt_received: i === 0 ? rawPromptReceivedLive : null,
      }));
      const { data: insertedRows, error: ae } = await supa
        .from("messages")
        .insert(rows)
        .select("id, text");
      if (ae) console.error("[chat] persist assistant messages:", ae.message);
      await supa
        .from("threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", persistedThreadUuid);

      const oai = process.env.OPENAI_API_KEY?.trim();
      if (oai && insertedRows?.length) {
        void storeEmbeddingsForMessageTexts(
          supa,
          insertedRows.map((r: { id: string; text: string }) => ({ id: r.id, text: r.text })),
          oai,
        ).catch((e) => console.error("[chat] embedding pipeline", e));
      }
    } catch (e) {
      console.error("[chat] supabase assistant persist", e);
    }
  }

  return NextResponse.json({
    chunks,
    rawContent: finalContent,
    usage: usagePayload,
    rawPrompts: { sent: rawPromptSentLive, received: rawPromptReceivedLive },
    ...(persistMessages && persistedThreadUuid ? { supabaseThreadId: persistedThreadUuid } : {}),
    ...(isChatDebugMode()
      ? {
          chatDebug: {
            phase: "live",
            tavilyApiKeyPresent: tavilyEnabled,
            toolsAttachedToPayload: Boolean(tools),
            maxToolRounds: MAX_TOOL_ROUNDS,
            completionRoundCount,
            toolFollowupLoops: toolRounds,
            webSearchInvocations: webSearchInvocationCount,
            webSearchQueries: [...webSearchQueriesForDebug],
            unsupportedToolNames: [...unsupportedToolNamesForDebug],
            usage: usagePayload,
          },
        }
      : {}),
  });
}
