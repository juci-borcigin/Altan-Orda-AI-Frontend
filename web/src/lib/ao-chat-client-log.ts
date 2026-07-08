/** チャット UI とブラウザコンソールへ同時に出すクライアント側ログ */

export type AoChatClientLogLevel = "error" | "warn" | "info";

export type AoChatClientLogEntry = {
  at: number;
  level: AoChatClientLogLevel;
  message: string;
  detail?: string;
};

const MAX_CHAT_LOG_ENTRIES = 40;

export function aoChatLogEntriesForThread(
  entries: AoChatClientLogEntry[] | undefined,
): AoChatClientLogEntry[] {
  return entries ?? [];
}

export function appendAoChatClientLog(
  prev: AoChatClientLogEntry[] | undefined,
  level: AoChatClientLogLevel,
  message: string,
  detail?: string,
): AoChatClientLogEntry[] {
  const next: AoChatClientLogEntry = {
    at: Date.now(),
    level,
    message,
    ...(detail?.trim() ? { detail: detail.trim() } : {}),
  };
  const merged = [...(prev ?? []), next];
  return merged.length > MAX_CHAT_LOG_ENTRIES
    ? merged.slice(merged.length - MAX_CHAT_LOG_ENTRIES)
    : merged;
}

export function reportAoChatClientLog(
  level: AoChatClientLogLevel,
  message: string,
  detail?: string,
  cause?: unknown,
): void {
  const line = detail?.trim() ? `${message} — ${detail}` : message;
  if (level === "error") console.error("[ao/chat]", line, cause ?? "");
  else if (level === "warn") console.warn("[ao/chat]", line, cause ?? "");
  else console.info("[ao/chat]", line);
}
