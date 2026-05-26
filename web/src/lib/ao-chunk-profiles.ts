import type { EmbedKind } from "./rag-embed-types";
import { chunkStructuredText } from "./chunk-structured";

/** Phase 6 ①: チャンク設定（DB 化は不要・kind ごとの定数） */
export type ChunkProfile = {
  maxChars: number;
  overlapChars: number;
  /** message=固定幅優先, structured=段落・見出し境界 */
  strategy: "message" | "structured";
};

export const CHUNK_PROFILE_BY_KIND: Record<EmbedKind, ChunkProfile> = {
  thread: { maxChars: 500 * 3, overlapChars: 50 * 3, strategy: "message" },
  books: { maxChars: 800 * 3, overlapChars: 100 * 3, strategy: "structured" },
  wiki: { maxChars: 650 * 3, overlapChars: 85 * 3, strategy: "structured" },
};

/** kind 用チャンク（Phase 6 ingest）。books/wiki は構造境界、thread は固定幅 */
export function chunkTextForKind(text: string, kind: EmbedKind): string[] {
  const p = CHUNK_PROFILE_BY_KIND[kind];
  const t = text.trim();
  if (!t) return [];
  if (p.strategy === "structured") {
    return chunkStructuredText(t, p);
  }
  if (t.length <= p.maxChars) return [t];
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + p.maxChars, t.length);
    out.push(t.slice(i, end));
    if (end >= t.length) break;
    i = end - p.overlapChars;
    if (i < 0) i = 0;
  }
  return out;
}
