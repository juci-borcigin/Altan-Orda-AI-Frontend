import type { ProjectId } from "@/lib/ao-types";

/** アプリの表示バージョン（package.json と揃える） */
export const AO_APP_VERSION = "0.1.0";

export type MsgMetaKind = "openai_assistant_raw";

export type Msg = {
  id: string;
  side: "user" | "ai";
  speaker: string;
  text: string;
  createdAt: number;
  /** true のときバックアップには含めるが議事 UI には出さない */
  hiddenFromUi?: boolean;
  /** 非表示メッセージの種別（将来の思考ブロック等の拡張用） */
  metaKind?: MsgMetaKind;
};

export type Thread = {
  id: string;
  projectId: ProjectId;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Msg[];
};

export type AppState = {
  version: 1;
  currentProjectId: ProjectId;
  currentThreadId: string;
  threads: Thread[];
};

const PROJECT_IDS: ProjectId[] = [
  "shitsumu",
  "gungi",
  "nesho",
  "kurultai",
  "gemini",
  "claude",
];

function isProjectId(x: unknown): x is ProjectId {
  return typeof x === "string" && (PROJECT_IDS as string[]).includes(x);
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
  return o.messages.every(isMsg);
}

function isAppStateCore(x: unknown): x is AppState {
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

/** ファイルまたは localStorage から読んだ JSON を検証 */
export function parseAppStateJson(raw: string): AppState | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (isAppStateCore(data)) return data;
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
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
  /** ビルド／アプリ版（Drive 連携・運用用メタデータ） */
  appVersion?: string;
  /** 書き出し経路 */
  syncSource?: "manual" | "drive";
  state: AppState;
};

/** 1 スレッド＝1 JSON（書庫・Drive 保存用） */
export type ThreadBackupEnvelope = {
  schema: "altan-orda-thread-backup-v1";
  exportedAt: string;
  app: string;
  version: 1;
  appVersion?: string;
  syncSource?: "manual" | "drive";
  thread: Thread;
};

function isThreadBackupEnvelope(x: unknown): x is ThreadBackupEnvelope {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.schema === "altan-orda-thread-backup-v1" &&
    isThread(o.thread)
  );
}

/** Drive 上のファイル名: スレッド ID + タイトル（安全化）。ID で一意。 */
export function buildDriveThreadFileName(thread: Thread): string {
  const safe =
    thread.title
      .replace(/[/\\?%*:|"<>]/g, "_")
      .trim()
      .slice(0, 100) || "untitled";
  return `${thread.id}_${safe}.json`;
}

export function buildThreadBackupPayload(
  thread: Thread,
  options?: { syncSource?: ThreadBackupEnvelope["syncSource"] },
): string {
  const envelope: ThreadBackupEnvelope = {
    schema: "altan-orda-thread-backup-v1",
    exportedAt: new Date().toISOString(),
    app: "Altan Orda AI",
    version: 1,
    appVersion: AO_APP_VERSION,
    syncSource: options?.syncSource ?? "manual",
    thread,
  };
  return JSON.stringify(envelope, null, 2);
}

/** 書庫で読み込んだ JSON から Thread を取り出す */
export function parseThreadBackupJson(raw: string): Thread | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (isThreadBackupEnvelope(data)) return data.thread;
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      if (o.schema === "altan-orda-thread-backup-v1" && o.thread !== undefined) {
        if (isThread(o.thread)) return o.thread;
      }
    }
    return null;
  } catch {
    return null;
  }
}

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

/** 全会話スナップショット用（ローカル DL / Drive 共通） */
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
