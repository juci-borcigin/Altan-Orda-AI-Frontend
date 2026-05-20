import {
  isMarkdownParseFallback,
  mergeConsecutiveSameSpeaker,
  parseMarkdownSpeakers,
  type MarkdownSpeakerChunk,
} from "./parse-markdown-speakers";

export type OutChunk = { speaker: string; text: string };

/** Markdown 形式再試行（1回目）— 設定化しない（固定2回） */
export const FORMAT_RETRY_MARKDOWN_PRIMARY =
  "【重要: 出力形式の再実行】直前の出力が指定形式ではありませんでした。返答は Markdown 本文のみ。話者が変わるときは単独行に ＜ペルソナ名＞ を置き、その直後から本文とする。JSON Lines・説明文・コードフェンスは禁止。";

export const FORMAT_RETRY_MARKDOWN_SECONDARY =
  "【重要: 出力形式の再実行（継続）】なおも形式が不正です。各行の先頭に ＜ペルソナ名＞ を置き、本文は Markdown のみ。余計な見出し・前置き・JSON は出さない。";

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
      // ignore
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
  return c.text === "（空）" || t.length === 0 || c.text === t;
}

/** Markdown 優先。崩れ時のみ JSONL パース（二重対応期間） */
export function parseAssistantOutput(text: string, defaultSpeaker: string): OutChunk[] {
  const md = mergeConsecutiveSameSpeaker(parseMarkdownSpeakers(text, defaultSpeaker));
  if (!isMarkdownParseFallback(md, text)) return md;

  const jsonl = parseJsonl(text);
  if (!isJsonlParseFallback(jsonl, text)) return jsonl;

  return md;
}

export function isAssistantOutputParseFallback(chunks: OutChunk[], rawText: string): boolean {
  const md = parseMarkdownSpeakers(rawText, "x");
  if (!isMarkdownParseFallback(md, rawText)) return false;
  const jsonl = parseJsonl(rawText);
  return isJsonlParseFallback(jsonl, rawText);
}

export function filterSpeakerChunks(
  chunks: OutChunk[],
  allowed: Set<string>,
  mainSpeaker: string,
): OutChunk[] {
  return chunks.map((c) => {
    if (allowed.has(c.speaker)) return c;
    return { speaker: mainSpeaker, text: c.text ?? "" };
  });
}

export function appendMarkdownFormatRetrySystem(
  messages: Array<{ role: string; content?: string | null }>,
): void {
  const last = messages[messages.length - 1];
  if (last?.role === "system" && last.content === FORMAT_RETRY_MARKDOWN_PRIMARY) {
    messages.push({ role: "system", content: FORMAT_RETRY_MARKDOWN_SECONDARY });
    return;
  }
  if (last?.role === "system" && last.content === FORMAT_RETRY_MARKDOWN_SECONDARY) return;
  messages.push({ role: "system", content: FORMAT_RETRY_MARKDOWN_PRIMARY });
}
