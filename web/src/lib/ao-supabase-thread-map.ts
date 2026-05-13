import { usagePromptCompletionFromStoredRawResponse } from "@/lib/ao-completion-usage";
import { displayTextForClaudeImportedAssistant } from "@/lib/ao-claude-display-text";
import { estimateCompletionUsd } from "@/lib/ao-usage-estimate";
import type { Msg, MsgRawPromptBundle, MsgTurnUsage } from "@/lib/ao-state";

/** `threads` / `messages` SELECT 行（api/state と api/threads で共通） */
export type DbThreadRow = {
  id: string;
  client_thread_id: string | null;
  title: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  source_provider: string | null;
};

export type DbMessageRow = {
  id: string;
  thread_id: string;
  role: string;
  text: string;
  persona: string | null;
  created_at: string;
  model_id?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  token_count?: number | null;
  usd_estimate?: string | number | null;
  raw_prompt_sent?: string | null;
  raw_prompt_received?: string | null;
  raw_response?: unknown | null;
};

/**
 * DB の日時が不正だと `getTime()` が NaN になる。`JSON.stringify` は NaN を null にし、
 * クライアントの `isMsg` / `isThread`（typeof x === "number"）が落ちるのを避ける。
 */
export function msFromDb(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function parseUsdEstimate(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function intTok(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return 0;
    const n = Number(t);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return 0;
}

export function rawPromptBundleFromRow(row: DbMessageRow): MsgRawPromptBundle | undefined {
  const sent = row.raw_prompt_sent;
  const received = row.raw_prompt_received;
  if (typeof sent === "string" && typeof received === "string") {
    return { sent, received };
  }
  return undefined;
}

/** assistant 行の先頭チャンクにだけ付く使用量を Msg 形式へ（カラムが 0 のときは raw_response.completion を参照） */
export function usageFromAssistantRow(row: DbMessageRow): MsgTurnUsage | undefined {
  if (row.role !== "assistant") return undefined;

  let pt = intTok(row.prompt_tokens);
  let ct = intTok(row.completion_tokens);
  if (pt === 0 && ct === 0) {
    const inferred = usagePromptCompletionFromStoredRawResponse(row.raw_response);
    if (inferred) {
      pt = inferred.promptTokens;
      ct = inferred.completionTokens;
    }
  }

  const modelIdRaw = typeof row.model_id === "string" ? row.model_id.trim() : "";
  const modelId = modelIdRaw || "—";

  let estimatedUsd = parseUsdEstimate(row.usd_estimate);
  if (estimatedUsd == null && (pt > 0 || ct > 0)) {
    estimatedUsd = estimateCompletionUsd(pt, ct);
  }

  const hasTokens = pt > 0 || ct > 0;
  const rawOnly = rawPromptBundleFromRow(row);
  if (!hasTokens && estimatedUsd == null && modelId === "—" && !rawOnly) return undefined;

  return {
    promptTokens: pt,
    completionTokens: ct,
    totalTokens: pt + ct,
    estimatedUsd,
    modelId,
  };
}

/** 同一ターンの連続 assistant 行へ先頭行の usage/raw を伝播し、その直前の user にも複製する */
export function hydrateMsgTurnUsageAndRaw(msgs: Msg[]): void {
  for (let i = 1; i < msgs.length; i++) {
    const m = msgs[i]!;
    if (m.side !== "ai") continue;
    const prev = msgs[i - 1]!;
    if (prev.side !== "ai") continue;
    msgs[i] = {
      ...m,
      usage: m.usage ?? prev.usage,
      rawPrompts: m.rawPrompts ?? prev.rawPrompts,
    };
  }
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]!;
    if (m.side !== "ai") continue;
    if (!m.usage && !m.rawPrompts) continue;
    for (let j = i - 1; j >= 0; j--) {
      if (msgs[j]!.side === "user") {
        const u = msgs[j]!;
        msgs[j] = {
          ...u,
          usage: u.usage ?? m.usage,
          rawPrompts: u.rawPrompts ?? m.rawPrompts,
        };
        break;
      }
    }
  }
}

export function buildMessagesFromDbRows(rawMsgs: DbMessageRow[], sourceProvider: string | null): Msg[] {
  const sp = typeof sourceProvider === "string" ? sourceProvider : null;
  const msgs: Msg[] = rawMsgs.map((row) => {
    const isUser = row.role === "user";
    const text = isUser
      ? row.text
      : displayTextForClaudeImportedAssistant(sp, row.role, row.text);
    const msg: Msg = {
      id: String(row.id),
      side: isUser ? "user" : "ai",
      speaker: isUser ? "ジュチ" : row.persona || "不明",
      text,
      createdAt: msFromDb(row.created_at),
    };
    if (!isUser) {
      const usage = usageFromAssistantRow(row);
      const rawPrompts = rawPromptBundleFromRow(row);
      if (usage) msg.usage = usage;
      if (rawPrompts) msg.rawPrompts = rawPrompts;
    }
    return msg;
  });
  hydrateMsgTurnUsageAndRaw(msgs);
  return msgs;
}
