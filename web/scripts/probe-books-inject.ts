import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { openAiEmbed } from "../src/lib/embed-openai";
import { searchBooksQdrant } from "../src/lib/qdrant-books";
import {
  buildBooksBlockWithinBudget,
  extractBookQueryNeedles,
  prioritizeBookHitsForQuery,
} from "../src/lib/rag-phase5";

function hitMatches(
  hit: { chunk_text?: string },
  needles: string[],
): boolean {
  const text = hit.chunk_text ?? "";
  return needles.some((n) => text.includes(n));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const q = process.argv.slice(2).join(" ").trim() || "イギリス人の元修道士についてRAGから";
  const needles = extractBookQueryNeedles(q);
  console.log("needles:", needles);
  const emb = await openAiEmbed(q, process.env.OPENAI_API_KEY!.trim());
  const hits = await searchBooksQdrant({
    queryText: q,
    queryVector: emb,
    projectId: "notebook",
    themeSlug: "juchi-ulus",
    matchCount: 8,
    matchThreshold: 0,
  });
  for (const h of hits) {
    if ((h.chunk_text ?? "").includes("イギリス")) {
      console.log("hit:", h.source_citation, "score", h.similarity);
    }
  }
  const ranked = prioritizeBookHitsForQuery(hits, q);
  const matching = ranked.filter((h) => hitMatches(h, needles));
  console.log(
    "matching:",
    matching.map((h) => h.source_citation),
  );
  const block = buildBooksBlockWithinBudget(
    matching.length > 0 ? matching : ranked,
    2000,
    needles,
  );
  console.log("\n--- inject block (first 500 chars) ---\n");
  console.log(block.slice(0, 500));
  console.log("\ncontains イギリス:", block.includes("イギリス"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
