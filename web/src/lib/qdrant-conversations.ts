import {
  buildConversationSearchFilter,
  qdrantMatchLimit,
  scorePassesMatchThreshold,
  type ConversationPointPayload,
} from "./conversation-embeddings";
import {
  loadConversationsQdrantConfig,
  qdrantRequest,
  type QdrantConfig,
} from "./qdrant-client";

type QdrantPointHit = {
  id?: string | number;
  score?: number;
  payload?: Partial<ConversationPointPayload>;
};

function readQueryPoints(body: unknown): QdrantPointHit[] {
  if (!body || typeof body !== "object") return [];
  const result = (body as { result?: unknown }).result;
  if (Array.isArray(result)) return result as QdrantPointHit[];
  if (result && typeof result === "object") {
    const points = (result as { points?: unknown }).points;
    if (Array.isArray(points)) return points as QdrantPointHit[];
  }
  return [];
}

export async function upsertConversationPoints(
  cfg: QdrantConfig,
  points: Array<{ id: string; vector: number[]; payload: ConversationPointPayload }>,
): Promise<void> {
  if (points.length === 0) return;
  const res = await qdrantRequest(cfg, "PUT", `/collections/${cfg.collection}/points?wait=true`, {
    points: points.map((point) => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload,
    })),
  });
  if (!res.ok) {
    const raw = await res.text();
    throw new Error(`Qdrant upsert conversations ${res.status}: ${raw.slice(0, 400)}`);
  }
}

async function deleteByFilter(filter: Record<string, unknown>): Promise<void> {
  const cfg = loadConversationsQdrantConfig();
  if (!cfg) return;
  const res = await qdrantRequest(
    cfg,
    "POST",
    `/collections/${cfg.collection}/points/delete?wait=true`,
    { filter },
  );
  if (res.status === 404) return;
  if (!res.ok) {
    const raw = await res.text();
    throw new Error(`Qdrant delete conversations ${res.status}: ${raw.slice(0, 400)}`);
  }
}

export async function deleteConversationPointsByMessageIds(messageIds: string[]): Promise<void> {
  const ids = [...new Set(messageIds.map((id) => id.trim()).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    await deleteByFilter({
      must: [{ key: "message_id", match: { any: chunk } }],
    });
  }
}

export async function deleteConversationPointsByThread(threadId: string): Promise<void> {
  const id = threadId.trim();
  if (!id) return;
  await deleteByFilter({
    must: [{ key: "thread_id", match: { value: id } }],
  });
}

export async function searchConversationHits(opts: {
  vector: number[];
  matchCount: number;
  matchThreshold: number;
  filterProjectId: string | null;
  filterKind: string | null;
  excludeThreadId: string | null;
}): Promise<Array<{ id: string; score: number; payload: Partial<ConversationPointPayload> }>> {
  const cfg = loadConversationsQdrantConfig();
  if (!cfg) {
    console.error("[rag] RAG_BACKEND=qdrant but QDRANT_URL / QDRANT_API_KEY is missing");
    return [];
  }
  const limit = qdrantMatchLimit(opts.matchCount);
  if (limit <= 0) return [];

  const filter = buildConversationSearchFilter({
    filterProjectId: opts.filterProjectId,
    filterKind: opts.filterKind,
    excludeThreadId: opts.excludeThreadId,
  });
  const body: Record<string, unknown> = {
    query: opts.vector,
    limit,
    with_payload: true,
    with_vector: false,
    score_threshold: opts.matchThreshold,
    params: { quantization: { rescore: true, oversampling: 2 } },
  };
  if (filter) body.filter = filter;

  const res = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/query`, body);
  const raw = await res.text();
  if (res.status === 404) {
    console.error(`[rag] Qdrant collection ${cfg.collection} does not exist`);
    return [];
  }
  if (!res.ok) {
    console.error(`[rag] qdrant search ${res.status}: ${raw.slice(0, 400)}`);
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    console.error("[rag] qdrant search: invalid JSON");
    return [];
  }

  const out: Array<{ id: string; score: number; payload: Partial<ConversationPointPayload> }> = [];
  for (const hit of readQueryPoints(parsed)) {
    const score = typeof hit.score === "number" ? hit.score : 0;
    if (!scorePassesMatchThreshold(score, opts.matchThreshold)) continue;
    const id = hit.id == null ? "" : String(hit.id).toLowerCase();
    if (!id) continue;
    out.push({ id, score, payload: hit.payload ?? {} });
  }
  return out;
}
