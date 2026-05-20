import type {
  MsgChatCompletionMeta,
  MsgRagMeta,
  MsgRawPromptBundle,
  MsgTurnUsage,
} from "@/lib/ao-state";

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

function numNonNeg(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) return Math.max(0, Math.floor(x));
  return undefined;
}

export function normalizeCompletionMetaFromApi(raw: unknown): MsgChatCompletionMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  let finishReason: string | null = null;
  if (o.finishReason !== undefined && o.finishReason !== null) {
    if (typeof o.finishReason !== "string") return undefined;
    finishReason = o.finishReason;
  }

  const nativeRaw = o.nativeFinishReason ?? o.native_finish_reason;
  const nativeFinishReason =
    nativeRaw === null || nativeRaw === undefined
      ? null
      : typeof nativeRaw === "string"
        ? nativeRaw
        : null;

  if (typeof o.emptyAssistantFallback !== "boolean") return undefined;
  const formatRetriesUsed = numNonNeg(o.formatRetriesUsed ?? o.format_retries_used);
  const webSearchInvocations = numNonNeg(o.webSearchInvocations ?? o.web_search_invocations);
  const webSearchSkippedByLimit = numNonNeg(o.webSearchSkippedByLimit ?? o.web_search_skipped_by_limit);
  const webSearchMaxPerRound = numNonNeg(o.webSearchMaxPerRound ?? o.web_search_max_per_round);
  if (
    formatRetriesUsed === undefined ||
    webSearchInvocations === undefined ||
    webSearchSkippedByLimit === undefined ||
    webSearchMaxPerRound === undefined
  ) {
    return undefined;
  }

  let rag: MsgRagMeta | undefined;
  const ragRaw = o.rag;
  if (ragRaw && typeof ragRaw === "object") {
    const r = ragRaw as Record<string, unknown>;
    const hitCount = numNonNeg(r.hitCount ?? r.hit_count);
    const matchThreshold =
      typeof r.matchThreshold === "number" && Number.isFinite(r.matchThreshold)
        ? r.matchThreshold
        : typeof r.match_threshold === "number" && Number.isFinite(r.match_threshold)
          ? r.match_threshold
          : undefined;
    if (
      typeof r.isFirstUserTurn === "boolean" &&
      typeof r.injected === "boolean" &&
      hitCount !== undefined &&
      matchThreshold !== undefined
    ) {
      const topSim = r.topSimilarity ?? r.top_similarity;
      rag = {
        isFirstUserTurn: r.isFirstUserTurn,
        hitCount,
        topSimilarity:
          topSim === null || topSim === undefined
            ? null
            : typeof topSim === "number" && Number.isFinite(topSim)
              ? topSim
              : null,
        injected: r.injected,
        matchThreshold,
      };
    }
  }

  return {
    finishReason,
    nativeFinishReason,
    emptyAssistantFallback: o.emptyAssistantFallback,
    formatRetriesUsed,
    webSearchInvocations,
    webSearchSkippedByLimit,
    webSearchMaxPerRound,
    ...(rag ? { rag } : {}),
  };
}
