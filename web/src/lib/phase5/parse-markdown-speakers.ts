export type MarkdownSpeakerChunk = { speaker: string; text: string };

const SPEAKER_LINE = /^[ \t]*[＜<]([^＞>]+)[＞>][ \t]*$/;

/**
 * Markdown 返答を ＜ペルソナ名＞ 行で分割。タグが無い場合は defaultSpeaker に全文を割り当てる。
 */
export function parseMarkdownSpeakers(text: string, defaultSpeaker: string): MarkdownSpeakerChunk[] {
  const raw = (text ?? "").trim();
  if (!raw) return [{ speaker: defaultSpeaker, text: "（空）" }];

  const lines = raw.split(/\r?\n/);
  const chunks: MarkdownSpeakerChunk[] = [];
  let currentSpeaker: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (!currentSpeaker) return;
    const body = buf.join("\n").trim();
    if (body.length > 0) chunks.push({ speaker: currentSpeaker, text: body });
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(SPEAKER_LINE);
    if (m) {
      flush();
      currentSpeaker = m[1].trim();
      continue;
    }
    if (currentSpeaker) buf.push(line);
  }
  flush();

  if (chunks.length > 0) return chunks;
  return [{ speaker: defaultSpeaker, text: raw }];
}

/**
 * ストリーム途中の部分本文用。末尾の未確定話者ブロックも flush する。
 */
export function parseMarkdownSpeakersStreaming(
  text: string,
  defaultSpeaker: string,
): MarkdownSpeakerChunk[] {
  const raw = text ?? "";
  if (!raw.trim()) return [];

  const lines = raw.split(/\r?\n/);
  const chunks: MarkdownSpeakerChunk[] = [];
  let currentSpeaker: string | null = null;
  let buf: string[] = [];

  const flush = (allowEmptyBody: boolean) => {
    if (!currentSpeaker) return;
    const body = buf.join("\n");
    if (body.length > 0 || allowEmptyBody) chunks.push({ speaker: currentSpeaker, text: body });
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(SPEAKER_LINE);
    if (m) {
      flush(false);
      currentSpeaker = m[1].trim();
      continue;
    }
    if (currentSpeaker) buf.push(line);
  }
  flush(true);

  if (chunks.length > 0) return chunks;
  return [{ speaker: defaultSpeaker, text: raw }];
}

export function isMarkdownParseFallback(chunks: MarkdownSpeakerChunk[], rawText: string): boolean {
  if (chunks.length !== 1) return false;
  const raw = (rawText ?? "").trim();
  if (!raw) return true;
  return !SPEAKER_LINE.test(raw.split(/\r?\n/)[0] ?? "") && chunks[0].text === raw;
}

export function mergeConsecutiveSameSpeaker(chunks: MarkdownSpeakerChunk[]): MarkdownSpeakerChunk[] {
  if (chunks.length <= 1) return chunks;
  const out: MarkdownSpeakerChunk[] = [];
  for (const c of chunks) {
    const prev = out[out.length - 1];
    if (prev && prev.speaker === c.speaker) {
      const a = prev.text.trimEnd();
      const b = c.text.trim();
      out[out.length - 1] = {
        speaker: prev.speaker,
        text: [a, b].filter(Boolean).join("\n\n"),
      };
    } else {
      out.push({ ...c });
    }
  }
  return out;
}
