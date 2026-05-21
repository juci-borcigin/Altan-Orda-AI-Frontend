import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAoPromptOverrides } from "@/lib/ao-prompt-supabase";
import { loadProjectLlmModel } from "@/lib/ao-project-llm-supabase";
import {
  type AoPromptSectionKey,
  buildAoSystemPrompt,
  detectNamedSpeaker,
  getPrimarySpeakerForProject,
  getSpeakerAllowSet,
  isAllySpeakerName,
} from "@/lib/ao-prompts";
import { tryBuildPhase5ChatSystem } from "@/lib/phase5/build-chat-system";
import { Phase5DbConfigError } from "@/lib/phase5/phase5-db-errors";
import { decodeAssistantTextForUi, isPhase5EligibleProject } from "@/lib/phase5/load-phase5-chat";
import {
  appendMarkdownFormatRetrySystem,
  filterSpeakerChunks,
  isAssistantOutputParseFallback,
  parseAssistantOutput,
} from "@/lib/phase5/phase5-chat-output";
import { normalizeProjectId, type ProjectId } from "@/lib/ao-types";
import { storeEmbeddingsForMessageTexts } from "@/lib/embedding-pipeline";
import { buildJapanNowSystemPrefix } from "@/lib/ao-chat-context";
import {
  RAG_DEFAULT_KIND,
  RAG_MATCH_THRESHOLD,
  normalizeEmbedProjectId,
  searchRagChunks,
  type RagSearchResult,
} from "@/lib/rag-context";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { addCompletionUsageToAgg } from "@/lib/ao-completion-usage";
import { estimateCompletionUsdForModel } from "@/lib/ao-usage-estimate";
import type { MsgChatCompletionMeta } from "@/lib/ao-state";

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
  /** Supabase ao_threads.id（uuid） */
  supabaseThreadId?: string | null;
};

type OutChunk = { speaker: string; text: string };

const MAX_TOOL_ROUNDS = 2;
const MAX_FORMAT_RETRY = 2;

/** JSONL 崩れ時の再指示（1回目） */
const FORMAT_RETRY_SYSTEM_PRIMARY =
  "【重要: 出力形式の再実行】直前の出力が JSON Lines 形式ではありませんでした。必ず 1行=1発言の JSON のみで出力せよ。余計な文字（説明・空行・見出し・Markdown）は一切出さない。";

/** 同一文言の system を連続で積まないための 2 回目（内容が異なるためトークン効率と無限ループ回避の両立） */
const FORMAT_RETRY_SYSTEM_SECONDARY =
  "【重要: 出力形式の再実行（継続）】なおも JSON Lines 以外です。説明文・見出し・コードフェンス・空行は禁止。各行は厳密に {\"speaker\":\"名前\",\"text\":\"本文\"} のみ。";

/**
 * 1  assistant tool ラウンドあたりの web_search 実行上限（超過分は Tavily を呼ばずエラー tool を返す）。
 * 環境変数未設定時は 4（GPT の並列 3 程度は通しつつ、それ以上の乱発を抑える）。
 * Sonnet 系でさらに締める場合は **3** を推奨（`AO_WEB_SEARCH_MAX_PER_ROUND=3`）。
 */
function resolveWebSearchMaxPerRound(): number {
  const raw = process.env.AO_WEB_SEARCH_MAX_PER_ROUND?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 32) return Math.floor(n);
  return 4;
}

function appendFormatRetrySystem(messages: ChatMessage[]): void {
  const last = messages[messages.length - 1];
  if (last?.role === "system" && last.content === FORMAT_RETRY_SYSTEM_PRIMARY) {
    messages.push({ role: "system", content: FORMAT_RETRY_SYSTEM_SECONDARY });
    return;
  }
  if (last?.role === "system" && last.content === FORMAT_RETRY_SYSTEM_SECONDARY) {
    return;
  }
  messages.push({ role: "system", content: FORMAT_RETRY_SYSTEM_PRIMARY });
}

/** LLM / Tavily の 1 リクエストあたり（秒）。既定はツール経路を考慮して長め。Vercel の関数上限に合わせて短くする場合は env で調整 */
function requestTimeoutMs(): number {
  const raw = process.env.AO_CHAT_REQUEST_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 5_000) return Math.floor(n);
  return 120_000;
}

/** ツール無しなら 2048 でも足りることが多いが、思考トークン＋JSONL では不足して本文が空になる例がある */
const DEFAULT_MAX_TOKENS = 4096;

/** Tavily 経路では並列検索でコンテキストが膨らむため、最低でもこれだけ出力トークン枠を確保する */
const MIN_COMPLETION_TOKENS_WITH_WEB_TOOLS = 4096;

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

function resolveMaxTokens(projectId?: ProjectId): number {
  const ceiling = resolveCompletionCeiling();
  const raw = process.env.LLM_MAX_TOKENS?.trim();
  const n = raw ? Number(raw) : NaN;
  let requested = Number.isFinite(n) ? Math.floor(n) : DEFAULT_MAX_TOKENS;
  /** 巷間論は軽量・クレジット節約（OpenRouter 402 回避） */
  if (projectId === "chat") {
    requested = Math.min(requested, 3072);
  }
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
  // 積み残し（未実装）: 長大スレッド向けに上限値の論別チューニングや、古い assistant を要約 1 本へ圧縮する。
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

/** 論ごとの許可 speaker（名指しがあっても集合は変えない。先頭行は名指しへ並べ替え） */
function allowedSpeakers(projectId: ProjectId): Set<string> {
  return getSpeakerAllowSet(projectId);
}

function filterChunks(chunks: OutChunk[], projectId: ProjectId): OutChunk[] {
  const allow = allowedSpeakers(projectId);
  return chunks.map((c) => {
    if (allow.has(c.speaker)) return c;
    return {
      speaker: "不明",
      text: c.text ?? "",
    };
  });
}

/** 名指しターンで先頭発言者を強制：名指し僚友より前の行を落とす（モデルが先に他人を出した場合の救済） */
function chunksNamedSpeakerMustLead(chunks: OutChunk[], namedSpeaker: string | null): OutChunk[] {
  if (!namedSpeaker || !isAllySpeakerName(namedSpeaker)) return chunks;
  const idx = chunks.findIndex((c) => c.speaker === namedSpeaker);
  if (idx <= 0) return chunks;
  return chunks.slice(idx);
}

/** 同一 speaker の連続行を1吹き出し相当にまとめる（JSONL 多重行の是正） */
function mergeConsecutiveSameSpeakerChunks(chunks: OutChunk[]): OutChunk[] {
  if (chunks.length <= 1) return chunks;
  const out: OutChunk[] = [];
  for (const c of chunks) {
    const prev = out[out.length - 1];
    if (prev && prev.speaker === c.speaker) {
      const a = (prev.text ?? "").trimEnd();
      const b = (c.text ?? "").trim();
      const joined = [a, b].filter((x) => x.length > 0).join("\n\n");
      out[out.length - 1] = { speaker: prev.speaker, text: joined };
    } else {
      out.push({ ...c });
    }
  }
  return out;
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

async function tavilySearch(
  query: string,
  signal: AbortSignal,
  opts?: {
    maxResults?: number;
    snippetMaxChars?: number;
    resultMaxChars?: number;
  },
): Promise<string> {
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
      max_results: Math.max(1, Math.min(20, opts?.maxResults ?? 5)),
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
    const snippetMax = Math.max(80, opts?.snippetMaxChars ?? 450);
    const snippet = (r.content ?? "").slice(0, snippetMax).trim();
    if (title || url) {
      lines.push([title && url ? `${title} — ${url}` : title || url, snippet].filter(Boolean).join("\n"));
    }
  }
  const joined = lines.length ? lines.join("\n\n---\n\n") : "(検索結果なし)";
  const maxChars = Math.max(2000, opts?.resultMaxChars ?? 12_000);
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars)}\n\n---\n\n（以下 Tavily 結果は長さのため省略）`;
}

type CompletionJson = {
  choices?: Array<{
    finish_reason?: string;
    native_finish_reason?: string;
    /** 一部ゲートウェイは message の代わりにここへ本文を載せる */
    text?: string;
    message?: {
      content?: string | null | unknown;
      tool_calls?: ToolCall[];
      /** OpenRouter / 思考系で本文以外に載ることがある */
      reasoning?: string;
      reasoning_content?: string;
      thinking?: string;
      [key: string]: unknown;
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

/**
 * Anthropic / OpenRouter が返す content ブロック配列から文字列を抽出する。
 * - kind=text: ユーザー向け本文（JSONL はここを優先）
 * - kind=thinking: 内部思考のみ（text が空のときのフォールバック）
 */
function stringifyContentBlocks(content: unknown, kind: "text" | "thinking"): string {
  if (content == null) return "";
  if (typeof content === "string") return kind === "text" ? content : "";
  if (typeof content === "number" || typeof content === "boolean") return kind === "text" ? String(content) : "";
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block == null) continue;
      if (typeof block === "string") {
        if (kind === "text") parts.push(block);
        continue;
      }
      if (typeof block !== "object") continue;
      const o = block as Record<string, unknown>;
      const typ = typeof o.type === "string" ? o.type : "";

      if (typ === "tool_use" || typ === "function_call") continue;

      if (kind === "text") {
        if (typ === "thinking" || typ === "redacted_thinking") continue;
        if (typ === "text" || typ === "" || typ === "output_text") {
          if (typeof o.text === "string") parts.push(o.text);
        } else if (typeof o.text === "string") {
          parts.push(o.text);
        } else if (typeof o.content === "string") parts.push(o.content);
        else if (Array.isArray(o.content)) parts.push(stringifyContentBlocks(o.content, "text"));
      } else {
        if (typ === "thinking" || typ === "redacted_thinking") {
          if (typeof o.thinking === "string") parts.push(o.thinking);
          else if (typeof o.text === "string") parts.push(o.text);
        }
      }
    }
    return parts.join("");
  }
  if (typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (kind === "text") {
      if (typeof o.text === "string") return o.text;
      if (typeof o.content === "string") return o.content;
    }
  }
  return "";
}

/** Chat Completions の message.content が文字列以外（ブロック配列等）のときに連結して取り出す */
function stringifyLlmMessageContent(content: unknown): string {
  const a = stringifyContentBlocks(content, "text");
  const b = stringifyContentBlocks(content, "thinking");
  return [a, b].filter((x) => x.trim().length > 0).join("\n\n");
}

function extractAssistantVisibleText(
  msg: NonNullable<CompletionJson["choices"]>[0]["message"],
  choiceLegacyText?: string,
): string {
  if (!msg || typeof msg !== "object") return (choiceLegacyText ?? "").trim();
  const rec = msg as Record<string, unknown>;
  const fromContent =
    stringifyContentBlocks(rec.content, "text").trim() ||
    stringifyContentBlocks(rec.content, "thinking").trim();
  if (fromContent) return fromContent;
  const reasoning =
    typeof rec.reasoning === "string"
      ? rec.reasoning.trim()
      : typeof rec.reasoning_content === "string"
        ? rec.reasoning_content.trim()
        : typeof rec.thinking === "string"
          ? rec.thinking.trim()
          : "";
  if (reasoning) return reasoning;
  const legacy = (choiceLegacyText ?? "").trim();
  return legacy;
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

/** 巷間論（chat）は Supabase に残さない */
function allowsSupabaseThreadPersist(projectId: ProjectId): boolean {
  return projectId !== "chat";
}

/**
 * AO ネイティブ（source_provider=ao）のみ ao_threads / ao_messages を更新。
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
      .from("ao_threads")
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
        .from("ao_threads")
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
    .from("ao_threads")
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
      .from("ao_threads")
      .update({
        title: titleForRow,
        updated_at: new Date().toISOString(),
      })
      .eq("id", byClient.id);
    return { threadUuid: byClient.id as string, persistMessages: true };
  }

  const { data: ins, error: e3 } = await supa
    .from("ao_threads")
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

function phase5DbConfigResponse(e: unknown): NextResponse {
  const detail =
    e instanceof Phase5DbConfigError
      ? e.message
      : e instanceof Error
        ? e.message
        : String(e);
  return NextResponse.json({ error: "phase5_db_config", detail }, { status: 503 });
}

export async function POST(req: Request) {
  const mockMode = isMockMode();
  const dryRunMode = isDryRunMode();

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = normalizeProjectId(String(body.projectId ?? ""));
  if (!projectId) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }
  let maxTokens = resolveMaxTokens(projectId);

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
  const userOnlyPre = userMsgs.filter((m) => m.role === "user");
  const lastUserPre = userOnlyPre[userOnlyPre.length - 1]?.content ?? "";
  const isFirstUserTurnPre = userOnlyPre.length === 1;
  const casualModePre = lastUserPre.includes("雑談");

  const phase5Required = Boolean(supaForModel) && isPhase5EligibleProject(projectId);
  let phase5Ctx: Awaited<ReturnType<typeof tryBuildPhase5ChatSystem>> = null;
  if (phase5Required) {
    try {
      phase5Ctx = await tryBuildPhase5ChatSystem({
        supa: supaForModel!,
        projectId,
        messages: userMsgs,
        lastUser: lastUserPre,
        isFirstUserTurn: isFirstUserTurnPre,
        casualMode: casualModePre,
        openAiKey: process.env.OPENAI_API_KEY?.trim(),
      });
    } catch (e) {
      console.error("[chat] tryBuildPhase5ChatSystem", e);
      return phase5DbConfigResponse(e);
    }
    if (!phase5Ctx) {
      return phase5DbConfigResponse(
        new Phase5DbConfigError(`ao_projects が未設定です（論: ${projectId}）`),
      );
    }
  }

  const trimmed = phase5Ctx
    ? phase5Ctx.trimmedEncoded
    : trimHistory(projectId, userMsgs);

  const userOnly = trimmed.filter((m) => m.role === "user");
  const lastUser = userOnly[userOnly.length - 1]?.content ?? "";
  const isFirstUserTurn = userOnly.length === 1;
  const casualMode = casualModePre;
  const namedSpeaker = detectNamedSpeaker(lastUserPre);

  if (phase5Ctx?.bundle.runtime.max_completion_tokens) {
    maxTokens = Math.min(resolveCompletionCeiling(), phase5Ctx.bundle.runtime.max_completion_tokens);
  }

  const userTurnCount = trimmed.filter((m) => m.role === "user").length;
  const webSearchMinRounds = phase5Ctx?.bundle.runtime.web_search_min_rounds ?? 0;
  const tavilyEnabled =
    Boolean(process.env.TAVILY_API_KEY?.trim()) &&
    (phase5Ctx ? phase5Ctx.bundle.runtime.web_search_enabled : true) &&
    userTurnCount > webSearchMinRounds;
  const tavilySuffix = tavilyEnabled
    ? "\n\n【ツール】最新の事実・ニュース・数値の確認などに必要なときのみ `web_search` を使う（引数は query のみ）。不要な検索はしない。"
    : "";

  let maxToolRounds = MAX_TOOL_ROUNDS;
  let webSearchMaxPerRound = resolveWebSearchMaxPerRound();
  if (phase5Ctx) {
    maxToolRounds = phase5Ctx.bundle.runtime.web_search_max_rounds;
    webSearchMaxPerRound = phase5Ctx.bundle.runtime.web_search_max_per_round;
  }

  const completionMetaStub: MsgChatCompletionMeta = {
    finishReason: null,
    nativeFinishReason: null,
    emptyAssistantFallback: false,
    formatRetriesUsed: 0,
    webSearchInvocations: 0,
    webSearchSkippedByLimit: 0,
    webSearchMaxPerRound,
  };

  const supa = supaForModel;
  let promptOverrides: Partial<Record<AoPromptSectionKey, string>> = {};
  if (supa && !phase5Required) {
    try {
      promptOverrides = await loadAoPromptOverrides(supa);
    } catch (e) {
      console.error("[chat] loadAoPromptOverrides", e);
    }
  }

  const nowPrefix = buildJapanNowSystemPrefix();

  let system = phase5Ctx
    ? phase5Ctx.system + tavilySuffix
    : nowPrefix +
      "\n\n" +
      buildAoSystemPrompt(
        {
          projectId,
          lastUserText: lastUserPre,
          isFirstUserTurn,
          casualMode,
          namedSpeaker,
        },
        promptOverrides,
      ) +
      tavilySuffix;

  let phase5RagMeta = phase5Ctx?.ragMeta;

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
    const chunks = mergeConsecutiveSameSpeakerChunks(
      chunksNamedSpeakerMustLead(filterChunks(rawChunks, projectId), namedSpeaker),
    );
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
      completionMeta: completionMetaStub,
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
    const chunks = mergeConsecutiveSameSpeakerChunks(
      chunksNamedSpeakerMustLead(filterChunks(rawChunks, projectId), namedSpeaker),
    );
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
      completionMeta: completionMetaStub,
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

  let ragMeta: RagSearchResult & { injected: boolean; threshold: number } = phase5RagMeta ?? {
    block: "",
    hitCount: 0,
    topSimilarity: null,
    injected: false,
    threshold: RAG_MATCH_THRESHOLD,
  };

  if (!phase5Ctx) {
    let injectionBlock = "";
    if (supa) {
      try {
        const oai = process.env.OPENAI_API_KEY?.trim();
        if (oai) {
          const rag = await searchRagChunks(supa, lastUserPre, isFirstUserTurn, oai, {
            filter_project_id: normalizeEmbedProjectId(projectId),
            filter_kind: RAG_DEFAULT_KIND,
          });
          ragMeta = { ...rag, injected: Boolean(rag.block.trim()), threshold: RAG_MATCH_THRESHOLD };
          if (rag.block.trim()) {
            injectionBlock = `## 関連する過去の議論\n${rag.block.trim()}`;
          }
        }
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
          lastUserText: lastUserPre,
          isFirstUserTurn,
          casualMode,
          namedSpeaker,
          injectionBlock: injectionBlock || undefined,
        },
        promptOverrides,
      ) +
      tavilySuffix;
  }

  let persistedThreadUuid: string | null = null;
  let persistMessages = false;
  let lastCompletionJson: CompletionJson | null = null;

  const messages: ChatMessage[] = [{ role: "system", content: system }, ...trimmed];

  const url = `${baseUrl}/chat/completions`;
  const headers = completionHeaders(apiKey, baseUrl);
  const tools = tavilyEnabled ? [WEB_SEARCH_TOOL] : undefined;

  let finalContent = "";
  let formatRetry = 0;
  let toolRounds = 0;
  let completionRoundCount = 0;
  let webSearchInvocationCount = 0;
  let webSearchSkippedByLimit = 0;
  let lastFinishReason: string | null = null;
  let lastNativeFinishReason: string | null = null;
  const webSearchQueriesForDebug: string[] = [];
  const unsupportedToolNamesForDebug: string[] = [];
  const usageAgg = { prompt: 0, completion: 0 };
  const completionBudget = Math.min(
    resolveCompletionCeiling(),
    tavilyEnabled ? Math.max(maxTokens, MIN_COMPLETION_TOKENS_WITH_WEB_TOOLS) : maxTokens,
  );
  try {
    while (true) {
      completionRoundCount += 1;
      const forceNoTools = toolRounds >= maxToolRounds;
      const payload: Record<string, unknown> = {
        model: effectiveModel,
        temperature: 0.7,
        max_tokens: completionBudget,
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

      const choice0 = json.choices?.[0];
      const msg = choice0?.message;
      if (!msg) {
        throw new Error("LLM response missing choices[0].message");
      }

      const calls = msg.tool_calls;
      if (forceNoTools || !calls?.length) {
        finalContent = extractAssistantVisibleText(msg, choice0?.text);
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
        if (formatRetry < MAX_FORMAT_RETRY) {
          const needsRetry = phase5Ctx
            ? isAssistantOutputParseFallback(
                parseAssistantOutput(finalContent, phase5Ctx.bundle.mainSpeakerName),
                finalContent,
              )
            : isJsonlParseFallback(parseJsonl(finalContent), finalContent);
          if (needsRetry) {
            formatRetry += 1;
            if (phase5Ctx) appendMarkdownFormatRetrySystem(messages);
            else appendFormatRetrySystem(messages);
            toolRounds = maxToolRounds;
            continue;
          }
        }
        lastFinishReason = typeof choice0?.finish_reason === "string" ? choice0.finish_reason : null;
        lastNativeFinishReason =
          typeof choice0?.native_finish_reason === "string" ? choice0.native_finish_reason : null;
        if (!finalContent.trim() && choice0) {
          console.log(
            "[chat-debug] empty assistant text; finish_reason=",
            choice0.finish_reason,
            "native_finish_reason=",
            choice0.native_finish_reason,
            "completionBudget=",
            completionBudget,
          );
        }
        break;
      }

      toolRounds += 1;
      const assistantToolRoundContent =
        msg.content == null
          ? null
          : typeof msg.content === "string"
            ? msg.content
            : stringifyLlmMessageContent(msg.content) || null;
      messages.push({
        role: "assistant",
        content: assistantToolRoundContent,
        tool_calls: calls,
      });

      let webSearchThisRound = 0;
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
          webSearchThisRound += 1;
          if (webSearchThisRound > webSearchMaxPerRound) {
            webSearchSkippedByLimit += 1;
            messages.push({
              role: "tool",
              tool_call_id: id,
              content: JSON.stringify({
                error: "web_search_per_round_limit",
                limit: webSearchMaxPerRound,
                detail:
                  "この assistant ラウンドでの web_search 呼び出しが環境変数 AO_WEB_SEARCH_MAX_PER_ROUND の上限を超えました。クエリを統合するか検索回数を減らしてください。",
              }),
            });
            if (isChatDebugMode()) {
              console.log(
                "[chat-debug] web_search skipped (per-round limit)",
                webSearchSkippedByLimit,
                "query_preview=",
                query.slice(0, 120),
              );
            }
            continue;
          }
          webSearchInvocationCount += 1;
          if (isChatDebugMode()) {
            webSearchQueriesForDebug.push(query.trim().slice(0, 320));
            console.log("[chat-debug] web_search invocation", webSearchInvocationCount, "query=", query.slice(0, 120));
          }
          let toolText: string;
          try {
            toolText = await tavilySearch(query, AbortSignal.timeout(requestTimeoutMs()), {
              maxResults: phase5Ctx?.bundle.runtime.web_search_tavily_max_results,
              snippetMaxChars: phase5Ctx?.bundle.runtime.web_search_snippet_max_chars,
              resultMaxChars: phase5Ctx?.bundle.runtime.web_search_result_max_chars,
            });
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

  const trimmedFinal = finalContent.trim();
  const defaultSpeaker =
    phase5Ctx?.bundle.mainSpeakerName ?? getPrimarySpeakerForProject(projectId);
  const parsed = phase5Ctx
    ? parseAssistantOutput(finalContent, defaultSpeaker)
    : parseJsonl(finalContent);
  const parseFallback = phase5Ctx
    ? isAssistantOutputParseFallback(parsed, finalContent)
    : isJsonlParseFallback(parsed, finalContent);
  const emptyAssistantFallback = trimmedFinal.length === 0 && parseFallback;
  const rawChunks = parseFallback
    ? [
        {
          speaker:
            namedSpeaker && isAllySpeakerName(namedSpeaker) ? namedSpeaker : defaultSpeaker,
          text:
            trimmedFinal.length > 0
              ? trimmedFinal
              : "（応答本文が空でした。入力が非常に長いターンやツール往復のあとに、モデルが指定形式を返さなかった可能性があります。履歴を分けるか短くして再度お試しください。）",
        },
      ]
    : parsed;
  const filtered = phase5Ctx
    ? filterSpeakerChunks(
        rawChunks,
        phase5Ctx.bundle.allowedSpeakerNames,
        phase5Ctx.bundle.mainSpeakerName,
      )
    : filterChunks(rawChunks, projectId);
  const decoded = phase5Ctx
    ? filtered.map((c) => ({
        ...c,
        text: decodeAssistantTextForUi(c.text, phase5Ctx.bundle.glossary),
      }))
    : filtered;
  const chunks = mergeConsecutiveSameSpeakerChunks(
    chunksNamedSpeakerMustLead(decoded, namedSpeaker),
  );
  const rawPromptSentLive = serializeOutboundChatMessages(messages);
  const rawPromptReceivedLive = finalContent;

  const completionMeta: MsgChatCompletionMeta = {
    finishReason: lastFinishReason,
    nativeFinishReason: lastNativeFinishReason,
    emptyAssistantFallback,
    formatRetriesUsed: formatRetry,
    webSearchInvocations: webSearchInvocationCount,
    webSearchSkippedByLimit,
    webSearchMaxPerRound,
    rag: {
      isFirstUserTurn,
      hitCount: ragMeta.hitCount,
      topSimilarity: ragMeta.topSimilarity,
      injected: ragMeta.injected,
      matchThreshold: ragMeta.threshold,
    },
  };

  console.info(
    `[chat] model=${effectiveModel} finish_reason=${lastFinishReason ?? "?"}` +
      ` native_finish_reason=${lastNativeFinishReason ?? "?"}` +
      ` completion_rounds=${completionRoundCount} tool_rounds=${toolRounds}` +
      ` web_search=${webSearchInvocationCount} web_search_skipped_limit=${webSearchSkippedByLimit}` +
      ` format_retries=${formatRetry} empty_fallback=${emptyAssistantFallback}`,
  );

  if (supa && body.clientThreadId?.trim() && allowsSupabaseThreadPersist(projectId) && chunks.length > 0) {
    try {
      const plan = await prepareChatPersistence(supa, body);
      persistMessages = plan.persistMessages;
      persistedThreadUuid = plan.threadUuid;
      if (persistMessages && persistedThreadUuid) {
        const { error: ue } = await supa.from("ao_messages").insert({
          thread_id: persistedThreadUuid,
          role: "user",
          text: lastUser,
          provider: "openrouter",
          model_id: effectiveModel,
        });
        if (ue) console.error("[chat] persist user message:", ue.message);
        else {
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
            .from("ao_messages")
            .insert(rows)
            .select("id, text");
          if (ae) console.error("[chat] persist assistant messages:", ae.message);
          await supa
            .from("ao_threads")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", persistedThreadUuid);

          const oai = process.env.OPENAI_API_KEY?.trim();
          if (oai && insertedRows?.length) {
            const { data: threadMeta } = await supa
              .from("ao_threads")
              .select("source_provider,title,project_id")
              .eq("id", persistedThreadUuid)
              .maybeSingle();
            void storeEmbeddingsForMessageTexts(
              supa,
              insertedRows.map((r: { id: string; text: string }) => ({
                id: r.id,
                text: r.text,
                threadSourceProvider: threadMeta?.source_provider ?? null,
                threadTitle: threadMeta?.title ?? null,
                embedProjectId: normalizeEmbedProjectId(
                  threadMeta?.project_id ?? projectId,
                ),
              })),
              oai,
            ).catch((e) => console.error("[chat] embedding pipeline", e));
          }
        }
      }
    } catch (e) {
      console.error("[chat] supabase turn persist", e);
    }
  }

  return NextResponse.json({
    chunks,
    rawContent: finalContent,
    usage: usagePayload,
    completionMeta,
    rawPrompts: { sent: rawPromptSentLive, received: rawPromptReceivedLive },
    ...(persistMessages && persistedThreadUuid ? { supabaseThreadId: persistedThreadUuid } : {}),
    ...(isChatDebugMode()
      ? {
          chatDebug: {
            phase: "live",
            tavilyApiKeyPresent: tavilyEnabled,
            toolsAttachedToPayload: Boolean(tools),
            maxToolRounds,
            webSearchMaxPerRound,
            completionRoundCount,
            toolFollowupLoops: toolRounds,
            webSearchInvocations: webSearchInvocationCount,
            webSearchSkippedByLimit,
            webSearchQueries: [...webSearchQueriesForDebug],
            unsupportedToolNames: [...unsupportedToolNamesForDebug],
            usage: usagePayload,
            rag: {
              isFirstUserTurn,
              hitCount: ragMeta.hitCount,
              topSimilarity: ragMeta.topSimilarity,
              injected: ragMeta.injected,
              matchThreshold: ragMeta.threshold,
            },
          },
        }
      : {}),
  });
}
