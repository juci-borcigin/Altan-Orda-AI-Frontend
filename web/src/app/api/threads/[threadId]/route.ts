import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { pinnedThreadIdsFromDbJson } from "@/lib/ao-history-compression-db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteCtx = { params: Promise<{ threadId: string }> };

/**
 * 議事（ao_threads）削除。messages / embeddings は DB cascade。
 * DELETE /api/threads/{supabase_thread_uuid}
 *
 * PATCH body: { pinnedThreadIds?: string[] }
 */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { threadId } = await ctx.params;
  const id = decodeURIComponent(threadId ?? "").trim();
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
  }

  let body: { pinnedThreadIds?: unknown };
  try {
    body = (await req.json()) as { pinnedThreadIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pinnedThreadIds = pinnedThreadIdsFromDbJson(body.pinnedThreadIds);
  const filtered = pinnedThreadIds.filter((x) => UUID_RE.test(x) && x !== id).slice(0, 8);

  const { data: row, error: fetchErr } = await supa
    .from("ao_threads")
    .select("id, source_provider")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "thread not found" }, { status: 404 });

  const provider = (row.source_provider as string | null)?.trim().toLowerCase() ?? "";
  if (provider && provider !== "ao") {
    return NextResponse.json({ error: "imported threads cannot be patched via API" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supa
    .from("ao_threads")
    .update({ pinned_thread_ids: filtered, updated_at: now })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, pinnedThreadIds: filtered, updatedAt: now });
}

/**
 * 議事（ao_threads）削除。messages / embeddings は DB cascade。
 * DELETE /api/threads/{supabase_thread_uuid}
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { threadId } = await ctx.params;
  const id = decodeURIComponent(threadId ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "threadId is required" }, { status: 400 });
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supa
    .from("ao_threads")
    .select("id, source_provider")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "thread not found" }, { status: 404 });
  }

  const provider = (row.source_provider as string | null)?.trim().toLowerCase() ?? "";
  if (provider && provider !== "ao") {
    return NextResponse.json(
      { error: "imported threads cannot be deleted via API" },
      { status: 403 },
    );
  }

  const { error: delErr } = await supa.from("ao_threads").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
