import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildMessagesFromDbRows, type DbMessageRow } from "@/lib/ao-supabase-thread-map";

/** UUID（緩い検証。パストラバーサル防止用） */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 単一議事の messages のみ。年代記クリック時の遅延ロード用。
 * GET /api/threads/{supabase_thread_uuid}/messages
 * クエリ `raw=1` で raw_* を含む（Raw オーバーレイ用。既定はスリム SELECT で Egress 削減）。
 */
export async function GET(req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await ctx.params;
  const includeRaw = new URL(req.url).searchParams.get("raw") === "1";
  const tid = decodeURIComponent(threadId).trim();
  if (!UUID_RE.test(tid)) {
    return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: tr, error: e1 } = await supa
    .from("ao_threads")
    .select("id, source_provider")
    .eq("id", tid)
    .maybeSingle();
  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }
  if (!tr) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: msgRows, error: e2 } = includeRaw
    ? await supa
        .from("ao_messages")
        .select(
          "id, thread_id, role, text, persona, created_at, model_id, prompt_tokens, completion_tokens, token_count, usd_estimate, raw_prompt_sent, raw_prompt_received, raw_response",
        )
        .eq("thread_id", tid)
        .order("created_at", { ascending: true })
    : await supa
        .from("ao_messages")
        .select(
          "id, thread_id, role, text, persona, created_at, model_id, prompt_tokens, completion_tokens, token_count, usd_estimate",
        )
        .eq("thread_id", tid)
        .order("created_at", { ascending: true });

  if (e2) {
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  const sp = typeof tr.source_provider === "string" ? tr.source_provider : null;
  const messages = buildMessagesFromDbRows((msgRows ?? []) as DbMessageRow[], sp);

  return NextResponse.json({ messages });
}
