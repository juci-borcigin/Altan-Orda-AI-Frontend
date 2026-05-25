/** ao_embeddings / Qdrant payload kind（DB check: thread | wiki | books） */
export type EmbedKind = "thread" | "wiki" | "books";

/** ao_embeddings.source_type（DB check） */
export type EmbedSourceType = "message" | "wiki_page" | "book_file";

/** kind ↔ source_type の固定対応 */
export const EMBED_KIND_FOR_SOURCE_TYPE: Record<EmbedSourceType, EmbedKind> = {
  message: "thread",
  wiki_page: "wiki",
  book_file: "books",
};
