import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildConversationPayload,
  conversationOriginFromSourceProvider,
  conversationPointId,
  conversationVectorSyncEnabled,
  embeddingsDualWriteEnabled,
  supabaseVectorWriteEnabled,
  type ConversationOrigin,
  type ConversationVisibility,
} from "./conversation-embeddings";
import { deleteConversationPointsByMessageIds, deleteConversationPointsByThread, upsertConversationPoints } from "./qdrant-conversations";
import { loadConversationsQdrantConfig } from "./qdrant-client";
import { RAG_DEFAULT_KIND } from "./rag-context";
import type { EmbedKind } from "./rag-embed-types";

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

/** chunk_index は配列の添字。DB の default 0 には依存しない。 */
export function enumerateMessageChunks(text: string): Array<{ chunkIndex: number; text: string }> {
  return chunkText(text).map((chunk, chunkIndex) => ({ chunkIndex, text: chunk }));
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

export type EmbeddingMessageRow = {
  id: string;
  text: string;
  /** threads.source_provider。`gemini` のときベクトル化しない */
  threadSourceProvider?: string | null;
  /** threads.title に「テスト」を含むときベクトル化しない（テスト議事の運用用） */
  threadTitle?: string | null;
  /** 正規化済み ao 論 ID（plan, chat, …） */
  embedProjectId?: string | null;
  embedKind?: EmbedKind;
  /** ao_messages.thread_id。dual-write の payload に使う */
  threadId?: string | null;
  /** 未指定なら source_provider が praxia のときだけ praxia、それ以外は ao */
  origin?: ConversationOrigin;
  visibility?: ConversationVisibility;
};

let warnedNoVectorBackend = false;

async function resolveThreadId(
  supa: SupabaseClient,
  row: EmbeddingMessageRow,
): Promise<string | null> {
  const direct = row.threadId?.trim();
  if (direct) return direct;
  const { data, error } = await supa
    .from("ao_messages")
    .select("thread_id")
    .eq("id", row.id)
    .maybeSingle();
  if (error) {
    console.error("[embed] thread lookup:", error.message);
    return null;
  }
  const threadId = (data as { thread_id?: string | null } | null)?.thread_id;
  return typeof threadId === "string" && threadId.trim() ? threadId.trim() : null;
}

/** ao_embeddings 行と、同期対象なら Qdrant 点を message_id で消す。 */
export async function deleteStoredEmbeddingsForMessages(
  supa: SupabaseClient,
  messageIds: string[],
): Promise<string | null> {
  const ids = [...new Set(messageIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return null;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error } = await supa.from("ao_embeddings").delete().in("source_id", chunk);
    if (error) return error.message;
  }
  if (!conversationVectorSyncEnabled()) return null;
  try {
    await deleteConversationPointsByMessageIds(ids);
  } catch (e) {
    console.error("[embed] qdrant delete messages", e);
  }
  return null;
}

/**
 * 議事削除の前に呼ぶ。ao_embeddings.source_id の FK は外れているので、
 * ao_threads の DELETE だけではベクトル行は残る。
 */
export async function deleteStoredEmbeddingsForThread(
  supa: SupabaseClient,
  threadId: string,
): Promise<string | null> {
  const ids: string[] = [];
  const page = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supa
      .from("ao_messages")
      .select("id")
      .eq("thread_id", threadId)
      .range(from, from + page - 1);
    if (error) return error.message;
    const rows = (data ?? []) as Array<{ id: string }>;
    for (const row of rows) {
      if (row.id) ids.push(row.id);
    }
    if (rows.length < page) break;
    from += page;
  }
  const deleted = await deleteStoredEmbeddingsForMessages(supa, ids);
  if (deleted) return deleted;
  if (!conversationVectorSyncEnabled()) return null;
  try {
    await deleteConversationPointsByThread(threadId);
  } catch (e) {
    console.error("[embed] qdrant delete thread", e);
  }
  return null;
}

/** assistant メッセージ保存後、非同期で embeddings へ書き込み（失敗はログのみ） */
export async function storeEmbeddingsForMessageTexts(
  supa: SupabaseClient,
  rows: EmbeddingMessageRow[],
  openaiKey: string,
): Promise<void> {
  const key = openaiKey.trim();
  if (!key || rows.length === 0) return;

  for (const row of rows) {
    const sp = (row.threadSourceProvider ?? "").trim().toLowerCase();
    if (sp === "gemini") continue;
    const title = (row.threadTitle ?? "").trim();
    if (title.includes("テスト")) continue;

    const chunks = enumerateMessageChunks(row.text);
    if (!chunks.length) continue;

    const writeSupabaseVector = supabaseVectorWriteEnabled();
    const dualWrite = embeddingsDualWriteEnabled();
    if (!writeSupabaseVector && !dualWrite && !warnedNoVectorBackend) {
      warnedNoVectorBackend = true;
      console.error(
        "[embed] EMBEDDINGS_SUPABASE_VECTOR is off and EMBEDDINGS_DUAL_WRITE is off; chunk text is stored without a vector",
      );
    }

    const delErr = await deleteStoredEmbeddingsForMessages(supa, [row.id]);
    if (delErr) {
      console.error("[embed] delete previous:", delErr);
      continue;
    }

    const threadId = dualWrite ? await resolveThreadId(supa, row) : row.threadId?.trim() || null;
    const origin = row.origin ?? conversationOriginFromSourceProvider(row.threadSourceProvider);
    if (dualWrite && !threadId) {
      console.error("[embed] dual-write skipped, thread_id missing for message", row.id);
    }

    for (const chunk of chunks) {
      try {
        const title = (row.threadTitle ?? "").trim();
        const titledChunk = title ? `【議事: ${title}】\n${chunk.text}` : chunk.text;
        const embedding = await openAiEmbed(titledChunk, key);
        const kind = row.embedKind ?? RAG_DEFAULT_KIND;
        const insertRow: Record<string, unknown> = {
          source_id: row.id,
          source_type: "message",
          chunk_text: titledChunk,
          kind,
          project_id: row.embedProjectId ?? null,
          chunk_index: chunk.chunkIndex,
        };
        if (writeSupabaseVector) insertRow.embedding = embedding;
        const { data, error } = await supa
          .from("ao_embeddings")
          .insert(insertRow)
          .select("id, created_at")
          .single();
        if (error) {
          console.error("[embed] insert chunk:", error.message);
          continue;
        }
        const inserted = data as { id?: string; created_at?: string } | null;
        if (!dualWrite || !threadId || !inserted?.id) continue;
        const cfg = loadConversationsQdrantConfig();
        if (!cfg) {
          console.error("[embed] EMBEDDINGS_DUAL_WRITE is set but QDRANT_URL / QDRANT_API_KEY is missing");
          continue;
        }
        await upsertConversationPoints(cfg, [
          {
            id: conversationPointId(inserted.id),
            vector: embedding,
            payload: buildConversationPayload({
              threadId,
              messageId: row.id,
              origin,
              chunkIndex: chunk.chunkIndex,
              createdAt: inserted.created_at ?? new Date().toISOString(),
              projectId: row.embedProjectId,
              kind,
              visibility: row.visibility,
            }),
          },
        ]);
      } catch (e) {
        console.error("[embed] chunk failed", e);
      }
    }
  }
}
