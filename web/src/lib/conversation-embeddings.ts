/** 議事ベクトル（ao_embeddings）を Qdrant へ移すときの純関数。HTTP はしない。 */

export const CONVERSATIONS_COLLECTION_DEFAULT = "juci_conversations";
export const CONVERSATIONS_VECTOR_SIZE = 1536;

export const CONVERSATIONS_PAYLOAD_INDEXES = [
  { field_name: "thread_id", field_schema: "keyword" },
  { field_name: "origin", field_schema: "keyword" },
  { field_name: "message_id", field_schema: "keyword" },
  { field_name: "project_id", field_schema: "keyword" },
  { field_name: "kind", field_schema: "keyword" },
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConversationOrigin = "ao" | "praxia";
export type ConversationVisibility = "private" | "shared";
export type RagBackend = "qdrant" | "supabase";

export type ConversationPointPayload = {
  thread_id: string;
  message_id: string;
  origin: ConversationOrigin;
  chunk_index: number;
  created_at: string;
  visibility: ConversationVisibility;
  kind: string;
  project_id?: string;
};

export type CopySkipReason =
  | "not_conversation"
  | "orphan_message"
  | "orphan_thread"
  | "null_vector"
  | "bad_dimensions";

export type EmbeddingCopyDecision =
  | { action: "upsert"; threadId: string; origin: ConversationOrigin }
  | { action: "skip"; reason: CopySkipReason };

export type RagBackendPlan = {
  qdrant: { filterKind: string | null } | null;
  supabase: { filterKind: string | null } | null;
};

export function envFlagEnabled(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function envFlagDisabled(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "no" || v === "off";
}

export function embeddingsDualWriteEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.EMBEDDINGS_DUAL_WRITE);
}

/** 未設定なら Supabase にベクトルを書く（現状維持）。0/false/off で列を埋めない。 */
export function supabaseVectorWriteEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !envFlagDisabled(env.EMBEDDINGS_SUPABASE_VECTOR);
}

export function conversationsAllowCreate(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.QDRANT_CONVERSATIONS_ALLOW_CREATE);
}

export function ragBackendFromEnv(value: string | undefined): RagBackend {
  return value?.trim().toLowerCase() === "qdrant" ? "qdrant" : "supabase";
}

/** 削除同期。検索を Qdrant に倒したあとも、dual-write を切っただけでは点を残さない。 */
export function conversationVectorSyncEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    embeddingsDualWriteEnabled(env) || ragBackendFromEnv(env.RAG_BACKEND) === "qdrant"
  );
}

export function resolveConversationsCollectionName(raw: string | undefined): string {
  const name = raw?.trim() || CONVERSATIONS_COLLECTION_DEFAULT;
  if (!name.startsWith("juci_")) {
    throw new Error(
      `QDRANT_CONVERSATIONS_COLLECTION must start with juci_ (received ${name})`,
    );
  }
  return name;
}

/** 点 ID は ao_embeddings.id そのもの。コピーと dual-write が同じ行を同じ点に上書きする。 */
export function conversationPointId(embeddingId: string): string {
  const id = embeddingId.trim().toLowerCase();
  if (!UUID_RE.test(id)) {
    throw new Error(`ao_embeddings id is not a UUID: ${embeddingId}`);
  }
  return id;
}

export function conversationOriginFromSourceProvider(
  sourceProvider: string | null | undefined,
): ConversationOrigin {
  return (sourceProvider ?? "").trim().toLowerCase() === "praxia" ? "praxia" : "ao";
}

export function buildConversationPayload(input: {
  threadId: string;
  messageId: string;
  origin?: ConversationOrigin;
  chunkIndex: number;
  createdAt: string;
  projectId?: string | null;
  kind?: string | null;
  visibility?: ConversationVisibility;
}): ConversationPointPayload {
  const payload: ConversationPointPayload = {
    thread_id: input.threadId,
    message_id: input.messageId,
    origin: input.origin ?? "ao",
    chunk_index: input.chunkIndex,
    created_at: input.createdAt,
    visibility: input.visibility ?? "private",
    kind: input.kind?.trim() || "thread",
  };
  const project = input.projectId?.trim();
  if (project) payload.project_id = project;
  return payload;
}

export function conversationsCollectionCreateBody(vectorSize = CONVERSATIONS_VECTOR_SIZE) {
  return {
    vectors: {
      size: vectorSize,
      distance: "Cosine" as const,
      on_disk: true,
    },
    quantization_config: {
      scalar: {
        type: "int8" as const,
        quantile: 0.99,
        always_ram: true,
      },
    },
  };
}

export function isConversationEmbeddingRow(
  sourceType: string | null | undefined,
  kind: string | null | undefined,
): boolean {
  return sourceType === "message" || kind === "thread";
}

/**
 * 議事行だけを Qdrant へ載せる。
 * スレッドが消えている行（メッセージ欠落を含む）は孤児として除外する。
 * dry-run はベクトルを読まないので requireVector=false。
 */
export function classifyEmbeddingForCopy(
  row: {
    sourceType: string | null;
    kind: string | null;
    vector: number[] | null;
  },
  lookup: {
    messageThreadId: string | null;
    threadExists: boolean;
    sourceProvider?: string | null;
  },
  opts?: { requireVector?: boolean },
): EmbeddingCopyDecision {
  if (!isConversationEmbeddingRow(row.sourceType, row.kind)) {
    return { action: "skip", reason: "not_conversation" };
  }
  if (!lookup.messageThreadId) {
    return { action: "skip", reason: "orphan_message" };
  }
  if (!lookup.threadExists) {
    return { action: "skip", reason: "orphan_thread" };
  }
  if (opts?.requireVector) {
    if (!row.vector || row.vector.length === 0) {
      return { action: "skip", reason: "null_vector" };
    }
    if (row.vector.length !== CONVERSATIONS_VECTOR_SIZE) {
      return { action: "skip", reason: "bad_dimensions" };
    }
  }
  return {
    action: "upsert",
    threadId: lookup.messageThreadId,
    origin: conversationOriginFromSourceProvider(lookup.sourceProvider),
  };
}

export function parseEmbeddingVector(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const nums = value.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    return nums.length === value.length && nums.length > 0 ? nums : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text.startsWith("[")) return null;
  try {
    return parseEmbeddingVector(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

/** match_embeddings は `similarity > threshold`。Qdrant の score_threshold は境界を含むので、後段でもう一度弾く。 */
export function scorePassesMatchThreshold(score: number, threshold: number): boolean {
  return score > threshold;
}

export function qdrantMatchLimit(matchCount: number): number {
  if (matchCount <= 0) return 0;
  return Math.min(Math.max(matchCount * 2, matchCount), 50);
}

export function buildConversationSearchFilter(input: {
  filterProjectId: string | null;
  filterKind: string | null;
  excludeThreadId: string | null;
}): { must: Array<Record<string, unknown>>; must_not?: Array<Record<string, unknown>> } | null {
  const must: Array<Record<string, unknown>> = [];
  const project = input.filterProjectId?.trim();
  if (project) must.push({ key: "project_id", match: { value: project } });
  const kind = input.filterKind?.trim();
  if (kind) must.push({ key: "kind", match: { value: kind } });
  const exclude = input.excludeThreadId?.trim();
  const mustNot = exclude ? [{ key: "thread_id", match: { value: exclude } }] : [];
  if (must.length === 0 && mustNot.length === 0) return null;
  if (mustNot.length === 0) return { must };
  return { must, must_not: mustNot };
}

/**
 * kind=thread は Qdrant、wiki は Supabase のまま。
 * kind 未指定（全コーパス）は Qdrant の議事と Supabase の wiki を類似度で合流する。
 * books は典籍コレクション側なので、ここでは RPC に渡すだけ。
 */
export function planRagBackendSearch(
  backend: RagBackend,
  filterKind: string | null,
): RagBackendPlan {
  if (backend !== "qdrant") {
    return { qdrant: null, supabase: { filterKind } };
  }
  if (filterKind === "wiki" || filterKind === "books") {
    return { qdrant: null, supabase: { filterKind } };
  }
  if (filterKind === "thread") {
    return { qdrant: { filterKind: "thread" }, supabase: null };
  }
  if (filterKind == null) {
    return { qdrant: { filterKind: null }, supabase: { filterKind: "wiki" } };
  }
  return { qdrant: null, supabase: { filterKind } };
}

export function mergeRagHits<T extends { similarity?: number }>(rows: T[], limit: number): T[] {
  const cap = Math.max(0, limit);
  return [...rows].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)).slice(0, cap);
}

export type CopyEmbeddingsArgs = {
  apply: boolean;
  createCollection: boolean;
  resume: boolean;
  fromId: string | null;
  batchSize: number;
};

/** 引数なしは dry-run。`--dry-run` は `--apply` より優先する。 */
export function parseCopyEmbeddingsArgs(argv: string[]): CopyEmbeddingsArgs {
  let fromId: string | null = null;
  let batchSize = 32;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--from-id") {
      fromId = argv[i + 1]?.trim() || null;
      i += 1;
    } else if (arg.startsWith("--from-id=")) {
      fromId = arg.slice("--from-id=".length).trim() || null;
    } else if (arg === "--batch") {
      batchSize = clampBatch(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--batch=")) {
      batchSize = clampBatch(arg.slice("--batch=".length));
    }
  }
  const apply = argv.includes("--apply") && !argv.includes("--dry-run");
  return {
    apply,
    createCollection: argv.includes("--create-collection"),
    resume: argv.includes("--resume"),
    fromId,
    batchSize,
  };
}

function clampBatch(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 32;
  return Math.min(Math.floor(n), 256);
}
