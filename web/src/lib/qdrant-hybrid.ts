import { EMBED_DIMENSIONS } from "./ao-rag-policy";
import { qdrantRequest, type QdrantConfig } from "./qdrant-client";

/** Qdrant Cloud Inference が必要 */
export const QDRANT_BM25_MODEL = "qdrant/bm25" as const;

const PAYLOAD_INDEX_FIELDS = ["project_id", "kind", "source_id", "theme_slug"] as const;

type CollectionGetBody = {
  result?: {
    config?: {
      params?: {
        vectors?: Record<string, unknown> | { size?: number };
        sparse_vectors?: Record<string, unknown>;
      };
    };
  };
};

export async function getQdrantCollectionInfo(
  cfg: QdrantConfig,
): Promise<CollectionGetBody | null> {
  const res = await qdrantRequest(cfg, "GET", `/collections/${cfg.collection}`);
  if (!res.ok) return null;
  return JSON.parse(await res.text()) as CollectionGetBody;
}

/** named vector `dense` + sparse `bm25` */
export function isHybridCollectionInfo(info: CollectionGetBody): boolean {
  const vectors = info.result?.config?.params?.vectors;
  return typeof vectors === "object" && vectors !== null && "dense" in vectors;
}

/** 旧式: 単一 unnamed vector（Phase 6 初期） */
export function isLegacyDenseCollectionInfo(info: CollectionGetBody): boolean {
  const vectors = info.result?.config?.params?.vectors;
  return (
    typeof vectors === "object" &&
    vectors !== null &&
    "size" in vectors &&
    !("dense" in vectors)
  );
}

export async function ensureQdrantHybridCollection(
  cfg: QdrantConfig,
  vectorSize: number = EMBED_DIMENSIONS,
): Promise<void> {
  const info = await getQdrantCollectionInfo(cfg);
  if (info) {
    if (isHybridCollectionInfo(info)) return;
    if (isLegacyDenseCollectionInfo(info)) {
      throw new Error(
        `Qdrant collection「${cfg.collection}」は dense のみです。` +
          `コンソールでコレクションを削除し、npm run init:qdrant のあと典籍を再 ingest してください。`,
      );
    }
    throw new Error(
      `Qdrant collection「${cfg.collection}」のベクトル定義が未対応です。削除後 init:qdrant を実行してください。`,
    );
  }

  const put = await qdrantRequest(cfg, "PUT", `/collections/${cfg.collection}`, {
    vectors: {
      dense: { size: vectorSize, distance: "Cosine" },
    },
    sparse_vectors: {
      bm25: { modifier: "idf" },
    },
  });
  const raw = await put.text();
  if (!put.ok) {
    throw new Error(`Qdrant create hybrid collection ${put.status}: ${raw.slice(0, 400)}`);
  }

  for (const field of PAYLOAD_INDEX_FIELDS) {
    const idx = await qdrantRequest(cfg, "PUT", `/collections/${cfg.collection}/index`, {
      field_name: field,
      field_schema: "keyword",
    });
    if (!idx.ok) {
      const t = await idx.text();
      console.warn(`[qdrant] payload index ${field}: ${idx.status} ${t.slice(0, 200)}`);
    }
  }
}

export function buildBooksQdrantFilter(opts: {
  projectId: string;
  themeSlug?: string | null;
}): Array<Record<string, unknown>> {
  const must: Array<Record<string, unknown>> = [
    { key: "kind", match: { value: "books" } },
    { key: "project_id", match: { value: opts.projectId } },
  ];
  const theme = opts.themeSlug?.trim();
  if (theme) must.push({ key: "theme_slug", match: { value: theme } });
  return must;
}

export function bm25VectorForText(text: string): { text: string; model: string } {
  return { text, model: QDRANT_BM25_MODEL };
}
