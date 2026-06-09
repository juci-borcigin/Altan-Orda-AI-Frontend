"use client";

import {
  attachmentExtForContentType,
  extensionFromFileName,
  isAllowedAttachmentContentType,
  resolveAttachmentContentType,
} from "@/lib/ao-attachments";

function pasteFileName(contentType: string): string {
  const ext = attachmentExtForContentType(contentType) ?? "bin";
  return `paste-${Date.now()}.${ext}`;
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const mod = await import("heic2any");
  const heic2any = mod.default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
  const blob = Array.isArray(out) ? out[0]! : out;
  const base = file.name.replace(/\.(heic|heif)$/i, "") || `paste-${Date.now()}`;
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** アップロード前: HEIC→JPEG、空ファイル名の補完、MIME 推定 */
export async function normalizeAttachmentFile(file: File): Promise<File | null> {
  let contentType = resolveAttachmentContentType(file);
  if (!contentType) return null;

  let out = file;
  if (!out.name?.trim()) {
    out = new File([out], pasteFileName(contentType), { type: contentType });
  }

  const ext = extensionFromFileName(out.name);
  if (
    contentType === "image/heic" ||
    contentType === "image/heif" ||
    ext === "heic" ||
    ext === "heif"
  ) {
    try {
      out = await convertHeicToJpeg(out);
      contentType = "image/jpeg";
    } catch (e) {
      console.error("[attach] HEIC convert failed", e);
      return null;
    }
  }

  if (!isAllowedAttachmentContentType(contentType)) return null;
  if (out.type !== contentType) {
    out = new File([out], out.name, { type: contentType });
  }
  return out;
}

/** クリップボード items から最新の file 1 件を取得 */
export function latestClipboardFile(items: DataTransferItemList): File | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item || item.kind !== "file") continue;
    const f = item.getAsFile();
    if (f) return f;
  }
  return null;
}
