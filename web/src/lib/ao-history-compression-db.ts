import type { Thread } from "@/lib/ao-state";

export type DbHistoryCompressionJson = {
  from_message_id?: string;
  summary?: string;
  fromMessageId?: string;
} | null;

/** DB jsonb → クライアント Thread.historyCompression */
export function historyCompressionFromDbJson(
  raw: unknown,
): Thread["historyCompression"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as NonNullable<DbHistoryCompressionJson>;
  const fromMessageId =
    (typeof o.from_message_id === "string" && o.from_message_id.trim()) ||
    (typeof o.fromMessageId === "string" && o.fromMessageId.trim()) ||
    "";
  const summary = typeof o.summary === "string" ? o.summary : "";
  if (!fromMessageId || !summary) return undefined;
  return { fromMessageId, summary };
}

/** クライアント → DB 保存用 */
export function historyCompressionToDbJson(
  hc: Thread["historyCompression"] | null | undefined,
): DbHistoryCompressionJson {
  if (!hc?.fromMessageId?.trim() || !hc.summary) return null;
  return {
    from_message_id: hc.fromMessageId.trim(),
    summary: hc.summary,
  };
}

export function pinnedThreadIdsFromDbJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}
