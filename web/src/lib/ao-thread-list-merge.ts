import type { ProjectId } from "@/lib/ao-types";
import { normalizeProjectId } from "@/lib/ao-types";
import type { AppState, Msg, Thread } from "@/lib/ao-state";
import type { DbThreadRow } from "@/lib/ao-supabase-thread-map";
import { msFromDb } from "@/lib/ao-supabase-thread-map";

function threadFromSummaryRow(prev: Thread | undefined, row: DbThreadRow): Thread {
  const clientId = row.client_thread_id?.trim() || row.id;
  const sid = row.id;
  const updatedAt = msFromDb(row.updated_at);
  const createdAt = prev?.createdAt ?? msFromDb(row.created_at);
  const sp = typeof row.source_provider === "string" && row.source_provider.trim() ? row.source_provider.trim() : prev?.sourceProvider;
  const projectId = normalizeProjectId(row.project_id) ?? (prev?.projectId ?? "work");

  if (prev) {
    const hasLocalMessages = prev.messages.length > 0 || prev.ephemeral === true;
    const wasHydratedFromServer = prev.serverMessagesLoaded === true;
    if (hasLocalMessages) {
      return {
        ...prev,
        id: clientId,
        supabaseThreadId: sid,
        title: row.title,
        projectId,
        createdAt,
        updatedAt,
        sourceProvider: sp,
      };
    }
    if (wasHydratedFromServer) {
      return {
        ...prev,
        id: clientId,
        supabaseThreadId: sid,
        title: row.title,
        projectId,
        createdAt,
        updatedAt,
        sourceProvider: sp,
        messages: prev.messages,
        serverMessagesLoaded: true,
      };
    }
    return {
      ...prev,
      id: clientId,
      supabaseThreadId: sid,
      title: row.title,
      projectId,
      createdAt,
      updatedAt,
      sourceProvider: sp,
      messages: [],
      serverMessagesLoaded: false,
    };
  }

  return {
    id: clientId,
    supabaseThreadId: sid,
    title: row.title,
    projectId,
    createdAt,
    updatedAt,
    messages: [],
    serverMessagesLoaded: false,
    ...(sp ? { sourceProvider: sp } : {}),
  };
}

/**
 * Supabase の議事一覧（メタのみ）を state にマージする。
 * - API 行は updated_at 降順で渡す想定（先頭が最新）
 * - topicProjectIds に含まれる論のスレは、バッチに無い既存スレも末尾に残す
 * - それ以外の project のスレはそのまま維持
 */
export function mergeThreadSummariesIntoState(
  prev: AppState,
  rows: DbThreadRow[],
  topicProjectIds: readonly ProjectId[],
): AppState {
  const pidSet = new Set(topicProjectIds);
  const rowKeys = new Set(rows.map((r) => r.client_thread_id?.trim() || r.id));
  const rowSids = new Set(rows.map((r) => r.id));

  const fromApi: Thread[] = rows.map((row) => {
    const clientId = row.client_thread_id?.trim() || row.id;
    const prevT = prev.threads.find((t) => t.id === clientId || t.supabaseThreadId === row.id);
    return threadFromSummaryRow(prevT, row);
  });

  const keptSameProjectNotInBatch = prev.threads.filter((t) => {
    const pid = normalizeProjectId(String(t.projectId));
    if (!pid || !pidSet.has(pid)) return false;
    if (rowKeys.has(t.id)) return false;
    if (t.supabaseThreadId && rowSids.has(t.supabaseThreadId)) return false;
    return true;
  });

  const keptOtherProjects = prev.threads.filter((t) => {
    const pid = normalizeProjectId(String(t.projectId));
    return !pid || !pidSet.has(pid);
  });

  const nextThreads = [...fromApi, ...keptSameProjectNotInBatch, ...keptOtherProjects];

  const stillHasCurrent = nextThreads.some((t) => t.id === prev.currentThreadId);
  const currentThreadId = stillHasCurrent ? prev.currentThreadId : nextThreads[0]?.id ?? prev.currentThreadId;
  const currentProjectId = nextThreads.find((t) => t.id === currentThreadId)?.projectId ?? prev.currentProjectId;

  return {
    ...prev,
    threads: nextThreads,
    currentThreadId,
    currentProjectId,
  };
}

/**
 * GET .../messages?raw=1 の応答を既存メッセージ列へマージ（Raw / usage / completionMeta のみ補完）。
 */
export function mergeMsgsHydrateFromServer(existing: Msg[], fromServer: Msg[]): Msg[] {
  const byId = new Map(fromServer.map((m) => [m.id, m]));
  return existing.map((m) => {
    const s = byId.get(m.id);
    if (!s) return m;
    return {
      ...m,
      ...(s.rawPrompts ? { rawPrompts: s.rawPrompts } : {}),
      ...(s.usage ? { usage: s.usage } : {}),
      ...(s.completionMeta ? { completionMeta: s.completionMeta } : {}),
    };
  });
}
