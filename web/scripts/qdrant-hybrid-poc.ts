/**
 * Phase 6 POC: Qdrant hybrid（dense OpenAI + BM25 sparse）検証
 *
 *   npm run qdrant:hybrid-poc -- init
 *   npm run qdrant:hybrid-poc -- migrate
 *   npm run qdrant:hybrid-poc -- query "イギリス人の元修道士"
 *
 * 前提: Qdrant Cloud で Inference 有効。web/.env に QDRANT_* / OPENAI_API_KEY。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { openAiEmbed } from "../src/lib/embed-openai";
import {
  bm25VectorForText,
  buildBooksQdrantFilter,
  ensureQdrantHybridCollection,
} from "../src/lib/qdrant-hybrid";
import { loadQdrantConfig, qdrantRequest } from "../src/lib/qdrant-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const SOURCE_COLLECTION = process.env.QDRANT_COLLECTION?.trim() || "ao_rag";
const HYBRID_COLLECTION = process.env.QDRANT_HYBRID_COLLECTION?.trim() || "ao_rag_hybrid";
type ScrollPoint = {
  id: string | number;
  vector?: Record<string, number[]> | number[];
  payload?: Record<string, unknown>;
};

function cfgHybrid() {
  const base = loadQdrantConfig();
  if (!base) throw new Error("QDRANT_URL / QDRANT_API_KEY が必要です");
  return { ...base, collection: HYBRID_COLLECTION };
}

async function ensureHybridCollection(): Promise<void> {
  const cfg = cfgHybrid();
  const before = await qdrantRequest(cfg, "GET", `/collections/${cfg.collection}`);
  await ensureQdrantHybridCollection(cfg);
  if (before.ok) {
    console.info(`[hybrid-poc] collection ${cfg.collection} は既に存在します`);
  } else {
    console.info(`[hybrid-poc] created ${cfg.collection} (dense + bm25)`);
  }
}

function denseFromPoint(p: ScrollPoint): number[] | null {
  const v = p.vector;
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (Array.isArray(v.dense)) return v.dense;
  return null;
}

async function migrateFromSource(): Promise<void> {
  const src = loadQdrantConfig();
  if (!src) throw new Error("QDRANT_URL / QDRANT_API_KEY が必要です");
  const dst = cfgHybrid();
  await ensureHybridCollection();

  const scroll = await qdrantRequest(
    src,
    "POST",
    `/collections/${SOURCE_COLLECTION}/points/scroll`,
    {
      filter: {
        must: [
          { key: "kind", match: { value: "books" } },
          { key: "project_id", match: { value: "notebook" } },
        ],
      },
      limit: 100,
      with_vector: true,
      with_payload: true,
    },
  );
  const scrollRaw = await scroll.text();
  if (!scroll.ok) {
    throw new Error(`scroll ${SOURCE_COLLECTION} ${scroll.status}: ${scrollRaw.slice(0, 500)}`);
  }
  const body = JSON.parse(scrollRaw) as { result?: { points?: ScrollPoint[] } };
  const points = body.result?.points ?? [];
  if (points.length === 0) {
    throw new Error(`${SOURCE_COLLECTION} に books point がありません。先に ingest を実行してください。`);
  }

  const upsertPoints = points
    .map((p) => {
      const dense = denseFromPoint(p);
      const chunk_text = String(p.payload?.chunk_text ?? "").trim();
      if (!dense?.length || !chunk_text) return null;
      return {
        id: p.id,
        vector: {
          dense,
          bm25: bm25VectorForText(chunk_text),
        },
        payload: p.payload,
      };
    })
    .filter(Boolean);

  const put = await qdrantRequest(
    dst,
    "PUT",
    `/collections/${dst.collection}/points?wait=true`,
    { points: upsertPoints },
  );
  const putRaw = await put.text();
  if (!put.ok) {
    throw new Error(`upsert hybrid ${put.status}: ${putRaw.slice(0, 600)}`);
  }
  console.info(`[hybrid-poc] migrated ${upsertPoints.length} points → ${dst.collection}`);
}

async function searchDenseOnly(query: string): Promise<void> {
  const oai = process.env.OPENAI_API_KEY?.trim();
  if (!oai) throw new Error("OPENAI_API_KEY が必要です");
  const cfg = cfgHybrid();
  const emb = await openAiEmbed(query, oai);
  const res = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/search`, {
    vector: emb,
    using: "dense",
    limit: 8,
    score_threshold: 0,
    with_payload: true,
    filter: {
      must: [
        { key: "kind", match: { value: "books" } },
        { key: "project_id", match: { value: "notebook" } },
      ],
    },
  });
  await printSearchResult("dense only", res);
}

async function searchHybridRrf(query: string): Promise<void> {
  const oai = process.env.OPENAI_API_KEY?.trim();
  if (!oai) throw new Error("OPENAI_API_KEY が必要です");
  const cfg = cfgHybrid();
  const emb = await openAiEmbed(query, oai);
  const res = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/query`, {
    prefetch: [
      {
        query: bm25VectorForText(query),
        using: "bm25",
        limit: 20,
        filter: { must: buildBooksQdrantFilter({ projectId: "notebook" }) },
      },
      {
        query: emb,
        using: "dense",
        limit: 20,
        filter: { must: buildBooksQdrantFilter({ projectId: "notebook" }) },
      },
    ],
    query: { fusion: "rrf" },
    limit: 8,
    with_payload: true,
  });
  await printSearchResult("hybrid RRF", res);
}

async function printSearchResult(label: string, res: Response): Promise<void> {
  const raw = await res.text();
  if (!res.ok) {
    console.error(`\n=== ${label} FAILED ${res.status} ===\n${raw.slice(0, 800)}`);
    if (raw.includes("inference") || raw.includes("Inference")) {
      console.error("\nヒント: Qdrant Cloud コンソールでクラスタの Inference を有効化してください。");
    }
    return;
  }
  const data = JSON.parse(raw) as {
    result?: { points?: Array<{ score?: number; payload?: Record<string, unknown> }> };
  };
  const rows = data.result?.points ?? [];
  console.info(`\n=== ${label} hits=${rows.length} ===`);
  rows.forEach((r, i) => {
    const score = typeof r.score === "number" ? r.score.toFixed(4) : "?";
    const cite = String(r.payload?.source_citation ?? "");
    const text = String(r.payload?.chunk_text ?? "").replace(/\s+/g, " ").slice(0, 100);
    const mark = text.includes("イギリス") ? " ***" : "";
    console.info(`${i + 1}. score=${score}${mark} ${cite}`);
    console.info(`   ${text}…`);
  });
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const query = rest.join(" ").trim() || "イギリス人の元修道士";

  switch (cmd) {
    case "init":
      await ensureHybridCollection();
      break;
    case "migrate":
      await migrateFromSource();
      break;
    case "query":
      await ensureHybridCollection();
      await searchDenseOnly(query);
      await searchHybridRrf(query);
      break;
    default:
      console.info(`Usage:
  npm run qdrant:hybrid-poc -- init
  npm run qdrant:hybrid-poc -- migrate
  npm run qdrant:hybrid-poc -- query "イギリス人の元修道士"`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
