import type { ChatSsePhase } from "@/lib/ao-chat-sse";
import { displayTextForClaudeImportedAssistant } from "@/lib/ao-claude-display-text";
import { aoLlmErrorMessageForDisplay } from "@/lib/ao-llm-error-classify";
import {
  makeDefaultAppState,
  parseAppStateJson,
  type AppState,
  type Msg,
  type MsgTurnUsage,
  type Thread,
} from "@/lib/ao-state";
import { estimateUsdFromTokensClient } from "@/lib/ao-usage-estimate-client";

export const AO_STORAGE_KEY = "ao_state_v1";
let storageWarned = false;

export function aoResolveUsdForOverlay(u: MsgTurnUsage): number | null {
  return u.estimatedUsd ?? estimateUsdFromTokensClient(u.promptTokens, u.completionTokens);
}

export function aoSyntheticMsgTurnUsage(): MsgTurnUsage {
  return {
    modelId: "—",
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedUsd: null,
  };
}

export function aoChatErrorMessageForDisplay(e: unknown): string {
  return aoLlmErrorMessageForDisplay(e);
}

export function aoThinkingStatusForPhase(phase: ChatSsePhase): string | null {
  switch (phase) {
    case "preparing":
      return "準備中…";
    case "compressing_history":
      return "履歴を整理中…";
    case "heartbeat":
      return "応答待ち…";
    default:
      return null;
  }
}

export const AO_POPUP_REWIND_EDIT_FALLBACK =
  "**投稿を巻き戻しますか？**\nこの投稿以降の応答は削除され、編集した内容から会話を再開します。";
export const AO_POPUP_REWIND_DELETE_FALLBACK =
  "**投稿を削除しますか？**\nこの投稿と、それ以降の応答が削除されます。";

const AO_SUPABASE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPersistedAoMessageId(id: string): boolean {
  const base = id.split("#")[0] ?? id;
  return AO_SUPABASE_UUID_RE.test(base);
}

export function msgTextForUi(thread: Thread | null, m: Msg) {
  if (m.side === "user") return m.text;
  return displayTextForClaudeImportedAssistant(thread?.sourceProvider ?? null, "assistant", m.text);
}

export function formatDateDay(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function threadSourceProviderUlusLabel(sourceProvider: string | undefined): string {
  const v = sourceProvider?.trim().toLowerCase() ?? "";
  if (v === "gemini") return "チャガタイ";
  if (v === "chatgpt") return "オゴデイ";
  if (v === "claude") return "ジュチ";
  if (v === "nblm") return "NotebookLM";
  return "";
}

export function loadAoAppState(): AppState {
  if (typeof window === "undefined") return makeDefaultAppState();
  try {
    const raw = localStorage.getItem(AO_STORAGE_KEY);
    if (!raw) return makeDefaultAppState();
    return parseAppStateJson(raw) ?? makeDefaultAppState();
  } catch {
    return makeDefaultAppState();
  }
}

export function saveAoAppState(state: AppState): boolean {
  try {
    localStorage.setItem(AO_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    if (!storageWarned) {
      storageWarned = true;
      console.warn("[ao] localStorage への保存に失敗しました（メモリ上の state は保持）。", e);
    }
    return false;
  }
}
