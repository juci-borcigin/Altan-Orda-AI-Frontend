/** Supabase Storage バケット（非公開・サーバー経由のみ） */
export const AO_ATTACHMENT_BUCKET = "ao-chat-attachments";

/** プレーンテキストを LLM 本文へインラインする上限（超過時は signed URL のみ） */
export const AO_ATTACHMENT_INLINE_TEXT_MAX_BYTES = 512 * 1024;

function envPositiveInt(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** 1ファイル上限（バイト）。`AO_ATTACHMENT_MAX_MB` 優先。`AO_ATTACHMENT_MAX_BYTES` は 1024 未満なら MB 扱い。 */
export function resolveAttachmentMaxBytes(): number {
  const mbEnv = envPositiveInt("AO_ATTACHMENT_MAX_MB");
  if (mbEnv != null) return mbEnv * 1024 * 1024;

  const bytesEnv = envPositiveInt("AO_ATTACHMENT_MAX_BYTES");
  if (bytesEnv != null) {
    if (bytesEnv < 1024) return bytesEnv * 1024 * 1024;
    return bytesEnv;
  }
  return 4 * 1024 * 1024;
}

/**
 * 1ファイル上限（アプリ側）。
 * - Supabase Storage バケット側にも file_size_limit がある（より厳しい方が適用される）
 * - 既定は 4MB（027 と一致）
 */
export const AO_ATTACHMENT_MAX_BYTES = resolveAttachmentMaxBytes();
export const AO_ATTACHMENT_MAX_COUNT = 4;

export const AO_ATTACHMENT_ALLOWED_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
]);

const EXT_TO_MIME: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

export type AoMsgAttachment = {
  storagePath: string;
  contentType: string;
  fileName?: string;
  sizeBytes?: number;
};

export function isAllowedAttachmentContentType(contentType: string): boolean {
  return AO_ATTACHMENT_ALLOWED_TYPES.has(contentType.trim().toLowerCase());
}

export function extensionFromFileName(fileName: string | undefined): string | null {
  const base = fileName?.trim();
  if (!base) return null;
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
}

export function resolveAttachmentContentType(file: Pick<File, "name" | "type">): string | null {
  const fromType = (file.type || "").trim().toLowerCase();
  if (fromType && isAllowedAttachmentContentType(fromType)) return fromType;
  const ext = extensionFromFileName(file.name);
  if (!ext) return null;
  const mime = EXT_TO_MIME[ext];
  return mime && isAllowedAttachmentContentType(mime) ? mime : null;
}

export function attachmentExtForContentType(contentType: string): string | null {
  switch (contentType.trim().toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "application/pdf":
      return "pdf";
    case "text/plain":
      return "txt";
    case "text/markdown":
      return "md";
    case "text/csv":
      return "csv";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    case "application/vnd.ms-excel":
      return "xls";
    default:
      return null;
  }
}

export function isImageAttachmentContentType(contentType: string): boolean {
  const t = contentType.trim().toLowerCase();
  return (
    t === "image/jpeg" ||
    t === "image/png" ||
    t === "image/webp" ||
    t === "image/gif"
  );
}

export function isPlainTextAttachmentContentType(contentType: string): boolean {
  const t = contentType.trim().toLowerCase();
  if (t.startsWith("text/")) return true;
  return t === "text/plain" || t === "text/markdown" || t === "text/csv";
}

/** UI 用バッジ（.PDF / .DOC 等）。画像は null（サムネ表示） */
export function attachmentBadgeLabel(att: Pick<AoMsgAttachment, "contentType" | "fileName">): string | null {
  if (isImageAttachmentContentType(att.contentType)) return null;
  const ext = attachmentExtForContentType(att.contentType);
  if (ext) return `.${ext.toUpperCase()}`;
  const fromName = extensionFromFileName(att.fileName);
  if (fromName) return `.${fromName.toUpperCase()}`;
  const tail = att.contentType.split("/")[1]?.split("+")[0]?.toUpperCase();
  return tail ? `.${tail}` : ".FILE";
}

/** `<input accept>` 用 */
export const AO_ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,text/plain,text/markdown,text/csv,.md,.csv,.txt,.pdf,.doc,.docx,.xls,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.ms-excel";

/** Storage パス用（英数字・ハイフン・アンダースコアのみ） */
export function sanitizeAttachmentThreadKey(raw: string): string {
  const t = raw.trim().slice(0, 96);
  const safe = t.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return safe.length ? safe : "ephemeral";
}
