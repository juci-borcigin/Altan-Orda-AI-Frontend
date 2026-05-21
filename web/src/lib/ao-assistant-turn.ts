import {
  mergeConsecutiveSameSpeaker,
  parseMarkdownSpeakers,
  type MarkdownSpeakerChunk,
} from "@/lib/phase5/parse-markdown-speakers";

const SPEAKER_LINE = /^[ \t]*[＜<]([^＞>]+)[＞>][ \t]*$/;

export type HistoryTurnInput = {
  role: "user" | "assistant";
  content: string;
  id?: string;
  /** UI 上の幕僚名（assistant 畳み込み用） */
  speaker?: string;
};

/** 吹き出し単位 → 1 assistant メッセージ（＜名＞ 行区切り） */
export function chunksToTaggedRaw(chunks: Array<{ speaker: string; text: string }>): string {
  const parts: string[] = [];
  for (const c of chunks) {
    const name = (c.speaker ?? "").trim() || "不明";
    const body = (c.text ?? "").trim();
    if (!body) continue;
    parts.push(`＜${name}＞\n${body}`);
  }
  return parts.join("\n\n");
}

/** 連続 assistant を 1 本に畳み、LLM 履歴の重複を防ぐ */
export function collapseAssistantHistoryForLlm(messages: HistoryTurnInput[]): Array<{
  role: "user" | "assistant";
  content: string;
  id?: string;
  speaker?: string;
}> {
  const out: Array<{
    role: "user" | "assistant";
    content: string;
    id?: string;
    speaker?: string;
  }> = [];
  let aiRun: Array<{ speaker: string; text: string; id?: string }> = [];

  const flushAi = () => {
    if (aiRun.length === 0) return;
    const tagged = chunksToTaggedRaw(aiRun);
    if (!tagged.trim()) {
      aiRun = [];
      return;
    }
    const first = aiRun[0]!;
    const single = aiRun.length === 1 && !looksTaggedAssistantText(first.text);
    out.push({
      role: "assistant",
      content: single ? first.text : tagged,
      id: first.id,
      speaker: first.speaker,
    });
    aiRun = [];
  };

  for (const m of messages) {
    if (m.role === "user") {
      flushAi();
      out.push({ role: "user", content: m.content, id: m.id });
      continue;
    }
    const text = (m.content ?? "").trim();
    if (!text) continue;
    aiRun.push({
      speaker: (m.speaker ?? "").trim() || "不明",
      text: m.content,
      id: m.id,
    });
  }
  flushAi();
  return out;
}

export function looksTaggedAssistantText(text: string): boolean {
  const first = (text ?? "").trim().split(/\r?\n/)[0] ?? "";
  return SPEAKER_LINE.test(first);
}

export function rawContentFromMessageRow(rawResponse: unknown): string | null {
  if (!rawResponse || typeof rawResponse !== "object") return null;
  const rc = (rawResponse as { rawContent?: unknown }).rawContent;
  return typeof rc === "string" && rc.trim() ? rc : null;
}

/** DB 1 行（タグ付き全文）→ UI 用チャンク */
export function expandTaggedAssistantText(
  text: string,
  defaultSpeaker: string,
): MarkdownSpeakerChunk[] {
  const raw = (text ?? "").trim();
  if (!raw) return [{ speaker: defaultSpeaker, text: "（空）" }];
  const fromRaw = parseMarkdownSpeakers(raw, defaultSpeaker);
  if (!looksTaggedAssistantText(raw) && fromRaw.length === 1 && fromRaw[0]!.text === raw) {
    return fromRaw;
  }
  return mergeConsecutiveSameSpeaker(fromRaw);
}
