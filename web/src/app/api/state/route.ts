import { NextResponse } from "next/server";
import type { ProjectId } from "@/lib/ao-types";
import {
  isAppStateCore,
  makeDefaultAppState,
  type AppState,
  type Msg,
  type Thread,
} from "@/lib/ao-state";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { displayTextForClaudeImportedAssistant } from "@/lib/ao-claude-display-text";

type DbThreadRow = {
  id: string;
  client_thread_id: string | null;
  title: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  source_provider: string | null;
};

type DbMessageRow = {
  id: string;
  thread_id: string;
  role: string;
  text: string;
  persona: string | null;
  created_at: string;
};

const THREAD_PAGE_SIZE = 1000;
/** PostgREST の .in() が長大になりすぎないよう thread_id を分割 */
const MESSAGE_IN_CHUNK = 100;

/**
 * DB の日時が不正だと `getTime()` が NaN になる。`JSON.stringify` は NaN を null にし、
 * クライアントの `isMsg` / `isThread`（typeof x === "number"）が落ちて localStorage にフォールバックする。
 */
function msFromDb(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 既定の max-rows（1000）を超える threads もすべて取得 */
async function fetchAllThreadRows(supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const out: DbThreadRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supa
      .from("threads")
      .select("id, client_thread_id, title, project_id, created_at, updated_at, source_provider")
      .order("updated_at", { ascending: false })
      .range(from, from + THREAD_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...(data as DbThreadRow[]));
    if (data.length < THREAD_PAGE_SIZE) break;
    from += THREAD_PAGE_SIZE;
  }
  return out;
}

async function fetchMessagesBatched(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  threadIds: string[],
) {
  const out: DbMessageRow[] = [];
  for (const idChunk of chunkIds(threadIds, MESSAGE_IN_CHUNK)) {
    const { data, error } = await supa
      .from("messages")
      .select("id, thread_id, role, text, persona, created_at")
      .in("thread_id", idChunk);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as DbMessageRow[]));
  }
  return out;
}

export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let rows: DbThreadRow[];
  try {
    rows = await fetchAllThreadRows(supa);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!rows.length) {
    const state = makeDefaultAppState();
    return NextResponse.json({ source: "supabase" as const, state, emptyDb: true });
  }

  const ids = rows.map((t) => t.id);

  let msgRows: DbMessageRow[];
  try {
    msgRows = await fetchMessagesBatched(supa, ids);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const byThread = new Map<string, DbMessageRow[]>();
  for (const m of msgRows) {
    const arr = byThread.get(m.thread_id) ?? [];
    arr.push(m);
    byThread.set(m.thread_id, arr);
  }
  for (const arr of byThread.values()) {
    arr.sort((a, b) => msFromDb(a.created_at) - msFromDb(b.created_at));
  }

  const threads: Thread[] = rows.map((tr) => {
    const tid = tr.id;
    const clientId = tr.client_thread_id?.trim() || tid;
    const rawMsgs = byThread.get(tid) ?? [];
    const msgs: Msg[] = rawMsgs.map((row) => {
      const isUser = row.role === "user";
      const text = isUser
        ? row.text
        : displayTextForClaudeImportedAssistant(tr.source_provider, row.role, row.text);
      return {
        id: String(row.id),
        side: isUser ? "user" : "ai",
        speaker: isUser ? "ジュチ" : row.persona || "不明",
        text,
        createdAt: msFromDb(row.created_at),
      };
    });

    const thread: Thread = {
      id: clientId,
      supabaseThreadId: tid,
      title: tr.title,
      projectId: tr.project_id as ProjectId,
      createdAt: msFromDb(tr.created_at),
      updatedAt: msFromDb(tr.updated_at),
      messages: msgs,
    };
    if (typeof tr.source_provider === "string" && tr.source_provider.trim()) {
      thread.sourceProvider = tr.source_provider.trim();
    }
    return thread;
  });

  const sortedMeta = [...rows].sort((a, b) => msFromDb(b.updated_at) - msFromDb(a.updated_at));
  const top = sortedMeta[0]!;
  const currentThreadId = top.client_thread_id?.trim() || top.id;

  const currentProjectId =
    threads.find((t) => t.id === currentThreadId)?.projectId ?? (threads[0]!.projectId as ProjectId);

  const state: AppState = {
    version: 1,
    currentProjectId,
    currentThreadId,
    threads,
  };

  if (!isAppStateCore(state)) {
    return NextResponse.json({ error: "Invalid assembled state" }, { status: 500 });
  }

  return NextResponse.json({ source: "supabase" as const, state });
}
