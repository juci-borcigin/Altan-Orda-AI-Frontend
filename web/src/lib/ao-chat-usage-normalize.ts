import type { MsgRawPromptBundle, MsgTurnUsage } from "@/lib/ao-state";

function numTok(x: unknown): number {
  if (typeof x === "number" && Number.isFinite(x)) return Math.max(0, Math.floor(x));
  if (typeof x === "string") {
    const n = Number(x.trim());
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return 0;
}

function numUsd(x: unknown): number | null {
  if (x == null) return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

/** `/api/chat` の JSON が camelCase／snake_case／文字列数値のどれでも読めるようにする */
export function normalizeChatUsageFromApi(raw: unknown): MsgTurnUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const pt = numTok(o.promptTokens ?? o.prompt_tokens);
  const ct = numTok(o.completionTokens ?? o.completion_tokens);
  const ttRaw = o.totalTokens ?? o.total_tokens;
  const tt = ttRaw !== undefined && ttRaw !== null ? numTok(ttRaw) : pt + ct;
  const modelIdRaw =
    (typeof o.modelId === "string" && o.modelId.trim()) ||
    (typeof o.model_id === "string" && o.model_id.trim()) ||
    "";
  const modelId = modelIdRaw || "—";
  const estimatedUsd =
    numUsd(o.estimatedUsd) ?? numUsd(o.estimated_usd);
  return {
    promptTokens: pt,
    completionTokens: ct,
    totalTokens: tt > 0 ? tt : pt + ct,
    estimatedUsd,
    modelId,
  };
}

export function normalizeRawPromptsFromApi(raw: unknown): MsgRawPromptBundle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const sent = o.sent ?? o.raw_prompt_sent;
  const received = o.received ?? o.raw_prompt_received;
  if (typeof sent === "string" && typeof received === "string") {
    return { sent, received };
  }
  return undefined;
}
