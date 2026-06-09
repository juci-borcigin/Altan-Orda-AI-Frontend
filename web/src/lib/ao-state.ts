import type { AoMsgAttachment } from "@/lib/ao-attachments";
import type { ProjectId } from "@/lib/ao-types";
import { aoClampStoredTitleByUnits } from "@/lib/ao-title-width";

/** アプリの表示バージョン（package.json と揃える） */
export const AO_APP_VERSION = "0.1.0";

export type MsgMetaKind = "openai_assistant_raw";

/** 1回のチャット応答に対する使用量（複数チャンクへコピー） */
export type MsgTurnUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number | null;
  modelId: string;
  /** 実際に叩いた経路（openrouter / google / anthropic / openai など） */
  provider?: string;
  /** API に送った model 名（直結時は vendor プレフィックス無しの場合がある） */
  apiModel?: string;
};

/** /api/chat が返す LLM 往復全文（Supabase assistant 先頭行にも保存） */
export type MsgRawPromptBundle = {
  sent: string;
  received: string;
};

/** RAG 注入のメタ（Raw チップ要約用） */
export type MsgRagMeta = {
  isFirstUserTurn: boolean;
  hitCount: number;
  topSimilarity: number | null;
  injected: boolean;
  matchThreshold: number;
};

/** `/api/chat` が返す completion メタ（ログ・Raw 表示用。ライブ応答以外では省略されうる） */
export type MsgChatCompletionMeta = {
  finishReason: string | null;
  nativeFinishReason: string | null;
  emptyAssistantFallback: boolean;
  formatRetriesUsed: number;
  webSearchInvocations: number;
  webSearchSkippedByLimit: number;
  webSearchMaxPerRound: number;
  rag?: MsgRagMeta;
};

export type Msg = {
  id: string;
  side: "user" | "ai";
  speaker: string;
  text: string;
  /** ユーザー投稿の添付画像（Storage パス。表示は signed URL） */
  attachments?: AoMsgAttachment[];
  createdAt: number;
  /** true のときバックアップには含めるが議事 UI には出さない */
  hiddenFromUi?: boolean;
  /** 非表示メッセージの種別（将来の思考ブロック等の拡張用） */
  metaKind?: MsgMetaKind;
  /** 直近 completion のトークン／概算 USD（AI 行に付与。送信直後のユーザー行にも同一ターンで複製） */
  usage?: MsgTurnUsage;
  /** LLM 往復 Raw（AI／その直前のユーザー行に同一ターンで保持） */
  rawPrompts?: MsgRawPromptBundle;
  /** finish_reason 等（同一ターンの AI 行・直前ユーザー行に複製可） */
  completionMeta?: MsgChatCompletionMeta;
};

export type Thread = {
  id: string;
  projectId: ProjectId;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Msg[];
  /** Supabase `ao_threads.id`（uuid）。未同期の議事では未設定 */
  supabaseThreadId?: string;
  /** Supabase `ao_threads.source_provider`（取り込み元）。AO ネイティブ議事では未設定 */
  sourceProvider?: string;
  /** 「新規」直後・初回送信前のみ true。論を変えた／別議事を選んだときに破棄される */
  ephemeral?: boolean;
  /** サーバーから messages を遅延取得済みか（空スレも true になり得る） */
  serverMessagesLoaded?: boolean;
  /** 履歴要約キャッシュ（Supabase 外・localStorage と同期） */
  historyCompression?: {
    fromMessageId: string;
    summary: string;
  };
};

export type AppState = {
  version: 1;
  currentProjectId: ProjectId;
  currentThreadId: string;
  threads: Thread[];
};

const PROJECT_IDS: ProjectId[] = [
  "debate",
  "chat",
  "plan",
  "work",
  "mental",
  "notebook",
  "foreign",
  "gemini",
  "chatgpt",
  "claude",
];

/** localStorage / 旧バックアップの projectId を現行へ */
const LEGACY_PROJECT_ID: Record<string, ProjectId> = {
  shitsumu: "plan",
  gungi: "work",
  nesho: "mental",
  kurultai: "debate",
  koukan: "chat",
  talk: "chat",
  study: "notebook",
};

function isProjectId(x: unknown): x is ProjectId {
  return typeof x === "string" && (PROJECT_IDS as string[]).includes(x);
}

function migrateProjectIdString(raw: string): ProjectId {
  if (isProjectId(raw)) return raw;
  return LEGACY_PROJECT_ID[raw] ?? "work";
}

function clampThreadTitleForMigrate(raw: unknown): void {
  if (typeof raw !== "object" || raw == null) return;
  const th = raw as Record<string, unknown>;
  if (typeof th.title !== "string") return;
  const t = th.title.trim();
  if (!t) {
    th.title = "";
    return;
  }
  th.title = aoClampStoredTitleByUnits(t);
}

function migrateAppStateShape(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const o = data as Record<string, unknown>;

  if (o.schema === "altan-orda-backup-v1" && o.state !== undefined) {
    return { ...o, state: migrateAppStateShape(o.state) };
  }

  if (typeof o.currentProjectId === "string") {
    o.currentProjectId = migrateProjectIdString(o.currentProjectId);
  }
  if (Array.isArray(o.threads)) {
    o.threads = o.threads.map((t) => {
      if (!t || typeof t !== "object") return t;
      const th = { ...(t as Record<string, unknown>) };
      if (typeof th.projectId === "string") {
        th.projectId = migrateProjectIdString(th.projectId);
      }
      clampThreadTitleForMigrate(th);
      return th;
    });
  }
  return data;
}

function isMsg(x: unknown): x is Msg {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    (o.side !== "user" && o.side !== "ai") ||
    typeof o.speaker !== "string" ||
    typeof o.text !== "string" ||
    typeof o.createdAt !== "number"
  ) {
    return false;
  }
  if (o.hiddenFromUi !== undefined && typeof o.hiddenFromUi !== "boolean") {
    return false;
  }
  if (o.metaKind !== undefined && typeof o.metaKind !== "string") {
    return false;
  }
  if (o.usage !== undefined && o.usage !== null && typeof o.usage !== "object") {
    return false;
  }
  if (o.rawPrompts !== undefined && o.rawPrompts !== null) {
    if (typeof o.rawPrompts !== "object") return false;
    const rp = o.rawPrompts as Record<string, unknown>;
    if (typeof rp.sent !== "string" || typeof rp.received !== "string") return false;
  }
  if (o.completionMeta !== undefined && o.completionMeta !== null) {
    if (typeof o.completionMeta !== "object") return false;
    const cm = o.completionMeta as Record<string, unknown>;
    if (cm.finishReason !== null && typeof cm.finishReason !== "string") return false;
    if (
      cm.nativeFinishReason !== undefined &&
      cm.nativeFinishReason !== null &&
      typeof cm.nativeFinishReason !== "string"
    ) {
      return false;
    }
    if (typeof cm.emptyAssistantFallback !== "boolean") return false;
    if (typeof cm.formatRetriesUsed !== "number" || !Number.isFinite(cm.formatRetriesUsed)) return false;
    if (typeof cm.webSearchInvocations !== "number" || !Number.isFinite(cm.webSearchInvocations)) return false;
    if (typeof cm.webSearchSkippedByLimit !== "number" || !Number.isFinite(cm.webSearchSkippedByLimit)) {
      return false;
    }
    if (typeof cm.webSearchMaxPerRound !== "number" || !Number.isFinite(cm.webSearchMaxPerRound)) return false;
  }
  return true;
}

function isThread(x: unknown): x is Thread {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    !isProjectId(o.projectId) ||
    typeof o.title !== "string" ||
    typeof o.createdAt !== "number" ||
    typeof o.updatedAt !== "number" ||
    !Array.isArray(o.messages)
  ) {
    return false;
  }
  if (o.supabaseThreadId !== undefined && typeof o.supabaseThreadId !== "string") {
    return false;
  }
  if (o.serverMessagesLoaded !== undefined && typeof o.serverMessagesLoaded !== "boolean") {
    return false;
  }
  if (o.sourceProvider !== undefined && typeof o.sourceProvider !== "string") {
    return false;
  }
  if (o.ephemeral !== undefined && typeof o.ephemeral !== "boolean") {
    return false;
  }
  return o.messages.every(isMsg);
}

export function isAppStateCore(x: unknown): x is AppState {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (!isProjectId(o.currentProjectId)) return false;
  if (typeof o.currentThreadId !== "string") return false;
  if (!Array.isArray(o.threads) || o.threads.length === 0) return false;
  if (!o.threads.every(isThread)) return false;
  if (!o.threads.some((t) => t.id === o.currentThreadId)) return false;
  return true;
}

function msgRejectReason(m: unknown, path: string): string | null {
  if (!m || typeof m !== "object") return `${path}: メッセージがオブジェクトではありません`;
  const o = m as Record<string, unknown>;
  if (typeof o.id !== "string") return `${path}: id が string ではありません`;
  if (o.side !== "user" && o.side !== "ai") return `${path}: side が user/ai ではありません`;
  if (typeof o.speaker !== "string") return `${path}: speaker が string ではありません`;
  if (typeof o.text !== "string") return `${path}: text が string ではありません（null の可能性）`;
  if (typeof o.createdAt !== "number" || !Number.isFinite(o.createdAt)) {
    return `${path}: createdAt が有限の number ではありません（JSON 経由の null/NaN 疑い）`;
  }
  if (o.hiddenFromUi !== undefined && typeof o.hiddenFromUi !== "boolean") {
    return `${path}: hiddenFromUi が boolean ではありません`;
  }
  if (o.metaKind !== undefined && typeof o.metaKind !== "string") {
    return `${path}: metaKind が string ではありません`;
  }
  if (o.rawPrompts !== undefined && o.rawPrompts !== null) {
    if (typeof o.rawPrompts !== "object") return `${path}: rawPrompts が object ではありません`;
    const rp = o.rawPrompts as Record<string, unknown>;
    if (typeof rp.sent !== "string") return `${path}: rawPrompts.sent が string ではありません`;
    if (typeof rp.received !== "string") return `${path}: rawPrompts.received が string ではありません`;
  }
  if (o.completionMeta !== undefined && o.completionMeta !== null) {
    if (typeof o.completionMeta !== "object") return `${path}: completionMeta が object ではありません`;
  }
  return null;
}

function threadRejectReason(t: unknown, idx: number): string | null {
  const path = `threads[${idx}]`;
  if (!t || typeof t !== "object") return `${path}: スレッドがオブジェクトではありません`;
  const o = t as Record<string, unknown>;
  if (typeof o.id !== "string") return `${path}: id が string ではありません`;
  if (!isProjectId(o.projectId)) return `${path}: projectId が AO の ProjectId ではありません (${String(o.projectId)})`;
  if (typeof o.title !== "string") return `${path}: title が string ではありません`;
  if (typeof o.createdAt !== "number" || !Number.isFinite(o.createdAt)) {
    return `${path}: createdAt が有限の number ではありません`;
  }
  if (typeof o.updatedAt !== "number" || !Number.isFinite(o.updatedAt)) {
    return `${path}: updatedAt が有限の number ではありません`;
  }
  if (o.serverMessagesLoaded !== undefined && typeof o.serverMessagesLoaded !== "boolean") {
    return `${path}: serverMessagesLoaded が boolean ではありません`;
  }
  if (!Array.isArray(o.messages)) return `${path}: messages が配列ではありません`;
  if (o.supabaseThreadId !== undefined && typeof o.supabaseThreadId !== "string") {
    return `${path}: supabaseThreadId が string ではありません`;
  }
  if (o.sourceProvider !== undefined && typeof o.sourceProvider !== "string") {
    return `${path}: sourceProvider が string ではありません`;
  }
  if (o.ephemeral !== undefined && typeof o.ephemeral !== "boolean") {
    return `${path}: ephemeral が boolean ではありません`;
  }
  const msgs = o.messages as unknown[];
  for (let j = 0; j < msgs.length; j++) {
    const r = msgRejectReason(msgs[j], `${path}.messages[${j}]`);
    if (r) return r;
  }
  return null;
}

/**
 * `isAppStateCore` が偽になるとき、最初に引っかかった理由（デバッグ用）。
 * 通過時は null。
 */
export function describeAppStateCoreRejection(x: unknown): string | null {
  if (isAppStateCore(x)) return null;
  if (!x || typeof x !== "object") return "ルートがオブジェクトではありません";
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return `version が 1 ではありません (${String(o.version)})`;
  if (!isProjectId(o.currentProjectId)) {
    return `currentProjectId が不正です (${String(o.currentProjectId)})`;
  }
  if (typeof o.currentThreadId !== "string") return "currentThreadId が string ではありません";
  if (!Array.isArray(o.threads)) return "threads が配列ではありません";
  if (o.threads.length === 0) return "threads が空です";
  const threads = o.threads as unknown[];
  for (let i = 0; i < threads.length; i++) {
    const r = threadRejectReason(threads[i], i);
    if (r) return r;
  }
  const cur = o.currentThreadId as string;
  if (!threads.some((t) => (t as { id?: string }).id === cur)) {
    return `currentThreadId (${cur}) が threads[].id のいずれにも一致しません`;
  }
  return "isAppStateCore 失敗（理由特定外。型拡張時に describe を追記してください）";
}

/** ファイルまたは localStorage から読んだ JSON を検証 */
/** 送信前に破棄したいプレースホルダー議事を除去し、`currentThreadId` を整合させる */
export function pruneEphemeralEmptyThreads(state: AppState): AppState {
  const kept = state.threads.filter((t) => !(t.ephemeral && t.messages.length === 0));
  if (kept.length === state.threads.length) return state;
  if (kept.length === 0) return state;
  let currentThreadId = state.currentThreadId;
  if (!kept.some((t) => t.id === currentThreadId)) {
    const fb = kept[0];
    currentThreadId = fb?.id ?? currentThreadId;
  }
  const cur = kept.find((t) => t.id === currentThreadId);
  return {
    ...state,
    threads: kept,
    currentThreadId,
    currentProjectId: cur?.projectId ?? state.currentProjectId,
  };
}

export function parseAppStateJson(raw: string): AppState | null {
  try {
    const data = JSON.parse(raw) as unknown;
    const migrated = migrateAppStateShape(data);
    if (isAppStateCore(migrated)) return migrated;
    if (migrated && typeof migrated === "object") {
      const o = migrated as Record<string, unknown>;
      if (o.schema === "altan-orda-backup-v1" && o.state !== undefined) {
        if (isAppStateCore(o.state)) return o.state;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export type BackupEnvelope = {
  schema: "altan-orda-backup-v1";
  exportedAt: string;
  app: string;
  version: 1;
  /** ビルド／アプリ版（運用用メタデータ） */
  appVersion?: string;
  /** 書き出し経路 */
  syncSource?: "manual" | "drive";
  state: AppState;
};

export function buildBackupPayload(
  state: AppState,
  options?: { syncSource?: BackupEnvelope["syncSource"] },
): string {
  const envelope: BackupEnvelope = {
    schema: "altan-orda-backup-v1",
    exportedAt: new Date().toISOString(),
    app: "Altan Orda AI",
    version: 1,
    appVersion: AO_APP_VERSION,
    syncSource: options?.syncSource ?? "manual",
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

/** 全会話スナップショット用（ローカル DL） */
export function buildFullBackupFileName(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `altan-orda-backup-${stamp}.json`;
}

export function downloadBackupFile(state: AppState): void {
  const json = buildBackupPayload(state);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildFullBackupFileName();
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** localStorage 用の初期議事（page.tsx と GET /api/state の空DB時のフォールバックで共通） */
export function aoUid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function makeDefaultAppState(): AppState {
  const now = Date.now();
  const t0: Thread = {
    id: aoUid("th"),
    projectId: "work",
    title: "",
    createdAt: now,
    updatedAt: now,
    messages: [],
    sourceProvider: "ao",
  };

  return {
    version: 1,
    currentProjectId: "work",
    currentThreadId: t0.id,
    threads: [t0],
  };
}
