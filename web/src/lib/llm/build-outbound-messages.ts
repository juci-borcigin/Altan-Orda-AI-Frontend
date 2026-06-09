import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AO_ATTACHMENT_BUCKET,
  AO_ATTACHMENT_INLINE_TEXT_MAX_BYTES,
  isImageAttachmentContentType,
  isPlainTextAttachmentContentType,
  type AoMsgAttachment,
} from "@/lib/ao-attachments";
import type { ChatContentPart, OutboundChatMessage } from "@/lib/llm/types";

export type InboundChatMsg = {
  role: "user" | "assistant";
  content: string;
  attachments?: AoMsgAttachment[];
};

const SIGNED_URL_TTL_SEC = 3600;

/** 直前ターンの添付を再参照する意図（方針 B） */
const PRIOR_ATTACHMENT_REF =
  /添付|ファイル|画像|さきほど|以前|再度|もう一度|再読|読んで|OCR|中身/i;

async function signAttachmentUrl(
  supa: SupabaseClient,
  storagePath: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const key = storagePath.trim();
  if (!key) return null;
  const hit = cache.get(key);
  if (hit) return hit;
  const { data, error } = await supa.storage
    .from(AO_ATTACHMENT_BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    console.error("[llm] attachment signed url:", error?.message ?? storagePath);
    return null;
  }
  cache.set(key, data.signedUrl);
  return data.signedUrl;
}

async function downloadAttachmentText(
  supa: SupabaseClient,
  storagePath: string,
  maxBytes: number,
): Promise<string | null> {
  const { data, error } = await supa.storage.from(AO_ATTACHMENT_BUCKET).download(storagePath);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.length > maxBytes) return null;
  return buf.toString("utf-8");
}

function attachmentDisplayName(att: AoMsgAttachment): string {
  return att.fileName?.trim() || att.storagePath.split("/").pop() || "file";
}

function formatAttachmentSize(sizeBytes?: number): string {
  if (sizeBytes == null || sizeBytes <= 0) return "";
  const mb = sizeBytes / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(1)}MB`;
  return `${Math.max(1, Math.round(sizeBytes / 1024))}KB`;
}

function referencesPriorAttachment(text: string): boolean {
  return PRIOR_ATTACHMENT_REF.test(text.trim());
}

/** 直近 user turn に載せる attachments（新規添付 or 方針 B で過去参照） */
function resolveOutboundAttachments(
  trimmed: InboundChatMsg[],
  index: number,
  lastUserIdx: number,
): AoMsgAttachment[] {
  if (index !== lastUserIdx) return [];
  const current = trimmed[lastUserIdx]!;
  if (current.attachments?.length) return current.attachments;
  if (!referencesPriorAttachment(current.content)) return [];
  for (let j = lastUserIdx - 1; j >= 0; j--) {
    const prior = trimmed[j];
    if (prior?.role === "user" && prior.attachments?.length) {
      return prior.attachments;
    }
  }
  return [];
}

async function buildUserContent(
  supa: SupabaseClient | null,
  text: string,
  attachments: AoMsgAttachment[],
  signCache: Map<string, string>,
): Promise<string | ChatContentPart[]> {
  const parts: ChatContentPart[] = [];
  const textBlocks: string[] = [];
  const trimmed = text.trim();
  if (trimmed) textBlocks.push(trimmed);

  for (const att of attachments) {
    const name = attachmentDisplayName(att);
    const signed =
      supa != null ? await signAttachmentUrl(supa, att.storagePath, signCache) : null;

    if (isImageAttachmentContentType(att.contentType) && signed) {
      parts.push({ type: "image_url", image_url: { url: signed } });
      continue;
    }

    if (isPlainTextAttachmentContentType(att.contentType) && supa) {
      const inline = await downloadAttachmentText(
        supa,
        att.storagePath,
        AO_ATTACHMENT_INLINE_TEXT_MAX_BYTES,
      );
      if (inline != null) {
        textBlocks.push(`[添付ファイル: ${name}]\n${inline}`);
        continue;
      }
    }

    const size = formatAttachmentSize(att.sizeBytes);
    const meta = size ? `${att.contentType}, ${size}` : att.contentType;
    const block = signed
      ? `[添付ファイル: ${name} (${meta})]\n${signed}`
      : `[添付ファイル: ${name} (${meta})]`;
    textBlocks.push(block);
  }

  const combined = textBlocks.join("\n\n");
  if (parts.length === 0) return combined || "(添付のみ)";
  if (combined) parts.unshift({ type: "text", text: combined });
  if (parts.length === 1 && parts[0]!.type === "text") return parts[0]!.text;
  return parts;
}

/**
 * 履歴はテキストのみ。直近 user turn のみ multimodal / 添付本文を付与。
 * 添付なしで参照意図がある場合は方針 B（直前の添付付き user 行を sign）。
 */
export async function buildOutboundChatMessages(
  supa: SupabaseClient | null,
  system: string,
  trimmed: InboundChatMsg[],
): Promise<OutboundChatMessage[]> {
  const out: OutboundChatMessage[] = [{ role: "system", content: system }];
  let lastUserIdx = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i]!.role === "user") lastUserIdx = i;
  }

  const signCache = new Map<string, string>();

  for (let i = 0; i < trimmed.length; i++) {
    const m = trimmed[i]!;
    if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.content });
      continue;
    }
    const attachments = resolveOutboundAttachments(trimmed, i, lastUserIdx);
    if (attachments.length) {
      if (!supa) {
        console.error("[llm] attachments present but Supabase admin is unavailable; files omitted");
      }
      if (attachments.length && !supa) {
        out.push({ role: "user", content: m.content || "(添付)" });
        continue;
      }
      out.push({
        role: "user",
        content: await buildUserContent(supa, m.content, attachments, signCache),
      });
    } else {
      out.push({ role: "user", content: m.content });
    }
  }
  return out;
}

export function serializeOutboundChatMessages(messages: OutboundChatMessage[]): string {
  try {
    return JSON.stringify(messages, null, 2);
  } catch {
    return "[serialize error]";
  }
}
