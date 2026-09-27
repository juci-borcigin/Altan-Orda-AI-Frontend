/**
 * ao_embeddings の既存ベクトルを Qdrant `juci_conversations` へコピーする。
 * 再埋め込みはしない。Supabase は SELECT のみ（このスクリプトは行を更新しない）。
 *
 * web ディレクトリで:
 *   npx tsx scripts/copy-embeddings-to-qdrant.ts
 *   npx tsx scripts/copy-embeddings-to-qdrant.ts --create-collection --apply
 *   npx tsx scripts/copy-embeddings-to-qdrant.ts --apply
 *   npx tsx scripts/copy-embeddings-to-qdrant.ts --apply --resume
 *   npx tsx scripts/copy-embeddings-to-qdrant.ts --apply --from-id <uuid> --batch 32
 *
 * 引数なしは dry-run（件数と孤児の報告だけ。Qdrant にも Supabase にも書かない）。
 * `--dry-run` を `--apply` と一緒に渡すと dry-run が勝つ。
 * `--create-collection --apply` はコレクションと payload index だけ作り、コピーはしない。
 *
 * 点 ID は ao_embeddings.id。再実行しても同じ点を上書きする。
 * メッセージが無い、または ao_threads にスレッドが無い行は孤児としてスキップする。
 * source_provider が praxia のスレッドだけ origin=praxia。それ以外は ao。
 * visibility は private。
 *
 * 進捗は web/scripts/.copy-embeddings-to-qdrant.checkpoint.json（--apply のときだけ）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildConversationPayload,
  classifyEmbeddingForCopy,
  CONVERSATIONS_PAYLOAD_INDEXES,
  CONVERSATIONS_VECTOR_SIZE,
  conversationPointId,
  conversationsCollectionCreateBody,
  parseCopyEmbeddingsArgs,
  parseEmbeddingVector,
  type CopySkipReason,
} from "../src/lib/conversation-embeddings";
import { ensureQdrantCollection, loadConversationsQdrantConfig } from "../src/lib/qdrant-client";
import { upsertConversationPoints } from "../src/lib/qdrant-conversations";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const PAGE = 1000;
const CHECKPOINT_PATH = path.join(__dirname, ".copy-embeddings-to-qdrant.checkpoint.json");

type ThreadMeta = { sourceProvider: string | null };
type Checkpoint = {
  lastId: string;
  upserted: number;
  orphans: Array<{ id: string; source_id: string; reason: CopySkipReason }>;
};

type EmbeddingRow = {
  id: string;
  source_id: string;
  source_type: string | null;
  kind: string | null;
  project_id: string | null;
  chunk_index: number | null;
  created_at: string | null;
  embedding?: unknown;
};

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  const raw = fs.readFileSync(CHECKPOINT_PATH, "utf8");
  const parsed = JSON.parse(raw) as Checkpoint;
  return {
    lastId: typeof parsed.lastId === "string" ? parsed.lastId : "",
    upserted: typeof parsed.upserted === "number" ? parsed.upserted : 0,
    orphans: Array.isArray(parsed.orphans) ? parsed.orphans : [],
  };
}

function writeCheckpoint(checkpoint: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`);
}

async function loadThreads(supa: SupabaseClient): Promise<Map<string, ThreadMeta>> {
  const map = new Map<string, ThreadMeta>();
  let from = 0;
  for (;;) {
    const { data, error } = await supa
      .from("ao_threads")
      .select("id,source_provider")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`ao_threads: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: string; source_provider: string | null }>;
    for (const row of rows) {
      map.set(row.id, { sourceProvider: row.source_provider });
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function loadMessageThreads(supa: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supa
      .from("ao_messages")
      .select("id,thread_id")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`ao_messages: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: string; thread_id: string | null }>;
    for (const row of rows) {
      if (row.thread_id) map.set(row.id, row.thread_id);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

function printOrphans(orphans: Checkpoint["orphans"]) {
  console.log(`[copy-embeddings] orphans=${orphans.length}`);
  const shown = orphans.slice(0, 80);
  for (const orphan of shown) {
    console.log(`  ${orphan.id} source_id=${orphan.source_id} reason=${orphan.reason}`);
  }
  if (orphans.length > shown.length) {
    console.log(`  … ほか ${orphans.length - shown.length} 件`);
  }
}

async function main() {
  const args = parseCopyEmbeddingsArgs(process.argv.slice(2));
  const mode = args.apply ? "apply" : "dry-run";
  console.log(`[copy-embeddings] mode=${mode} create_collection=${args.createCollection}`);

  if (args.createCollection && !args.apply) {
    console.log("[copy-embeddings] collection spec (not created):");
    console.log(JSON.stringify(conversationsCollectionCreateBody(CONVERSATIONS_VECTOR_SIZE), null, 2));
    console.log(`[copy-embeddings] payload indexes: ${CONVERSATIONS_PAYLOAD_INDEXES.map((f) => f.field_name).join(", ")}`);
    console.log("[copy-embeddings] 作成するには --create-collection --apply");
    return;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!args.createCollection && (!url || !key)) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です（web/.env）");
  }

  if (args.createCollection) {
    const cfg = loadConversationsQdrantConfig();
    if (!cfg) throw new Error("QDRANT_URL / QDRANT_API_KEY が必要です");
    await ensureQdrantCollection(cfg, CONVERSATIONS_VECTOR_SIZE, {
      profile: "conversations",
      allowCreate: true,
    });
    console.log(`[copy-embeddings] collection ready: ${cfg.collection}`);
    console.log("[copy-embeddings] コピーは別コマンドです: npx tsx scripts/copy-embeddings-to-qdrant.ts --apply");
    return;
  }

  const supa = createClient(url!, key!, { auth: { persistSession: false } }) as SupabaseClient;
  console.log("[copy-embeddings] loading threads and messages…");
  const threads = await loadThreads(supa);
  const messageThreads = await loadMessageThreads(supa);
  console.log(`[copy-embeddings] threads=${threads.size} messages=${messageThreads.size}`);

  let qdrantCfg = null as ReturnType<typeof loadConversationsQdrantConfig>;
  if (args.apply) {
    qdrantCfg = loadConversationsQdrantConfig();
    if (!qdrantCfg) throw new Error("QDRANT_URL / QDRANT_API_KEY が必要です");
    await ensureQdrantCollection(qdrantCfg, CONVERSATIONS_VECTOR_SIZE, {
      profile: "conversations",
      allowCreate: false,
    });
  }

  const prior = args.apply && args.resume ? loadCheckpoint() : null;
  if (args.apply && args.resume && !prior) {
    console.log("[copy-embeddings] checkpoint が無いので先頭から読みます");
  }
  let lastId = args.fromId ?? prior?.lastId ?? "";
  let upserted = args.fromId ? 0 : (prior?.upserted ?? 0);
  const orphans: Checkpoint["orphans"] = args.fromId ? [] : [...(prior?.orphans ?? [])];
  const skipped: Record<string, number> = {};
  let scanned = 0;
  let candidates = 0;

  const selectCols = args.apply
    ? "id,source_id,source_type,kind,project_id,chunk_index,created_at,embedding"
    : "id,source_id,source_type,kind,project_id,chunk_index,created_at";

  for (;;) {
    let query = supa.from("ao_embeddings").select(selectCols).order("id", { ascending: true }).limit(args.batchSize);
    if (lastId) query = query.gt("id", lastId);
    const { data, error } = await query;
    if (error) throw new Error(`ao_embeddings: ${error.message}`);
    const rows = (data ?? []) as unknown as EmbeddingRow[];
    if (rows.length === 0) break;

    const points: Array<{
      id: string;
      vector: number[];
      payload: ReturnType<typeof buildConversationPayload>;
    }> = [];
    const batchOrphans: Checkpoint["orphans"] = [];

    for (const row of rows) {
      scanned += 1;
      const threadId = messageThreads.get(row.source_id) ?? null;
      const thread = threadId ? threads.get(threadId) : undefined;
      const vector = args.apply ? parseEmbeddingVector(row.embedding) : null;
      const decision = classifyEmbeddingForCopy(
        { sourceType: row.source_type, kind: row.kind, vector },
        {
          messageThreadId: threadId,
          threadExists: Boolean(threadId && threads.has(threadId)),
          sourceProvider: thread?.sourceProvider,
        },
        { requireVector: args.apply },
      );
      if (decision.action === "skip") {
        skipped[decision.reason] = (skipped[decision.reason] ?? 0) + 1;
        if (decision.reason === "orphan_message" || decision.reason === "orphan_thread") {
          batchOrphans.push({ id: row.id, source_id: row.source_id, reason: decision.reason });
        }
        continue;
      }
      candidates += 1;
      if (!args.apply || !vector) continue;
      points.push({
        id: conversationPointId(row.id),
        vector,
        payload: buildConversationPayload({
          threadId: decision.threadId,
          messageId: row.source_id,
          origin: decision.origin,
          chunkIndex: typeof row.chunk_index === "number" ? row.chunk_index : 0,
          createdAt: row.created_at ?? new Date(0).toISOString(),
          projectId: row.project_id,
          kind: row.kind,
          visibility: "private",
        }),
      });
    }

    if (args.apply && points.length > 0) {
      if (!qdrantCfg) throw new Error("Qdrant config missing");
      await upsertConversationPoints(qdrantCfg, points);
    }

    const tail = rows[rows.length - 1];
    if (!tail) break;
    lastId = tail.id;
    upserted += points.length;
    orphans.push(...batchOrphans);
    if (args.apply) {
      writeCheckpoint({ lastId, upserted, orphans });
    }
    process.stdout.write(
      `\r[copy-embeddings] scanned=${scanned} upserted=${upserted} orphans=${orphans.length}   `,
    );
    if (rows.length < args.batchSize) break;
  }

  console.log("");
  console.log(
    `[copy-embeddings] done scanned=${scanned} candidates=${candidates} written=${upserted} skipped=${JSON.stringify(skipped)}`,
  );
  printOrphans(orphans);
  if (!args.apply) {
    console.log("[copy-embeddings] dry-run のため Qdrant へは書いていません。null ベクトルの検査は --apply のみです。");
  }
}

const invoked =
  process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
