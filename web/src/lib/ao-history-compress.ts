import { looksTaggedAssistantText } from "@/lib/ao-assistant-turn";

/**
 * チャット履歴のトークン閾値要約（キャッシュはクライアント Thread に保持、Supabase には保存しない）
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
};

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

export async function compressHistoryForChat(opts: {
  messages: HistoryMessage[];
  thresholdTokens: number;
  cache: ThreadHistoryCompression | null | undefined;
  summarize: (payload: { existingSummary: string; newTurnsText: string }) => Promise<string>;
}): Promise<CompressHistoryResult> {
  const threshold = opts.thresholdTokens;
  const strip = (list: HistoryMessage[]) =>
    list.map((m) => ({ role: m.role, content: m.content }));

  if (threshold <= 0 || opts.messages.length === 0) {
    return { messages: strip(opts.messages), cache: opts.cache ?? null, didSummarize: false };
  }

  let summary = opts.cache?.summary?.trim() ?? "";
  let sliceStart = 0;
  if (opts.cache?.fromMessageId) {
    const idx = opts.messages.findIndex((m) => m.id === opts.cache!.fromMessageId);
    if (idx >= 0) sliceStart = idx;
    else summary = "";
  }

  const recent = opts.messages.slice(sliceStart);
  const turns = groupTurns(recent);
  const folded: string[] = [];
  let didSummarize = false;

  const tokenEstimate = () =>
    estimateHistoryTokens([
      ...(summary ? [{ content: summary }] : []),
      ...turns.flatMap((t) => t.messages),
    ]);

  while (turns.length > 1 && tokenEstimate() > threshold) {
    const oldest = turns.shift()!;
    folded.push(turnToTranscript(oldest));
    didSummarize = true;
  }

  if (folded.length > 0) {
    summary = (
      await opts.summarize({
        existingSummary: summary,
        newTurnsText: folded.join("\n\n---\n\n"),
      })
    ).trim();
    didSummarize = true;
  }

  const flat = turns.flatMap((t) => t.messages);
  const fromMessageId =
    flat.find((m) => m.id)?.id ??
    opts.cache?.fromMessageId ??
    opts.messages.find((m) => m.id)?.id ??
    "";

  if (!summary) {
    return {
      messages: strip(flat.length ? flat : recent),
      cache: null,
      didSummarize,
    };
  }

  const head: HistoryMessage = {
    role: "assistant",
    content: `【過去要約】\n${summary}`,
  };

  return {
    messages: strip([head, ...flat]),
    cache: fromMessageId ? { fromMessageId, summary } : null,
    didSummarize,
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
