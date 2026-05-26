/**
 * 典籍（Qdrant kind=books）hybrid RRF 検索の診断
 *
 *   npm run probe:books -- "イギリス人の元修道士"
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { BOOKS_RRF_MATCH_THRESHOLD } from "../src/lib/ao-rag-policy";
import { openAiEmbed } from "../src/lib/embed-openai";
import { searchBooksQdrant } from "../src/lib/qdrant-books";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const query = process.argv.slice(2).join(" ").trim() || "民の主 土屋和成 あらすじ";
  const oai = process.env.OPENAI_API_KEY?.trim();
  if (!oai) throw new Error("OPENAI_API_KEY が必要です");

  const emb = await openAiEmbed(query, oai);

  const hits = await searchBooksQdrant({
    queryText: query,
    queryVector: emb,
    projectId: "notebook",
    themeSlug: "juchi-ulus",
    matchCount: 16,
    matchThreshold: 0,
  });
  console.log(`\n=== hybrid RRF (no min) theme=juchi-ulus hits=${hits.length} ===`);
  for (const h of hits) {
    const sim = h.similarity.toFixed(4);
    const cite = (h.source_citation ?? "").replace(/\s+/g, " ").slice(0, 80);
    const preview = (h.chunk_text ?? "").replace(/\s+/g, " ").slice(0, 140);
    const mark = preview.includes("イギリス") ? " ***" : "";
    console.log(`  score=${sim}${mark}  ${cite}`);
    console.log(`         ${preview}…`);
  }

  const filtered = await searchBooksQdrant({
    queryText: query,
    queryVector: emb,
    projectId: "notebook",
    themeSlug: "juchi-ulus",
    matchCount: 16,
    matchThreshold: BOOKS_RRF_MATCH_THRESHOLD,
  });
  console.log(
    `\n=== hybrid RRF threshold=${BOOKS_RRF_MATCH_THRESHOLD} hits=${filtered.length} ===`,
  );
  for (const h of filtered) {
    const sim = h.similarity.toFixed(4);
    const cite = (h.source_citation ?? "").replace(/\s+/g, " ").slice(0, 80);
    const preview = (h.chunk_text ?? "").replace(/\s+/g, " ").slice(0, 100);
    console.log(`  score=${sim}  ${cite}`);
    console.log(`         ${preview}…`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
