import type { AppState, Msg, Thread } from "@/lib/ao-state";
import type { DbThreadRow } from "@/lib/ao-supabase-thread-map";
import { msFromDb } from "@/lib/ao-supabase-thread-map";

export type ThreadMessageRefetchTarget = {
  clientId: string;
  supabaseThreadId: string;
};

/** ローカル送信直後と DB updated_at の誤差吸収（ms） */
const REFETCH_TOLERANCE_MS = 750;

export function threadNeedsMessageRefetch(prev: Thread | undefined, row: DbThreadRow): boolean {
  if (!prev?.supabaseThreadId || prev.ephemeral) return false;
  const dbAt = msFromDb(row.updated_at);
  if (!dbAt) return false;
  const localAt = prev.updatedAt ?? 0;
  return dbAt > localAt + REFETCH_TOLERANCE_MS;
}

/** 一覧 API 行とローカル state を比較し、messages 全文再取得が必要な議事を列挙 */
export function collectThreadsNeedingMessageRefetch(
  prev: AppState,
  rows: DbThreadRow[],
): ThreadMessageRefetchTarget[] {
  const out: ThreadMessageRefetchTarget[] = [];
  for (const row of rows) {
    const clientId = row.client_thread_id?.trim() || row.id;
    const prevT = prev.threads.find((t) => t.id === clientId || t.supabaseThreadId === row.id);
    if (!threadNeedsMessageRefetch(prevT, row)) continue;
    out.push({ clientId, supabaseThreadId: row.id });
  }
  return out;
}

export function applyReconciledThreadMessages(
  prev: AppState,
  clientId: string,
  messages: Msg[],
  meta: {
    historyCompression?: Thread["historyCompression"] | null;
    pinnedThreadIds?: string[];
    updatedAt?: number;
  },
): AppState {
  return {
    ...prev,
    threads: prev.threads.map((t) => {
      if (t.id !== clientId) return t;
      return {
        ...t,
        messages,
        serverMessagesLoaded: true,
        ...(meta.historyCompression !== undefined
          ? meta.historyCompression
            ? { historyCompression: meta.historyCompression }
            : { historyCompression: undefined }
          : {}),
        ...(meta.pinnedThreadIds !== undefined ? { pinnedThreadIds: meta.pinnedThreadIds } : {}),
        ...(meta.updatedAt !== undefined ? { updatedAt: meta.updatedAt } : {}),
      };
    }),
  };
}
