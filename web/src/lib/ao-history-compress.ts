import { looksTaggedAssistantText } from "@/lib/ao-assistant-turn";

/**
 * チャット履歴のトークン閾値要約（キャッシュは Thread + Supabase `ao_threads.history_compression`）
 */

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  id?: string;
  /** assistant 行の幕僚名（要約 transcript 用） */
  speaker?: string;
};

export type ThreadHistoryCompression = {
  /** この id 以降を全文で送る（より前は summary に畳まれている） */
  fromMessageId: string;
  summary: string;
};

export type CompressHistoryResult = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  cache: ThreadHistoryCompression | null;
  /** 今回新たに要約したか */
  didSummarize: boolean;
  /** 今回の要約 LLM 課金（走らなければ null） */
  summaryUsage: {
    promptTokens: number;
    completionTokens: number;
    modelId: string;
    estimatedUsd: number | null;
  } | null;
};

/** 1 リクエストあたりの LLM 要約ラウンド上限（超過分はターン削除のみ） */
export const AO_HISTORY_MAX_SUMMARIZE_ROUNDS_PER_REQUEST = 2;

/** 送信前ハードキャップ（推定トークン）。閾値より少し低めに抑える */
export function aoHistoryHardCapTokens(thresholdTokens: number): number {
  const t = thresholdTokens > 0 ? thresholdTokens : 22_000;
  return Math.min(Math.floor(t * 0.92), 24_000);
}

/** 粗い推定（日本語混じり: 約 4 文字 / トークン） */
export function estimateHistoryTokens(messages: Array<{ content: string }>): number {
  let chars = 0;
  for (const m of messages) chars += (m.content ?? "").length;
  return Math.max(0, Math.ceil(chars / 4));
}

type Turn = { ids: string[]; messages: HistoryMessage[] };

function groupTurns(messages: HistoryMessage[]): Turn[] {
  const turns: Turn[] = [];
  let cur: Turn | null = null;
  for (const m of messages) {
    if (m.role === "user") {
      cur = { ids: m.id ? [m.id] : [], messages: [m] };
      turns.push(cur);
      continue;
    }
    if (!cur) {
      cur = { ids: m.id ? [m.id] : [], messages: [m] };
      turns.push(cur);
      continue;
    }
    if (m.id) cur.ids.push(m.id);
    cur.messages.push(m);
  }
  return turns;
}

function turnToTranscript(turn: Turn): string {
  return turn.messages
    .map((m) => {
      const body = (m.content ?? "").trim();
      if (!body) return "";
      if (m.role === "user") return `殿下: ${body}`;
      const sp = m.speaker?.trim();
      if (sp) return `＜${sp}＞ ${body}`;
      if (looksTaggedAssistantText(body)) return body;
      return `幕僚: ${body}`;
    })
    .filter((s) => s.length > 0)
    .join("\n\n");
}

/** キャッシュの fromMessageId をメッセージ列上で解決（uuid / uuid#chunk 対応） */
export function findMessageIndexForCache(
  messages: HistoryMessage[],
  fromMessageId: string,
): number {
  const id = fromMessageId.trim();
  if (!id) return -1;
  const exact = messages.findIndex((m) => m.id === id);
  if (exact >= 0) return exact;
  const base = id.split("#")[0] ?? id;
  return messages.findIndex((m) => {
    const mid = m.id ?? "";
    return mid === base || mid.startsWith(`${base}#`);
  });
}

/**
 * 要約ヘッダを残しつつ古いターンから落として maxTokens 以内に収める。
 */
export function hardCapHistoryMessages(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxTokens: number,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (maxTokens <= 0 || messages.length === 0) return messages;
  const out = [...messages];
  const isSummaryHead = (i: number) =>
    i === 0 && (out[i]?.content ?? "").startsWith("【過去要約】");

  while (out.length > 1 && estimateHistoryTokens(out) > maxTokens) {
    if (isSummaryHead(0) && out.length > 2) {
      out.splice(1, 1);
      continue;
    }
    if (isSummaryHead(0) && out.length === 2) {
      out.shift();
      continue;
    }
    out.shift();
  }
  return out;
}

export async function compressHistoryForChat(opts: {
  messages: HistoryMessage[];
  thresholdTokens: number;
  cache: ThreadHistoryCompression | null | undefined;
  summarize: (payload: {
    existingSummary: string;
    newTurnsText: string;
  }) => Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    modelId: string;
    estimatedUsd: number | null;
  }>;
  maxSummarizeRounds?: number;
}): Promise<CompressHistoryResult> {
  const threshold = opts.thresholdTokens;
  const maxSummarizeRounds = opts.maxSummarizeRounds ?? AO_HISTORY_MAX_SUMMARIZE_ROUNDS_PER_REQUEST;
  const strip = (list: HistoryMessage[]) =>
    list.map((m) => ({ role: m.role, content: m.content }));

  if (threshold <= 0 || opts.messages.length === 0) {
    return {
      messages: strip(opts.messages),
      cache: opts.cache ?? null,
      didSummarize: false,
      summaryUsage: null,
    };
  }

  let summary = opts.cache?.summary?.trim() ?? "";
  let sliceStart = 0;
  const cacheFromId = opts.cache?.fromMessageId?.trim() ?? "";

  if (cacheFromId) {
    const idx = findMessageIndexForCache(opts.messages, cacheFromId);
    if (idx >= 0) {
      sliceStart = idx;
    } else if (summary) {
      // Cursor 寄せ: ID 不一致でも要約は維持し、直近ターンのみ全文送信
      const tailTurns = groupTurns(opts.messages);
      const keepTurns = Math.max(4, Math.min(12, Math.ceil(threshold / 4000)));
      const dropTurns = Math.max(0, tailTurns.length - keepTurns);
      if (dropTurns > 0 && tailTurns.length > 0) {
        const firstKept = tailTurns[dropTurns]?.messages[0];
        if (firstKept?.id) {
          const startIdx = findMessageIndexForCache(opts.messages, firstKept.id);
          if (startIdx >= 0) sliceStart = startIdx;
        }
      }
    } else {
      summary = "";
    }
  }

  const recent = opts.messages.slice(sliceStart);
  const turns = groupTurns(recent);
  const folded: string[] = [];
  let didSummarize = false;
  let summarizeRounds = 0;
  let summaryUsage: CompressHistoryResult["summaryUsage"] = null;

  const tokenEstimate = () =>
    estimateHistoryTokens([
      ...(summary ? [{ content: summary }] : []),
      ...turns.flatMap((t) => t.messages),
    ]);

  while (turns.length > 1 && tokenEstimate() > threshold) {
    const oldest = turns.shift()!;
    if (summarizeRounds < maxSummarizeRounds) {
      folded.push(turnToTranscript(oldest));
      didSummarize = true;
      summarizeRounds += 1;
    } else {
      didSummarize = true;
    }
  }

  if (folded.length > 0) {
    const summarized = await opts.summarize({
      existingSummary: summary,
      newTurnsText: folded.join("\n\n---\n\n"),
    });
    summary = summarized.text.trim();
    didSummarize = true;
    summaryUsage = {
      promptTokens: summarized.promptTokens,
      completionTokens: summarized.completionTokens,
      modelId: summarized.modelId,
      estimatedUsd: summarized.estimatedUsd,
    };
  }

  const flat = turns.flatMap((t) => t.messages);
  const fromMessageId =
    flat.find((m) => m.id)?.id ??
    (cacheFromId && findMessageIndexForCache(opts.messages, cacheFromId) >= 0 ? cacheFromId : "") ??
    opts.messages.find((m) => m.id)?.id ??
    "";

  if (!summary) {
    return {
      messages: strip(flat.length ? flat : recent),
      cache: null,
      didSummarize,
      summaryUsage,
    };
  }

  const head: HistoryMessage = {
    role: "assistant",
    content: `【過去要約】\n${summary}`,
  };

  return {
    messages: strip([head, ...flat]),
    cache: fromMessageId
      ? { fromMessageId, summary }
      : { fromMessageId: cacheFromId || fromMessageId, summary },
    didSummarize,
    summaryUsage,
  };
}

export function buildHistorySummaryPrompt(existingSummary: string, newTurnsText: string): string {
  const prior = existingSummary.trim();
  return [
    "あなたは議事録要約担当です。以下の過去ログを、後続の LLM が文脈を失わないよう短く要約してください。",
    "出力はプレーンテキストのみ。見出しは ## 可。幕僚名・殿下の質問意図・結論・未解決点を残す。",
    "新しい事実の創作は禁止。",
    prior ? `\n【既存の要約】\n${prior}\n` : "",
    `\n【今回畳み込むログ】\n${newTurnsText.trim()}\n`,
    "\n【出力】更新後の要約のみ:",
  ].join("\n");
}
