/**
 * RAG / ingest の運用定数（典籍論・Qdrant）。
 * 殿下が ao_projects.rag_max_chars 等を変えても、配分比率はここが正。
 */

/** OpenAI text-embedding-3-small の既定次元。Qdrant collection と必ず一致させる */
export const EMBED_MODEL = "text-embedding-3-small" as const;
export const EMBED_DIMENSIONS = 1536;

/**
 * 512 に下げる場合: collection 作り直し + 全典籍の再 ingest。
 * 容量は約 1/3、検索精度はやや低下（個人 RAG では多くて実用可）。
 */
export const EMBED_DIMENSIONS_COMPACT = 512;

/** 1 ソース（1 冊・1 ファイル）あたりの最大チャンク数（超過分は切り捨て） */
export const BOOKS_MAX_CHUNKS_PER_SOURCE = 120;

/** テーマ（theme_slug）あたりの典籍チャンク合計上限 */
export const BOOKS_MAX_CHUNKS_PER_THEME = 4_000;

/**
 * 典籍 dense のみ検索用（非推奨・legacy collection）。
 * 小説本文チャンクはクエリとの cosine が 0.35 未満になりやすい。
 */
export const BOOKS_RAG_MATCH_THRESHOLD = 0.35;

/**
 * 典籍 hybrid（RRF）の類似度下限。BM25+dense 融合スコアは cosine とスケールが異なる。
 */
export const BOOKS_RRF_MATCH_THRESHOLD = 0.1;

/** 典籍 hybrid 検索の取得件数（小冊でもキーワード命中を落とさない） */
export const BOOKS_RRF_MATCH_COUNT = 16;

/** 典籍論（project_id=notebook）: rag_max_chars の配分（合計 1.0） */
export const NOTEBOOK_RAG_CHAR_SHARE = {
  thread: 0.25,
  wiki: 0.25,
  books: 0.5,
} as const;

/** 他論: Wiki を読む（典籍 Qdrant は使わない） */
export const DEFAULT_RAG_CHAR_SHARE = {
  thread: 0.7,
  wiki: 0.3,
  books: 0,
} as const;

export function splitRagMaxChars(
  total: number,
  share: { thread: number; wiki: number; books: number },
): { thread: number; wiki: number; books: number } {
  const t = Math.max(0, Math.floor(total * share.thread));
  const w = Math.max(0, Math.floor(total * share.wiki));
  const b = Math.max(0, total - t - w);
  return { thread: t, wiki: w, books: b };
}
