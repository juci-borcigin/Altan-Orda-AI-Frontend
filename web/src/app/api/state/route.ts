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

type DbThreadRow = {
  id: string;
  client_thread_id: string | null;
  title: string;
  project_id: string;
  created_at: string;
  updated_at: string;
};

type DbMessageRow = {
  id: string;
  thread_id: string;
  role: string;
  text: string;
  persona: string | null;
  created_at: string;
};

export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: threadRows, error: te } = await supa
    .from("threads")
    .select("id, client_thread_id, title, project_id, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (te) {
    return NextResponse.json({ error: te.message }, { status: 500 });
  }

  if (!threadRows?.length) {
    const state = makeDefaultAppState();
    return NextResponse.json({ source: "supabase" as const, state, emptyDb: true });
  }

  const rows = threadRows as DbThreadRow[];
  const ids = rows.map((t) => t.id);

  const { data: msgRows, error: me } = await supa
    .from("messages")
    .select("id, thread_id, role, text, persona, created_at")
    .in("thread_id", ids)
    .order("created_at", { ascending: true });

  if (me) {
    return NextResponse.json({ error: me.message }, { status: 500 });
  }

  const byThread = new Map<string, DbMessageRow[]>();
  for (const m of (msgRows ?? []) as DbMessageRow[]) {
    const arr = byThread.get(m.thread_id) ?? [];
    arr.push(m);
    byThread.set(m.thread_id, arr);
  }

  const threads: Thread[] = rows.map((tr) => {
    const tid = tr.id;
    const clientId = tr.client_thread_id?.trim() || tid;
    const rawMsgs = byThread.get(tid) ?? [];
    const msgs: Msg[] = rawMsgs.map((row) => {
      const isUser = row.role === "user";
      return {
        id: String(row.id),
        side: isUser ? "user" : "ai",
        speaker: isUser ? "ジュチ" : row.persona || "不明",
        text: row.text,
        createdAt: new Date(row.created_at).getTime(),
      };
    });

    return {
      id: clientId,
      supabaseThreadId: tid,
      title: tr.title,
      projectId: tr.project_id as ProjectId,
      createdAt: new Date(tr.created_at).getTime(),
      updatedAt: new Date(tr.updated_at).getTime(),
      messages: msgs,
    };
  });

  const sortedMeta = [...rows].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
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
