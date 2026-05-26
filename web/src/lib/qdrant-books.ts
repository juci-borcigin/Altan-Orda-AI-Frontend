import { createHash, randomUUID } from "crypto";
import { BOOKS_RRF_MATCH_THRESHOLD } from "./ao-rag-policy";
import { openAiEmbed } from "./embed-openai";
import {
  bm25VectorForText,
  buildBooksQdrantFilter,
  ensureQdrantHybridCollection,
} from "./qdrant-hybrid";
import { loadQdrantConfig, qdrantRequest, type QdrantConfig } from "./qdrant-client";

export type BookChunkPayload = {
  kind: "books";
  project_id: string;
  theme_slug: string;
  source_id: string;
  source_type: "book_file";
  chunk_index: number;
  chunk_text: string;
  source_citation: string;
  content_hash: string;
};

export type BooksSearchHit = {
  chunk_text: string;
  similarity: number;
  source_citation?: string;
  source_id?: string;
};

/** B2: チャンク本文先頭に引用行（embed / BM25 / payload 共通） */
export function bookChunkTextForStorage(
  workTitle: string,
  sectionIndex: number,
  rawBody: string,
): string {
  const citation = `[典籍: ${workTitle || "ソース"} §${sectionIndex}]`;
  const body = rawBody.trim();
  if (!body) return citation;
  if (body.startsWith(citation)) return body;
  return `${citation}\n${body}`;
}

/** RAG 注入用（chunk_text に引用行が無い旧 point 向け） */
export function formatBookHitForRag(hit: BooksSearchHit): string {
  const body = hit.chunk_text?.trim() ?? "";
  if (!body) return "";
  const cite = hit.source_citation?.trim();
  if (!cite || body.startsWith(cite)) return body;
  return `${cite}\n${body}`;
}

export async function deleteBooksPointsBySource(
  cfg: QdrantConfig,
  sourceId: string,
): Promise<void> {
  const res = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/delete`, {
    filter: {
      must: [
        { key: "kind", match: { value: "books" } },
        { key: "source_id", match: { value: sourceId } },
      ],
    },
  });
  if (!res.ok) {
    const raw = await res.text();
    throw new Error(`Qdrant delete books ${res.status}: ${raw.slice(0, 400)}`);
  }
}

export async function upsertBookChunks(opts: {
  cfg: QdrantConfig;
  openaiKey: string;
  projectId: string;
  themeSlug: string;
  sourceId: string;
  workTitle: string;
  chunks: string[];
  contentHash: string;
}): Promise<number> {
  await ensureQdrantHybridCollection(opts.cfg);
  await deleteBooksPointsBySource(opts.cfg, opts.sourceId);

  const points: Array<{
    id: string;
    vector: { dense: number[]; bm25: { text: string; model: string } };
    payload: BookChunkPayload;
  }> = [];

  for (let i = 0; i < opts.chunks.length; i++) {
    const raw = opts.chunks[i]!.trim();
    if (!raw) continue;
    const section = i + 1;
    const citation = `[典籍: ${opts.workTitle || "ソース"} §${section}]`;
    const chunk_text = bookChunkTextForStorage(opts.workTitle, section, raw);
    const dense = await openAiEmbed(chunk_text, opts.openaiKey);
    points.push({
      id: randomUUID(),
      vector: {
        dense,
        bm25: bm25VectorForText(chunk_text),
      },
      payload: {
        kind: "books",
        project_id: opts.projectId,
        theme_slug: opts.themeSlug,
        source_id: opts.sourceId,
        source_type: "book_file",
        chunk_index: i,
        chunk_text,
        source_citation: citation,
        content_hash: opts.contentHash,
      },
    });
  }

  if (points.length === 0) return 0;

  const res = await qdrantRequest(
    opts.cfg,
    "PUT",
    `/collections/${opts.cfg.collection}/points?wait=true`,
    { points },
  );
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Qdrant upsert books ${res.status}: ${raw.slice(0, 400)}`);
  }
  return points.length;
}

/** hybrid: BM25 + dense → RRF（典籍論本番） */
export async function searchBooksQdrant(opts: {
  queryText: string;
  queryVector: number[];
  projectId: string;
  themeSlug?: string | null;
  matchCount?: number;
  matchThreshold?: number;
}): Promise<BooksSearchHit[]> {
  const cfg = loadQdrantConfig();
  if (!cfg) return [];

  const queryText = opts.queryText.trim();
  if (!queryText) return [];

  const must = buildBooksQdrantFilter({
    projectId: opts.projectId,
    themeSlug: opts.themeSlug,
  });
  const limit = Math.max(1, opts.matchCount ?? 5);
  const minScore = opts.matchThreshold ?? BOOKS_RRF_MATCH_THRESHOLD;
  const prefetchLimit = Math.max(limit * 3, 20);

  const res = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/query`, {
    prefetch: [
      {
        query: bm25VectorForText(queryText),
        using: "bm25",
        limit: prefetchLimit,
        filter: { must },
      },
      {
        query: opts.queryVector,
        using: "dense",
        limit: prefetchLimit,
        filter: { must },
      },
    ],
    query: { fusion: "rrf" },
    limit,
    with_payload: true,
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error(`[qdrant] search books hybrid ${res.status}: ${raw.slice(0, 400)}`);
    if (raw.includes("inference") || raw.includes("Inference")) {
      console.error("[qdrant] Qdrant Cloud で Inference を有効化してください");
    }
    return [];
  }

  const data = JSON.parse(raw) as {
    result?: { points?: Array<{ score?: number; payload?: BookChunkPayload }> };
  };
  return (data.result?.points ?? [])
    .map((r) => ({
      chunk_text: r.payload?.chunk_text ?? "",
      similarity: typeof r.score === "number" ? r.score : 0,
      source_citation: r.payload?.source_citation,
      source_id: r.payload?.source_id,
    }))
    .filter((h) => h.similarity >= minScore);
}

export function hashTextContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
