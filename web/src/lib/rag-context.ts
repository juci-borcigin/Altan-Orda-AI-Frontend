import type { SupabaseClient } from "@supabase/supabase-js";

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
    throw new Error(`OpenAI embeddings ${res.status}: ${raw.slice(0, 400)}`);
  }
  const data = JSON.parse(raw) as { data?: Array<{ embedding?: number[] }> };
  const emb = data.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("OpenAI embeddings: missing vector");
  return emb;
}

/** 初回ユーザー発言のみ embeddings 検索（Profile は ao-prompts のハードコードに統一） */
async function loadRagBlock(
  supa: SupabaseClient,
  userMessage: string,
  isFirstUserTurn: boolean,
  openaiKey: string,
): Promise<string> {
  if (!isFirstUserTurn || !userMessage.trim()) return "";
  const emb = await openAiEmbed(userMessage, openaiKey);
  const { data, error } = await supa.rpc("match_embeddings", {
    query_embedding: emb,
    match_count: 5,
    match_threshold: 0.7,
  });
  if (error) {
    console.error("[rag] match_embeddings:", error.message);
    return "";
  }
  if (!Array.isArray(data) || data.length === 0) return "";
  return data
    .map((row: { chunk_text?: string }) => row.chunk_text?.trim() ?? "")
    .filter(Boolean)
    .join("\n---\n");
}

/**
 * Step 7-2: システムプロンプト末尾に足すブロック（RAG のみ。初回ユーザーターンのみ検索）
 * 殿下プロフィール等は ao-prompts（LORE_PROFILE 等）に集約。
 */
export async function buildRagInjectionBlock(opts: {
  supa: SupabaseClient;
  userMessage: string;
  isFirstUserTurn: boolean;
  openAiKey: string | undefined;
}): Promise<string> {
  if (!opts.openAiKey?.trim()) return "";
  try {
    const rag = await loadRagBlock(
      opts.supa,
      opts.userMessage,
      opts.isFirstUserTurn,
      opts.openAiKey.trim(),
    );
    if (!rag.trim()) return "";
    return `## 関連する過去の議論\n${rag.trim()}`;
  } catch (e) {
    console.error("[rag] embed/search", e);
    return "";
  }
}
