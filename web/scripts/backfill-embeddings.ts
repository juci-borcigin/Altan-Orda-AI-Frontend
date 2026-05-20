/**
 * embeddings を全件削除し、messages 本文を再ベクトル化する。
 * - threads.source_provider が gemini（大小無視）のスレッドは除外
 * - threads.title に「テスト」を含むスレッドは除外
 * - user / assistant どちらの role も対象（messages.text のみ）
 *
 * web ディレクトリで実行:
 *   npx tsx scripts/backfill-embeddings.ts --dry-run
 *   npx tsx scripts/backfill-embeddings.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  storeEmbeddingsForMessageTexts,
  type EmbeddingMessageRow,
} from "../src/lib/embedding-pipeline";
import { normalizeEmbedProjectId } from "../src/lib/rag-embed-query";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const PAGE = 500;
const BATCH = 20;
const BATCH_DELAY_MS = 200;

type ThreadMeta = {
  source_provider: string | null;
  title: string;
  project_id: string | null;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadAllThreads(supa: SupabaseClient) {
  const map = new Map<string, ThreadMeta>();
  let from = 0;
  for (;;) {
    const { data, error } = await supa
      .from("threads")
      .select("id,source_provider,title,project_id")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      id: string;
      source_provider: string | null;
      title: string | null;
      project_id: string | null;
    }>;
    for (const t of rows) {
      map.set(t.id, {
        source_provider: t.source_provider,
        title: typeof t.title === "string" ? t.title : "",
        project_id: typeof t.project_id === "string" ? t.project_id : null,
      });
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

function shouldSkipThread(meta: ThreadMeta | undefined): boolean {
  if (!meta) return true;
  const sp = (meta.source_provider ?? "").trim().toLowerCase();
  if (sp === "gemini") return true;
  if (meta.title.includes("テスト")) return true;
  return false;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const oai = process.env.OPENAI_API_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です（web/.env）");
  if (!dryRun && !oai) throw new Error("OPENAI_API_KEY が必要です");

  const supa = createClient(url, key) as SupabaseClient;

  console.log("[backfill-embeddings] loading threads…");
  const threadMap = await loadAllThreads(supa);
  console.log(`[backfill-embeddings] threads=${threadMap.size}`);

  let msgTotal = 0;
  let toEmbed = 0;
  let skipped = 0;
  let orphan = 0;

  let from = 0;
  for (;;) {
    const { data: msgs, error } = await supa
      .from("messages")
      .select("id,text,thread_id")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (msgs ?? []) as Array<{ id: string; text: string; thread_id: string }>;
    if (rows.length === 0) break;
    for (const m of rows) {
      msgTotal++;
      const meta = threadMap.get(m.thread_id);
      if (!meta) {
        orphan++;
        continue;
      }
      if (shouldSkipThread(meta)) {
        skipped++;
        continue;
      }
      if (!String(m.text ?? "").trim()) {
        skipped++;
        continue;
      }
      toEmbed++;
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  console.log(
    `[backfill-embeddings] messages scanned=${msgTotal} to_embed=${toEmbed} skipped=${skipped} orphan_thread=${orphan}`,
  );

  if (dryRun) {
    console.log("[backfill-embeddings] --dry-run のため DB 変更なし");
    return;
  }

  console.log("[backfill-embeddings] deleting all embeddings…");
  const { error: delErr } = await supa.from("embeddings").delete().not("source_type", "is", null);
  if (delErr) throw new Error(`embeddings delete: ${delErr.message}`);

  const batch: EmbeddingMessageRow[] = [];
  let embedded = 0;
  from = 0;
  for (;;) {
    const { data: msgs, error } = await supa
      .from("messages")
      .select("id,text,thread_id")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (msgs ?? []) as Array<{ id: string; text: string; thread_id: string }>;
    if (rows.length === 0) break;

    for (const m of rows) {
      const meta = threadMap.get(m.thread_id);
      if (!meta || shouldSkipThread(meta)) continue;
      const text = String(m.text ?? "").trim();
      if (!text) continue;

      batch.push({
        id: m.id,
        text,
        threadSourceProvider: meta.source_provider,
        threadTitle: meta.title,
        embedProjectId: normalizeEmbedProjectId(meta.project_id),
      });
      if (batch.length >= BATCH) {
        await storeEmbeddingsForMessageTexts(supa, batch, oai!);
        embedded += batch.length;
        batch.length = 0;
        process.stdout.write(`\r[backfill-embeddings] embedded_messages=${embedded}/${toEmbed}   `);
        await sleep(BATCH_DELAY_MS);
      }
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  if (batch.length) {
    await storeEmbeddingsForMessageTexts(supa, batch, oai!);
    embedded += batch.length;
  }
  console.log(`\n[backfill-embeddings] done embedded_message_rows=${embedded}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
