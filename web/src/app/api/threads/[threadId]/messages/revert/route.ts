import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteCtx = { params: Promise<{ threadId: string }> };

/**
 * 指定ユーザーメッセージ以降を削除（Revert）。
 * POST /api/threads/{uuid}/messages/revert  body: { messageId: string }
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { threadId } = await ctx.params;
  const tid = decodeURIComponent(threadId ?? "").trim();
  if (!UUID_RE.test(tid)) {
    return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
  }

  let body: { messageId?: string };
  try {
    body = (await req.json()) as { messageId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  if (!messageId || !UUID_RE.test(messageId)) {
    return NextResponse.json({ error: "messageId (uuid) is required" }, { status: 400 });
  }

  const { data: thread, error: te } = await supa
    .from("ao_threads")
    .select("id, source_provider")
    .eq("id", tid)
    .maybeSingle();
  if (te) return NextResponse.json({ error: te.message }, { status: 500 });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const provider = (thread.source_provider as string | null)?.trim().toLowerCase() ?? "";
  if (provider && provider !== "ao") {
    return NextResponse.json({ error: "imported threads cannot be reverted via API" }, { status: 403 });
  }

  const { data: pivot, error: pe } = await supa
    .from("ao_messages")
    .select("id, role, created_at")
    .eq("id", messageId)
    .eq("thread_id", tid)
    .maybeSingle();
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
  if (!pivot) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (pivot.role !== "user") {
    return NextResponse.json({ error: "Only user messages can be reverted from" }, { status: 400 });
  }

  const pivotAt = pivot.created_at as string;

  const { data: toDelete, error: de } = await supa
    .from("ao_messages")
    .select("id")
    .eq("thread_id", tid)
    .gte("created_at", pivotAt);
  if (de) return NextResponse.json({ error: de.message }, { status: 500 });

  const ids = (toDelete ?? []).map((r) => r.id as string);
  if (ids.length) {
    await supa.from("ao_embeddings").delete().in("source_id", ids);
    const { error: me } = await supa.from("ao_messages").delete().in("id", ids);
    if (me) return NextResponse.json({ error: me.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: ue } = await supa
    .from("ao_threads")
    .update({ updated_at: now, history_compression: null })
    .eq("id", tid);
  if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });

  return NextResponse.json({ ok: true, deletedMessageIds: ids, updatedAt: now });
}
