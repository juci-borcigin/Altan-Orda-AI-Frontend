import type { ChunkProfile } from "./ao-chunk-profiles";

/** 段落（空行） */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Markdown 見出し行の直前で分割（見出し行は次セグメントの先頭に残す） */
function splitByHeadings(text: string): string[] {
  const lines = text.split("\n");
  const parts: string[] = [];
  let cur: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) && cur.length > 0) {
      const block = cur.join("\n").trim();
      if (block) parts.push(block);
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  const tail = cur.join("\n").trim();
  if (tail) parts.push(tail);
  return parts.length > 0 ? parts : [text.trim()];
}

/** 日本語文末（。！？）で分割。区切り文字は前セグメントに残す */
function splitBySentences(text: string): string[] {
  const parts: string[] = [];
  let buf = "";
  for (const ch of text) {
    buf += ch;
    if (/[。！？]/.test(ch)) {
      const s = buf.trim();
      if (s) parts.push(s);
      buf = "";
    }
  }
  const rest = buf.trim();
  if (rest) parts.push(rest);
  return parts.length > 0 ? parts : [text.trim()];
}

/** 構造分割でも収まらない塊の最終手段（overlap は pack 側） */
function hardSplit(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + maxChars, t.length);
    out.push(t.slice(i, end));
    if (end >= t.length) break;
    i = end;
  }
  return out;
}

/**
 * 1 ブロックを maxChars 以下のセグメント列に分解。
 * 境界の優先: 空行 → 見出し → 文末 → 固定幅
 */
function splitBlockToSegments(block: string, maxChars: number): string[] {
  const t = block.trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];

  const hasParagraphGap = /\n{2,}/.test(t);
  if (hasParagraphGap) {
    const paras = splitParagraphs(t);
    if (paras.length > 1) {
      return paras.flatMap((p) => splitBlockToSegments(p, maxChars));
    }
  }

  const byHeading = splitByHeadings(t);
  if (byHeading.length > 1) {
    return byHeading.flatMap((h) => splitBlockToSegments(h, maxChars));
  }

  const bySentence = splitBySentences(t);
  if (bySentence.length > 1) {
    return bySentence.flatMap((s) =>
      s.length <= maxChars ? [s] : hardSplit(s, maxChars),
    );
  }

  return hardSplit(t, maxChars);
}

/** セグメントを maxChars 以内にマージし、チャンク間に overlap を入れる */
function packSegments(
  segments: string[],
  maxChars: number,
  overlapChars: number,
): string[] {
  const chunks: string[] = [];
  let buf = "";

  const pushOversizedBuffer = () => {
    while (buf.length > maxChars) {
      chunks.push(buf.slice(0, maxChars).trim());
      const nextStart = Math.max(0, maxChars - overlapChars);
      buf = buf.slice(nextStart).trimStart();
    }
  };

  for (const seg of segments) {
    const sep = buf ? "\n\n" : "";
    const candidate = buf + sep + seg;

    if (candidate.length <= maxChars) {
      buf = candidate;
      continue;
    }

    if (buf.trim()) {
      chunks.push(buf.trim());
      const tail =
        overlapChars > 0 && buf.length > 0
          ? buf.slice(Math.max(0, buf.length - overlapChars))
          : "";
      buf = tail ? `${tail}\n\n${seg}` : seg;
    } else {
      buf = seg;
    }
    pushOversizedBuffer();
  }

  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

/**
 * 構造境界チャンク（Phase 6 B1）。
 * `\n\n` → Markdown `#` 見出し → `。！？` → 固定幅の順で分割し、maxChars までマージする。
 */
export function chunkStructuredText(text: string, profile: ChunkProfile): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= profile.maxChars) return [normalized];

  const segments = splitBlockToSegments(normalized, profile.maxChars);
  return packSegments(segments, profile.maxChars, profile.overlapChars).filter(
    (c) => c.trim().length > 0,
  );
}
