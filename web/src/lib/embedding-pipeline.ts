import type { SupabaseClient } from "@supabase/supabase-js";

/** Step 7-1 相当: 本文をチャンク化（トークンの近似: 約3文字≈1トークン） */
const CHUNK_CHARS = 500 * 3;
const OVERLAP_CHARS = 50 * 3;

function chunkText(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= CHUNK_CHARS) return [t];
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + CHUNK_CHARS, t.length);
    out.push(t.slice(i, end));
    if (end >= t.length) break;
    i = end - OVERLAP_CHARS;
    if (i < 0) i = 0;
  }
  return out;
}

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
  if (!res.ok) {
    throw new Error(`embeddings ${res.status}: ${raw.slice(0, 400)}`);
  }
  const data = JSON.parse(raw) as { data?: Array<{ embedding?: number[] }> };
  const emb = data.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("missing embedding");
  return emb;
}

/** assistant メッセージ保存後、非同期で embeddings へ書き込み（失敗はログのみ） */
export async function storeEmbeddingsForMessageTexts(
  supa: SupabaseClient,
  rows: Array<{ id: string; text: string }>,
  openaiKey: string,
): Promise<void> {
  const key = openaiKey.trim();
  if (!key || rows.length === 0) return;

  for (const row of rows) {
    const chunks = chunkText(row.text);
    if (!chunks.length) continue;

    await supa.from("embeddings").delete().eq("source_id", row.id).eq("source_type", "message");

    for (const chunk of chunks) {
      try {
        const embedding = await openAiEmbed(chunk, key);
        const { error } = await supa.from("embeddings").insert({
          source_id: row.id,
          source_type: "message",
          chunk_text: chunk,
          embedding,
        });
        if (error) console.error("[embed] insert chunk:", error.message);
      } catch (e) {
        console.error("[embed] chunk failed", e);
      }
    }
  }
}
