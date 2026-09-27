import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildConversationPayload,
  buildConversationSearchFilter,
  classifyEmbeddingForCopy,
  CONVERSATIONS_COLLECTION_DEFAULT,
  CONVERSATIONS_PAYLOAD_INDEXES,
  CONVERSATIONS_VECTOR_SIZE,
  conversationOriginFromSourceProvider,
  conversationPointId,
  conversationsCollectionCreateBody,
  mergeRagHits,
  parseCopyEmbeddingsArgs,
  parseEmbeddingVector,
  planRagBackendSearch,
  qdrantMatchLimit,
  ragBackendFromEnv,
  resolveConversationsCollectionName,
  scorePassesMatchThreshold,
} from "./conversation-embeddings";
import { enumerateMessageChunks } from "./embedding-pipeline";
import {
  ensureQdrantCollection,
  LEGACY_DENSE_PAYLOAD_INDEXES,
  type QdrantConfig,
} from "./qdrant-client";

const EMBEDDING_ID = "BFEA8C94-40D9-4C39-8F68-627A4927A648";
const THREAD_ID = "11111111-1111-4111-8111-111111111111";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";

test("conversation point id is the ao_embeddings uuid", () => {
  assert.equal(conversationPointId(EMBEDDING_ID), EMBEDDING_ID.toLowerCase());
  assert.throws(() => conversationPointId("not-a-uuid"));
});

test("collection name stays in the juci_ prefix", () => {
  assert.equal(resolveConversationsCollectionName(undefined), CONVERSATIONS_COLLECTION_DEFAULT);
  assert.equal(resolveConversationsCollectionName("  juci_conversations  "), "juci_conversations");
  assert.throws(() => resolveConversationsCollectionName("ao_rag"));
});

test("payload defaults to private and origin ao", () => {
  const payload = buildConversationPayload({
    threadId: THREAD_ID,
    messageId: MESSAGE_ID,
    chunkIndex: 2,
    createdAt: "2026-09-27T00:00:00.000Z",
    projectId: null,
    kind: "thread",
  });
  assert.equal(payload.visibility, "private");
  assert.equal(payload.origin, "ao");
  assert.equal(payload.chunk_index, 2);
  assert.equal(payload.project_id, undefined);
  assert.equal(conversationOriginFromSourceProvider("Praxia"), "praxia");
  assert.equal(conversationOriginFromSourceProvider("claude"), "ao");
});

test("collection body is cosine, on_disk, scalar int8", () => {
  const body = conversationsCollectionCreateBody();
  assert.equal(body.vectors.size, 1536);
  assert.equal(body.vectors.distance, "Cosine");
  assert.equal(body.vectors.on_disk, true);
  assert.equal(body.quantization_config.scalar.type, "int8");
  const fields = CONVERSATIONS_PAYLOAD_INDEXES.map((field) => field.field_name);
  assert.ok(fields.includes("thread_id"));
  assert.ok(fields.includes("origin"));
  assert.ok(fields.includes("message_id"));
  assert.deepEqual(LEGACY_DENSE_PAYLOAD_INDEXES, ["project_id", "kind", "source_id", "theme_slug"]);
});

test("chunk indexes follow the chunk order", () => {
  assert.deepEqual(
    enumerateMessageChunks("short").map((chunk) => chunk.chunkIndex),
    [0],
  );
  const indexes = enumerateMessageChunks("a".repeat(1501)).map((chunk) => chunk.chunkIndex);
  assert.deepEqual(indexes, [0, 1]);
});

test("copy classification skips orphans and keeps wiki out", () => {
  const vector = new Array(CONVERSATIONS_VECTOR_SIZE).fill(0.1);
  assert.equal(
    classifyEmbeddingForCopy(
      { sourceType: "wiki_page", kind: "wiki", vector },
      { messageThreadId: null, threadExists: false },
      { requireVector: true },
    ).action,
    "skip",
  );
  const missingMessage = classifyEmbeddingForCopy(
    { sourceType: "message", kind: "thread", vector },
    { messageThreadId: null, threadExists: false },
    { requireVector: true },
  );
  assert.deepEqual(missingMessage, { action: "skip", reason: "orphan_message" });
  const missingThread = classifyEmbeddingForCopy(
    { sourceType: "message", kind: "thread", vector },
    { messageThreadId: THREAD_ID, threadExists: false },
    { requireVector: true },
  );
  assert.deepEqual(missingThread, { action: "skip", reason: "orphan_thread" });
  const ok = classifyEmbeddingForCopy(
    { sourceType: "message", kind: "thread", vector },
    { messageThreadId: THREAD_ID, threadExists: true, sourceProvider: "praxia" },
    { requireVector: true },
  );
  assert.deepEqual(ok, { action: "upsert", threadId: THREAD_ID, origin: "praxia" });
  const dry = classifyEmbeddingForCopy(
    { sourceType: "message", kind: "thread", vector: null },
    { messageThreadId: THREAD_ID, threadExists: true },
    { requireVector: false },
  );
  assert.equal(dry.action, "upsert");
});

test("pgvector threshold is strict and filters match match_embeddings", () => {
  assert.equal(scorePassesMatchThreshold(0.5, 0.5), false);
  assert.equal(scorePassesMatchThreshold(0.51, 0.5), true);
  assert.equal(qdrantMatchLimit(0), 0);
  assert.equal(qdrantMatchLimit(5), 10);
  const filter = buildConversationSearchFilter({
    filterProjectId: "plan",
    filterKind: "thread",
    excludeThreadId: THREAD_ID,
  });
  assert.deepEqual(filter, {
    must: [
      { key: "project_id", match: { value: "plan" } },
      { key: "kind", match: { value: "thread" } },
    ],
    must_not: [{ key: "thread_id", match: { value: THREAD_ID } }],
  });
  assert.equal(
    buildConversationSearchFilter({
      filterProjectId: null,
      filterKind: null,
      excludeThreadId: null,
    }),
    null,
  );
});

test("RAG backend defaults to supabase and keeps wiki on supabase", () => {
  assert.equal(ragBackendFromEnv(undefined), "supabase");
  assert.equal(ragBackendFromEnv("qdrant"), "qdrant");
  assert.deepEqual(planRagBackendSearch("supabase", "thread"), {
    qdrant: null,
    supabase: { filterKind: "thread" },
  });
  assert.deepEqual(planRagBackendSearch("qdrant", "thread"), {
    qdrant: { filterKind: "thread" },
    supabase: null,
  });
  assert.deepEqual(planRagBackendSearch("qdrant", "wiki"), {
    qdrant: null,
    supabase: { filterKind: "wiki" },
  });
  assert.deepEqual(planRagBackendSearch("qdrant", null), {
    qdrant: { filterKind: null },
    supabase: { filterKind: "wiki" },
  });
  const merged = mergeRagHits(
    [
      { similarity: 0.4, chunk_text: "wiki" },
      { similarity: 0.9, chunk_text: "thread" },
    ],
    1,
  );
  assert.equal(merged[0]?.chunk_text, "thread");
});

test("copy script defaults to dry-run", () => {
  assert.equal(parseCopyEmbeddingsArgs([]).apply, false);
  assert.equal(parseCopyEmbeddingsArgs(["--apply"]).apply, true);
  assert.equal(parseCopyEmbeddingsArgs(["--apply", "--dry-run"]).apply, false);
  assert.equal(parseCopyEmbeddingsArgs(["--create-collection"]).createCollection, true);
  assert.equal(parseCopyEmbeddingsArgs(["--from-id", EMBEDDING_ID]).fromId, EMBEDDING_ID);
  assert.equal(parseCopyEmbeddingsArgs(["--batch", "16"]).batchSize, 16);
});

test("pgvector text parses to a number array", () => {
  assert.deepEqual(parseEmbeddingVector("[1, 2, 3]"), [1, 2, 3]);
  assert.equal(parseEmbeddingVector("nope"), null);
  assert.deepEqual(parseEmbeddingVector([0.2, 0.3]), [0.2, 0.3]);
});

describe("qdrant collection create", { concurrency: 1 }, () => {
test("conversations collection is not created unless allowed", async () => {
  const cfg: QdrantConfig = {
    url: "https://qdrant.example",
    apiKey: "test-key",
    collection: "juci_conversations",
  };
  const calls: string[] = [];
  const previous = globalThis.fetch;
  const previousFlag = process.env.QDRANT_CONVERSATIONS_ALLOW_CREATE;
  delete process.env.QDRANT_CONVERSATIONS_ALLOW_CREATE;
  globalThis.fetch = async (input, init) => {
    calls.push(`${init?.method ?? "GET"} ${String(input)}`);
    return new Response("{}", { status: 404 });
  };
  try {
    await assert.rejects(() =>
      ensureQdrantCollection(cfg, 1536, { profile: "conversations", allowCreate: false }),
    );
    assert.deepEqual(calls, ["GET https://qdrant.example/collections/juci_conversations"]);
  } finally {
    globalThis.fetch = previous;
    if (previousFlag === undefined) delete process.env.QDRANT_CONVERSATIONS_ALLOW_CREATE;
    else process.env.QDRANT_CONVERSATIONS_ALLOW_CREATE = previousFlag;
  }
});

test("explicit allowCreate builds the conversations collection and indexes", async () => {
  const cfg: QdrantConfig = {
    url: "https://qdrant.example",
    apiKey: "test-key",
    collection: "juci_conversations",
  };
  const puts: Array<{ url: string; body: unknown }> = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const method = init?.method ?? "GET";
    const url = String(input);
    if (method === "GET") return new Response("{}", { status: 404 });
    puts.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response("{}", { status: 200 });
  };
  try {
    await ensureQdrantCollection(cfg, 1536, { profile: "conversations", allowCreate: true });
  } finally {
    globalThis.fetch = previous;
  }
  assert.equal(puts[0]?.url, "https://qdrant.example/collections/juci_conversations");
  const created = puts[0]?.body as { vectors?: { on_disk?: boolean }; quantization_config?: { scalar?: { type?: string } } };
  assert.equal(created.vectors?.on_disk, true);
  assert.equal(created.quantization_config?.scalar?.type, "int8");
  const indexed = puts.slice(1).map((put) => (put.body as { field_name?: string }).field_name);
  assert.ok(indexed.includes("thread_id"));
  assert.ok(indexed.includes("origin"));
  assert.ok(indexed.includes("message_id"));
});

test("an existing conversations collection with the wrong schema is rejected", async () => {
  const cfg: QdrantConfig = {
    url: "https://qdrant.example",
    apiKey: "test-key",
    collection: "juci_conversations",
  };
  const methods: string[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    methods.push(init?.method ?? "GET");
    return new Response(JSON.stringify({ result: { config: { params: { vectors: { size: 1536, distance: "Cosine" } } } } }), {
      status: 200,
    });
  };
  try {
    await assert.rejects(() =>
      ensureQdrantCollection(cfg, 1536, { profile: "conversations", allowCreate: true }),
    );
  } finally {
    globalThis.fetch = previous;
  }
  assert.deepEqual(methods, ["GET"]);
});

test("legacy dense collection can still be created for the book path helper", async () => {
  const cfg: QdrantConfig = {
    url: "https://qdrant.example",
    apiKey: "test-key",
    collection: "ao_rag",
  };
  const puts: string[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const method = init?.method ?? "GET";
    if (method === "PUT") puts.push(String(input));
    return new Response("{}", { status: method === "GET" ? 404 : 200 });
  };
  try {
    await ensureQdrantCollection(cfg, 1536);
  } finally {
    globalThis.fetch = previous;
  }
  assert.equal(puts[0], "https://qdrant.example/collections/ao_rag");
  assert.ok(puts.length > 1);
});
});
