import { NextResponse } from "next/server";
import type { ProjectId } from "@/lib/ao-types";
import {
  buildMessagesFromDbRows,
  type DbMessageRow,
  type DbThreadRow,
  msFromDb,
} from "@/lib/ao-supabase-thread-map";
import {
  isAppStateCore,
  makeDefaultAppState,
  type AppState,
  type Thread,
} from "@/lib/ao-state";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const THREAD_PAGE_SIZE = 1000;
/** PostgREST の .in() が長大になりすぎないよう thread_id を分割 */
const MESSAGE_IN_CHUNK = 100;

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
      .select(
        "id, thread_id, role, text, persona, created_at, model_id, prompt_tokens, completion_tokens, token_count, usd_estimate, raw_prompt_sent, raw_prompt_received, raw_response",
      )
      .in("thread_id", idChunk);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as DbMessageRow[]));
  }
  return out;
}

/** 全 threads・全 messages を一括で返す（移行・デバッグ用。通常 UI は /api/threads/list を使用） */
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
    const sp = typeof tr.source_provider === "string" ? tr.source_provider : null;
    const msgs = buildMessagesFromDbRows(rawMsgs, sp);

    const thread: Thread = {
      id: clientId,
      supabaseThreadId: tid,
      title: tr.title,
      projectId: tr.project_id as ProjectId,
      createdAt: msFromDb(tr.created_at),
      updatedAt: msFromDb(tr.updated_at),
      messages: msgs,
      serverMessagesLoaded: true,
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
