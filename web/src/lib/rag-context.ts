import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRagEmbedQuery,
  normalizeEmbedProjectId,
  normalizeRagQuery,
} from "./rag-embed-query";

export { buildRagEmbedQuery, normalizeEmbedProjectId, normalizeRagQuery } from "./rag-embed-query";

/** cosine 類似度の下限。0.7 では作戦AO等の実クエリが 0 件になりやすい（probe-rag で要調整） */
export const RAG_MATCH_THRESHOLD = 0.5;

/** RAG 検索で既定とする embeddings.kind */
export const RAG_DEFAULT_KIND = "thread" as const;

export type RagMatchRow = {
  chunk_text?: string;
  similarity?: number;
  project_id?: string | null;
  kind?: string | null;
};

export type RagSearchResult = {
  block: string;
  hitCount: number;
  topSimilarity: number | null;
};

export type RagSearchOptions = {
  enabled?: boolean;
  when?: "first_user" | "every_user";
  isFirstUserTurn: boolean;
  match_count?: number;
  match_threshold?: number;
  max_chars?: number;
  /** ao 論 ID（plan, chat 等）。null なら全論横断 */
  filter_project_id?: string | null;
  filter_kind?: string | null;
  project_label_ja?: string | null;
  /** 当該 Supabase 議事 uuid の message チャンクを RAG から除外 */
  exclude_thread_id?: string | null;
};

/** ao_embeddings 検索（Phase5: rag_when / 件数 / 閾値 / Kind・論フィルタ） */
export async function searchRagChunks(
  supa: SupabaseClient,
  lastUserText: string,
  isFirstUserTurn: boolean,
  openaiKey: string,
  opts?: Partial<RagSearchOptions>,
): Promise<RagSearchResult> {
  const empty: RagSearchResult = { block: "", hitCount: 0, topSimilarity: null };
  const enabled = opts?.enabled ?? true;
  const when = opts?.when ?? "first_user";
  if (!enabled || !lastUserText.trim()) return empty;
  if (when === "first_user" && !isFirstUserTurn) return empty;

  const filterProjectId =
    opts?.filter_project_id !== undefined
      ? opts.filter_project_id
      : null;
  const filterKind = opts?.filter_kind ?? RAG_DEFAULT_KIND;

  const query = buildRagEmbedQuery({
    lastUserText,
    projectLabelJa: opts?.project_label_ja,
    projectId: filterProjectId,
  });
  if (!query) return empty;

  const emb = await openAiEmbed(query, openaiKey);
  return searchRagChunksWithVector(supa, emb, {
    ...opts,
    isFirstUserTurn,
    filter_project_id: filterProjectId,
    filter_kind: filterKind,
  });
}

/** クエリベクトル済みの Supabase RAG（Phase5 複合検索用） */
export async function searchRagChunksWithVector(
  supa: SupabaseClient,
  queryEmbedding: number[],
  opts?: Partial<RagSearchOptions> & { isFirstUserTurn?: boolean },
): Promise<RagSearchResult> {
  const empty: RagSearchResult = { block: "", hitCount: 0, topSimilarity: null };
  const enabled = opts?.enabled ?? true;
  const when = opts?.when ?? "first_user";
  if (!enabled) return empty;
  if (when === "first_user" && !opts?.isFirstUserTurn) return empty;

  const filterProjectId =
    opts?.filter_project_id !== undefined ? opts.filter_project_id : null;
  const filterKind = opts?.filter_kind ?? RAG_DEFAULT_KIND;
  const match_count = opts?.match_count ?? 5;
  const match_threshold = opts?.match_threshold ?? RAG_MATCH_THRESHOLD;
  const excludeThreadId = opts?.exclude_thread_id?.trim() || null;

  const { data, error } = await supa.rpc("match_embeddings", {
    query_embedding: queryEmbedding,
    match_count,
    match_threshold,
    filter_project_id: filterProjectId,
    filter_kind: filterKind,
    exclude_thread_id: excludeThreadId,
  });
  if (error) {
    console.error("[rag] match_embeddings:", error.message);
    return empty;
  }
  const rows = (Array.isArray(data) ? data : []) as RagMatchRow[];
  if (rows.length === 0) {
    console.info(
      `[rag] 0 hits threshold=${match_threshold} project=${filterProjectId ?? "*"} kind=${filterKind}`,
    );
    return empty;
  }
  const topSimilarity =
    typeof rows[0]?.similarity === "number" ? rows[0].similarity : null;
  console.info(
    `[rag] ${rows.length} hits top_sim=${topSimilarity?.toFixed(4) ?? "?"} kind=${filterKind} project=${filterProjectId ?? "*"}`,
  );
  let block = rows
    .map((row) => row.chunk_text?.trim() ?? "")
    .filter(Boolean)
    .join("\n---\n");
  const maxChars = opts?.max_chars ?? 0;
  if (maxChars > 0 && block.length > maxChars) {
    block = `${block.slice(0, maxChars)}\n\n---\n\n（RAG ブロックは長さのため省略）`;
  }
  return { block, hitCount: rows.length, topSimilarity };
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

async function loadRagBlock(
  supa: SupabaseClient,
  userMessage: string,
  isFirstUserTurn: boolean,
  openaiKey: string,
): Promise<string> {
  const { block } = await searchRagChunks(supa, userMessage, isFirstUserTurn, openaiKey);
  return block;
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
