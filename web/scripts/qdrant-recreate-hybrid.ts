/**
 * ao_rag を削除して hybrid で作り直す（典籍ベクトルは全消去 → 再 ingest 必須）
 *
 *   npm run qdrant:recreate-hybrid
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { EMBED_DIMENSIONS } from "../src/lib/ao-rag-policy";
import { ensureQdrantHybridCollection } from "../src/lib/qdrant-hybrid";
import { loadQdrantConfig, qdrantRequest } from "../src/lib/qdrant-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const cfg = loadQdrantConfig();
  if (!cfg) throw new Error("QDRANT_URL / QDRANT_API_KEY が必要です");

  const del = await qdrantRequest(cfg, "DELETE", `/collections/${cfg.collection}`);
  const delRaw = await del.text();
  console.info(`[recreate] DELETE ${cfg.collection}: ${del.status} ${delRaw.slice(0, 120)}`);

  await ensureQdrantHybridCollection(cfg, EMBED_DIMENSIONS);
  console.info(`[recreate] OK hybrid ${cfg.collection} (dense ${EMBED_DIMENSIONS} + bm25)`);
  console.info("[recreate] 次: POST /api/notebook/ingest で典籍 MD を再投入");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
