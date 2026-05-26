/** Qdrant Cloud REST（@qdrant/js-client-rest なし・fetch のみ） */

export type QdrantConfig = {
  url: string;
  apiKey: string;
  collection: string;
};

export function loadQdrantConfig(): QdrantConfig | null {
  const url = process.env.QDRANT_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.QDRANT_API_KEY?.trim();
  const collection = process.env.QDRANT_COLLECTION?.trim() || "ao_rag";
  if (!url || !apiKey) return null;
  return { url, apiKey, collection };
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

export async function ensureQdrantCollection(
  cfg: QdrantConfig,
  vectorSize: number,
): Promise<void> {
  const get = await qdrantRequest(cfg, "GET", `/collections/${cfg.collection}`);
  if (get.ok) return;

  const put = await qdrantRequest(cfg, "PUT", `/collections/${cfg.collection}`, {
    vectors: { size: vectorSize, distance: "Cosine" },
  });
  const raw = await put.text();
  if (!put.ok) {
    throw new Error(`Qdrant create collection ${put.status}: ${raw.slice(0, 400)}`);
  }

  for (const field of ["project_id", "kind", "source_id", "theme_slug"]) {
    const idx = await qdrantRequest(
      cfg,
      "PUT",
      `/collections/${cfg.collection}/index`,
      {
        field_name: field,
        field_schema: "keyword",
      },
    );
    if (!idx.ok) {
      const t = await idx.text();
      console.warn(`[qdrant] payload index ${field}: ${idx.status} ${t.slice(0, 200)}`);
    }
  }
}
