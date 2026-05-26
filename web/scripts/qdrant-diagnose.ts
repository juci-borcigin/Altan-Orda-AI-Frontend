import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { openAiEmbed } from "../src/lib/embed-openai";
import { loadQdrantConfig, qdrantRequest } from "../src/lib/qdrant-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const cfg = loadQdrantConfig();
  if (!cfg) throw new Error("Qdrant config missing");
  console.log("collection:", cfg.collection, "url:", cfg.url);

  const col = await qdrantRequest(cfg, "GET", `/collections/${cfg.collection}`);
  console.log("GET collection:", col.status, (await col.text()).slice(0, 600));

  const count = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/count`, {
    exact: true,
  });
  console.log("count:", await count.text());

  const scroll = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/scroll`, {
    limit: 2,
    with_payload: true,
  });
  console.log("scroll:", (await scroll.text()).slice(0, 900));

  const oai = process.env.OPENAI_API_KEY?.trim();
  if (!oai) throw new Error("OPENAI_API_KEY");
  const emb = await openAiEmbed("イギリス人の元修道士", oai);

  for (const label of ["no filter", "books+juchi"]) {
    const body =
      label === "no filter"
        ? { vector: emb, limit: 5, score_threshold: 0, with_payload: true }
        : {
            vector: emb,
            limit: 5,
            score_threshold: 0,
            with_payload: true,
            filter: {
              must: [
                { key: "kind", match: { value: "books" } },
                { key: "project_id", match: { value: "notebook" } },
                { key: "theme_slug", match: { value: "juchi-ulus" } },
              ],
            },
          };
    const res = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/search`, body);
    const raw = await res.text();
    console.log(`\nsearch (${label}) status=${res.status}`);
    console.log(raw.slice(0, 1200));
  }

  let offset: unknown = undefined;
  let monkIdx: number | null = null;
  do {
    const body: Record<string, unknown> = { limit: 50, with_payload: true };
    if (offset) body.offset = offset;
    const scr = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/scroll`, body);
    const data = JSON.parse(await scr.text()) as {
      result?: { points?: Array<{ payload?: { chunk_index?: number; chunk_text?: string } }>; next_page_offset?: unknown };
    };
    for (const p of data.result?.points ?? []) {
      const t = p.payload?.chunk_text ?? "";
      if (t.includes("イギリス人")) monkIdx = p.payload?.chunk_index ?? null;
    }
    offset = data.result?.next_page_offset;
  } while (offset);

  console.log("\nchunk with イギリス人: chunk_index=", monkIdx);

  const all = await qdrantRequest(cfg, "POST", `/collections/${cfg.collection}/points/search`, {
    vector: emb,
    limit: 16,
    score_threshold: 0,
    with_payload: true,
    filter: {
      must: [
        { key: "kind", match: { value: "books" } },
        { key: "theme_slug", match: { value: "juchi-ulus" } },
      ],
    },
  });
  const ranked = JSON.parse(await all.text()) as {
    result?: Array<{ score?: number; payload?: { chunk_index?: number; chunk_text?: string } }>;
  };
  for (const r of ranked.result ?? []) {
    if ((r.payload?.chunk_text ?? "").includes("イギリス人")) {
      console.log("イギリス人 chunk rank score=", r.score, "chunk_index=", r.payload?.chunk_index);
    }
  }
  console.log(
    "best score=",
    ranked.result?.[0]?.score,
    "chunk_index=",
    ranked.result?.[0]?.payload?.chunk_index,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
