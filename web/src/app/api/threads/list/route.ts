import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isProjectId, type ProjectId } from "@/lib/ao-types";
import type { DbThreadRow } from "@/lib/ao-supabase-thread-map";

const LIST_CACHE_TTL_MS = 45_000;
const LIST_CACHE_MAX = 64;
type CacheEntry = { expires: number; payload: { threads: DbThreadRow[]; limit: number; offset: number } };
const listCache = new Map<string, CacheEntry>();

function listCacheKey(projectIds: readonly ProjectId[], limit: number, offset: number) {
  return `${[...projectIds].sort().join(",")}|${limit}|${offset}`;
}

function listCacheSet(key: string, payload: CacheEntry["payload"]) {
  if (listCache.size >= LIST_CACHE_MAX) {
    const first = listCache.keys().next().value;
    if (first) listCache.delete(first);
  }
  listCache.set(key, { expires: Date.now() + LIST_CACHE_TTL_MS, payload });
}

/**
 * 議事タイトル一覧のみ（messages は含まない）。論タブごとの軽量同期用。
 * GET /api/threads/list?projects=plan,work&limit=5&offset=0
 * クエリ `bust=1` で短 TTL キャッシュを無視（スレッド選択直後・送信成功後の再取得用）。
 */
export async function GET(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const bust = searchParams.get("bust") === "1";
  const projectsRaw = searchParams.get("projects")?.trim() ?? "";
  const limitRaw = searchParams.get("limit")?.trim() ?? "5";
  const offsetRaw = searchParams.get("offset")?.trim() ?? "0";
  const limit = Math.max(1, Math.min(50, Math.floor(Number(limitRaw)) || 5));
  const offset = Math.max(0, Math.floor(Number(offsetRaw)) || 0);

  const projectIds = projectsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p): p is ProjectId => isProjectId(p));

  if (!projectIds.length) {
    return NextResponse.json(
      { error: "Query `projects` is required (comma-separated project_id, e.g. plan,work)" },
      { status: 400 },
    );
  }

  const ckey = listCacheKey(projectIds, limit, offset);
  if (!bust) {
    const hit = listCache.get(ckey);
    if (hit && hit.expires > Date.now()) {
      return NextResponse.json(hit.payload);
    }
  }

  const { data, error } = await supa
    .from("ao_threads")
    .select("id, client_thread_id, title, project_id, created_at, updated_at, source_provider")
    .in("project_id", projectIds)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = {
    threads: (data ?? []) as DbThreadRow[],
    limit,
    offset,
  };
  if (!bust) listCacheSet(ckey, payload);
  return NextResponse.json(payload);
}
