import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMessagesFromDbRows, type DbMessageRow } from "@/lib/ao-supabase-thread-map";

const DEFAULT_MAX_CHARS = 14_000;

/**
 * ピンされた議事の全文をシステム注入用ブロックへ（明示参照）。
 */
export async function buildPinnedThreadsInjectionBlock(
  supa: SupabaseClient,
  pinnedThreadIds: readonly string[],
  maxChars = DEFAULT_MAX_CHARS,
): Promise<string> {
  const ids = [...new Set(pinnedThreadIds.map((x) => x.trim()).filter(Boolean))].slice(0, 5);
  if (!ids.length) return "";

  const blocks: string[] = [];
  for (const tid of ids) {
    const { data: tr } = await supa
      .from("ao_threads")
      .select("title, source_provider")
      .eq("id", tid)
      .maybeSingle();
    if (!tr) continue;

    const { data: msgRows } = await supa
      .from("ao_messages")
      .select("id, thread_id, role, text, persona, created_at")
      .eq("thread_id", tid)
      .order("created_at", { ascending: true });
    if (!msgRows?.length) continue;

    const sp = typeof tr.source_provider === "string" ? tr.source_provider : null;
    const msgs = buildMessagesFromDbRows((msgRows ?? []) as DbMessageRow[], sp);
    const title = typeof tr.title === "string" && tr.title.trim() ? tr.title.trim() : "（無題）";
    const body = msgs
      .map((m) => {
        const who = m.side === "user" ? "殿下" : m.speaker;
        return `${who}: ${(m.text ?? "").trim()}`;
      })
      .filter((line) => line.length > 3)
      .join("\n\n");
    if (!body.trim()) continue;
    blocks.push(`## 参照議事「${title}」\n${body}`);
  }

  let joined = blocks.join("\n\n---\n\n");
  if (joined.length > maxChars) {
    joined = `${joined.slice(0, maxChars)}\n\n（参照議事ブロックは長さのため省略）`;
  }
  return joined;
}
