import { EMBED_DIMENSIONS, EMBED_MODEL } from "./ao-rag-policy";

export async function openAiEmbed(
  text: string,
  apiKey: string,
  opts?: { dimensions?: number },
): Promise<number[]> {
  const dimensions = opts?.dimensions ?? EMBED_DIMENSIONS;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text.slice(0, 8000),
      dimensions,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI embeddings ${res.status}: ${raw.slice(0, 400)}`);
  }
  const data = JSON.parse(raw) as { data?: Array<{ embedding?: number[] }> };
  const emb = data.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("OpenAI embeddings: missing vector");
  return emb;
}
