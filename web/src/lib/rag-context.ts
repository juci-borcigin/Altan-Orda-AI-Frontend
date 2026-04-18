import type { SupabaseClient } from "@supabase/supabase-js";

/** おおよそ 1 トークンあたりの文字数（日本語混じりの粗い上限） */
const CHARS_PER_TOKEN_EST = 2;
const PROFILE_TOKEN_BUDGET = 2000;

function estimateTokens(s: string): number {
  return Math.ceil(s.length / CHARS_PER_TOKEN_EST);
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
    throw new Error(`OpenAI embeddings ${res.status}: ${raw.slice(0, 400)}`);
  }
  const data = JSON.parse(raw) as { data?: Array<{ embedding?: number[] }> };
  const emb = data.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("OpenAI embeddings: missing vector");
  return emb;
}

async function loadProfileBlock(supa: SupabaseClient): Promise<string> {
  const { data, error } = await supa
    .from("profile_entries")
    .select("category, content, priority")
    .order("priority", { ascending: true });
  if (error) {
    console.error("[rag] profile_entries:", error.message);
    return "";
  }
  if (!data?.length) return "";

  const lines: string[] = [];
  let budget = PROFILE_TOKEN_BUDGET;
  for (const row of data) {
    const line = `[${row.category ?? "?"}] ${row.content ?? ""}`.trim();
    if (!line) continue;
    const cost = estimateTokens(line);
    if (cost > budget) break;
    lines.push(line);
    budget -= cost;
  }
  if (!lines.length) return "";
  return lines.join("\n\n");
}

/** 初回ユーザー発言のみ embeddings 検索 */
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
 * Step 7-2: システムプロンプト末尾に足すブロック（profile 常時・RAG は初回ユーザーターンのみ）
 */
export async function buildRagInjectionBlock(opts: {
  supa: SupabaseClient;
  userMessage: string;
  isFirstUserTurn: boolean;
  openAiKey: string | undefined;
}): Promise<string> {
  const profile = await loadProfileBlock(opts.supa);
  let rag = "";
  if (opts.openAiKey?.trim()) {
    try {
      rag = await loadRagBlock(
        opts.supa,
        opts.userMessage,
        opts.isFirstUserTurn,
        opts.openAiKey.trim(),
      );
    } catch (e) {
      console.error("[rag] embed/search", e);
    }
  }

  const parts: string[] = [];
  if (profile.trim()) {
    parts.push(`## 殿下に関する背景知識\n${profile.trim()}`);
  }
  if (rag.trim()) {
    parts.push(`## 関連する過去の議論\n${rag.trim()}`);
  }
  return parts.join("\n\n");
}
