/** Qdrant Cloud REST（@qdrant/js-client-rest なし・fetch のみ） */

import {
  CONVERSATIONS_PAYLOAD_INDEXES,
  CONVERSATIONS_VECTOR_SIZE,
  conversationsAllowCreate,
  conversationsCollectionCreateBody,
  resolveConversationsCollectionName,
} from "./conversation-embeddings";

export type QdrantConfig = {
  url: string;
  apiKey: string;
  collection: string;
};

export type QdrantCollectionProfile = "legacy-dense" | "conversations";

/** 典籍ハイブリッド以前の単一ベクトル用。書籍の本番は qdrant-hybrid 側。 */
export const LEGACY_DENSE_PAYLOAD_INDEXES = [
  "project_id",
  "kind",
  "source_id",
  "theme_slug",
] as const;

export function loadQdrantConfig(): QdrantConfig | null {
  const url = process.env.QDRANT_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.QDRANT_API_KEY?.trim();
  const collection = process.env.QDRANT_COLLECTION?.trim() || "ao_rag";
  if (!url || !apiKey) return null;
  return { url, apiKey, collection };
}

/** 議事用。書籍コレクション名（QDRANT_COLLECTION）とは分ける。 */
export function loadConversationsQdrantConfig(): QdrantConfig | null {
  const url = process.env.QDRANT_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.QDRANT_API_KEY?.trim();
  if (!url || !apiKey) return null;
  return {
    url,
    apiKey,
    collection: resolveConversationsCollectionName(process.env.QDRANT_CONVERSATIONS_COLLECTION),
  };
}

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "api-key": apiKey,
  };
}

export async function qdrantRequest(
  cfg: QdrantConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: headers(cfg.apiKey),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function putPayloadIndex(
  cfg: QdrantConfig,
  fieldName: string,
  fieldSchema: string,
): Promise<void> {
  const idx = await qdrantRequest(cfg, "PUT", `/collections/${cfg.collection}/index`, {
    field_name: fieldName,
    field_schema: fieldSchema,
  });
  if (idx.ok) return;
  const t = await idx.text();
  if (idx.status === 409 || t.toLowerCase().includes("already exists")) return;
  throw new Error(`Qdrant payload index ${fieldName} ${idx.status}: ${t.slice(0, 200)}`);
}

/**
 * コレクションが無ければ作る。
 * - legacy-dense: 既存どおり Cosine + project_id/kind/source_id/theme_slug。呼び出しが作成を意味する。
 * - conversations: on_disk + int8。`allowCreate` または QDRANT_CONVERSATIONS_ALLOW_CREATE のときだけ作る。
 *   名前は juci_ で始める。検索や dual-write からは呼ばない。
 */
export async function ensureQdrantCollection(
  cfg: QdrantConfig,
  vectorSize: number,
  opts?: { allowCreate?: boolean; profile?: QdrantCollectionProfile },
): Promise<void> {
  const profile = opts?.profile ?? "legacy-dense";
  if (profile === "conversations" && !cfg.collection.startsWith("juci_")) {
    throw new Error(
      `conversations collection name must start with juci_ (received ${cfg.collection})`,
    );
  }
  const get = await qdrantRequest(cfg, "GET", `/collections/${cfg.collection}`);
  if (get.ok) {
    if (profile === "conversations") {
      const info = JSON.parse(await get.text()) as {
        result?: {
          config?: {
            params?: { vectors?: { size?: number; distance?: string; on_disk?: boolean } };
            quantization_config?: { scalar?: { type?: string } };
          };
        };
      };
      const vectors = info.result?.config?.params?.vectors;
      const quant = info.result?.config?.quantization_config?.scalar?.type;
      const size = vectorSize || CONVERSATIONS_VECTOR_SIZE;
      const distance = vectors?.distance?.toLowerCase();
      if (vectors?.size !== size || distance !== "cosine" || vectors?.on_disk !== true || quant !== "int8") {
        throw new Error(
          `Qdrant collection ${cfg.collection} の定義が議事用（1536 / Cosine / on_disk / int8）と違います。` +
            `作り直してからコピーしてください。`,
        );
      }
      if (opts?.allowCreate) {
        for (const field of CONVERSATIONS_PAYLOAD_INDEXES) {
          await putPayloadIndex(cfg, field.field_name, field.field_schema);
        }
      }
    }
    return;
  }
  if (get.status !== 404) {
    const raw = await get.text();
    throw new Error(`Qdrant get collection ${get.status}: ${raw.slice(0, 400)}`);
  }

  if (profile === "conversations" || cfg.collection.startsWith("juci_")) {
    const allow = opts?.allowCreate === true || (opts?.allowCreate !== false && conversationsAllowCreate());
    if (!allow) {
      throw new Error(
        `Qdrant collection ${cfg.collection} がありません。` +
          `web/scripts/copy-embeddings-to-qdrant.ts --create-collection --apply で作成するか、` +
          `QDRANT_CONVERSATIONS_ALLOW_CREATE=1 を付けてください。検索と dual-write は自動作成しません。`,
      );
    }
    const size = vectorSize || CONVERSATIONS_VECTOR_SIZE;
    const put = await qdrantRequest(
      cfg,
      "PUT",
      `/collections/${cfg.collection}`,
      conversationsCollectionCreateBody(size),
    );
    const raw = await put.text();
    if (!put.ok) {
      throw new Error(`Qdrant create collection ${put.status}: ${raw.slice(0, 400)}`);
    }
    for (const field of CONVERSATIONS_PAYLOAD_INDEXES) {
      await putPayloadIndex(cfg, field.field_name, field.field_schema);
    }
    return;
  }

  const put = await qdrantRequest(cfg, "PUT", `/collections/${cfg.collection}`, {
    vectors: { size: vectorSize, distance: "Cosine" },
  });
  const raw = await put.text();
  if (!put.ok) {
    throw new Error(`Qdrant create collection ${put.status}: ${raw.slice(0, 400)}`);
  }

  for (const field of LEGACY_DENSE_PAYLOAD_INDEXES) {
    try {
      await putPayloadIndex(cfg, field, "keyword");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[qdrant] payload index ${field}: ${message}`);
    }
  }
}
