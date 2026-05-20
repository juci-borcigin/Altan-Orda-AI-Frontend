/**
 * RAG 検索の診断: クエリ文を埋め込み、match_embeddings の類似度を表示する。
 * web/.env に SUPABASE_* と OPENAI_API_KEY が必要。
 *
 *   npx tsx scripts/probe-rag.ts "作戦AOでは何をやったか？要約してくれ。"
 *   npx tsx scripts/probe-rag.ts --full "RAGテスト4\n\n作戦AOでは何をやったか？要約してくれ。"
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { RAG_DEFAULT_KIND, RAG_MATCH_THRESHOLD } from "../src/lib/rag-context";
import { buildRagEmbedQuery, normalizeRagQuery } from "../src/lib/rag-embed-query";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function openAiEmbed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw) as { data?: Array<{ embedding?: number[] }> };
  const emb = data.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("missing embedding");
  return emb;
}

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes("--full");
  const projectIdx = args.indexOf("--project");
  const filterProject =
    projectIdx >= 0 ? args[projectIdx + 1]?.trim() || null : null;
  const queryParts = args.filter(
    (a, i) => a !== "--full" && a !== "--project" && (projectIdx < 0 || i !== projectIdx + 1),
  );
  const query =
    queryParts.join(" ").trim() || "作戦AOでは何をやったか？要約してくれ。";
  const userMessage = full
    ? query
    : buildRagEmbedQuery({
        lastUserText: query,
        projectId: filterProject,
      });

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const oai = process.env.OPENAI_API_KEY?.trim();
  if (!url || !key || !oai) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY が必要です");
  }

  const supa = createClient(url, key);
  const emb = await openAiEmbed(userMessage, oai);

  for (const threshold of [RAG_MATCH_THRESHOLD, 0.7, 0.55, 0.45]) {
    const { data, error } = await supa.rpc("match_embeddings", {
      query_embedding: emb,
      match_count: 5,
      match_threshold: threshold,
      filter_project_id: filterProject,
      filter_kind: RAG_DEFAULT_KIND,
    });
    if (error) {
      console.error(`threshold=${threshold} error:`, error.message);
      continue;
    }
    const rows = (data ?? []) as Array<{ chunk_text?: string; similarity?: number }>;
    console.log(`\n=== match_threshold=${threshold} hits=${rows.length} ===`);
    for (const r of rows) {
      const sim = typeof r.similarity === "number" ? r.similarity.toFixed(4) : "?";
      const preview = (r.chunk_text ?? "").replace(/\s+/g, " ").slice(0, 120);
      console.log(`  sim=${sim}  ${preview}…`);
    }
  }

  const { count } = await supa
    .from("embeddings")
    .select("id", { count: "exact", head: true })
    .ilike("chunk_text", "%作戦AO%");
  console.log(`\n[warehouse] embeddings with 作戦AO: ${count ?? "?"}`);
  console.log(`[query] ${userMessage.slice(0, 200)}${userMessage.length > 200 ? "…" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
