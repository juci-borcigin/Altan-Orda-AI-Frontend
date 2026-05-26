/**
 * Qdrant hybrid collection 初期化（ao_rag: dense 1536 + BM25 sparse）
 *
 * 既存の dense のみ collection がある場合は Qdrant コンソールで削除してから実行。
 *
 *   npm run init:qdrant
 */
import { config } from "dotenv";
import { resolve } from "path";
import { EMBED_DIMENSIONS } from "../src/lib/ao-rag-policy";
import { ensureQdrantHybridCollection } from "../src/lib/qdrant-hybrid";
import { loadQdrantConfig } from "../src/lib/qdrant-client";

config({ path: resolve(__dirname, "../.env") });

async function main() {
  const cfg = loadQdrantConfig();
  if (!cfg) {
    throw new Error("QDRANT_URL と QDRANT_API_KEY を web/.env に設定してください");
  }
  await ensureQdrantHybridCollection(cfg, EMBED_DIMENSIONS);
  console.info(
    `[init-qdrant] OK hybrid collection=${cfg.collection} dense=${EMBED_DIMENSIONS} + bm25 url=${cfg.url}`,
  );
  console.info("[init-qdrant] 典籍を再 ingest してください（POST /api/notebook/ingest）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
