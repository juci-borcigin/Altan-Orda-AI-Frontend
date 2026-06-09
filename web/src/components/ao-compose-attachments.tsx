"use client";

import { useEffect, useState } from "react";
import type { AoMsgAttachment } from "@/lib/ao-attachments";
import {
  AO_ATTACHMENT_MAX_COUNT,
  attachmentBadgeLabel,
  isImageAttachmentContentType,
} from "@/lib/ao-attachments";
import { normalizeAttachmentFile } from "@/lib/ao-attachment-client";

async function fetchSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const res = await fetch("/api/attachments/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { signedUrl?: string };
    return typeof data.signedUrl === "string" ? data.signedUrl : null;
  } catch {
    return null;
  }
}

function AoAttachmentBadge({ att }: { att: AoMsgAttachment }) {
  const label = attachmentBadgeLabel(att) ?? ".FILE";
  return (
    <span
      className="inline-flex h-10 min-w-10 items-center justify-center rounded border border-[#6A3F0A]/30 bg-[#f5e6c8]/80 px-1 font-serif text-[11px] font-bold leading-none text-[#6A3F0A]"
      title={att.fileName ?? label}
    >
      {label}
    </span>
  );
}

function AoAttachmentThumb({ att }: { att: AoMsgAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchSignedUrl(att.storagePath).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [att.storagePath]);

  if (!url) {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-[#6A3F0A]/30 bg-[#f5e6c8]/60 text-[9px] text-[#6A3F0A]/70">
        …
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={att.fileName ?? "添付画像"}
      className="h-10 w-10 rounded border border-[#6A3F0A]/30 object-cover"
    />
  );
}

function AoAttachmentPreview({ att }: { att: AoMsgAttachment }) {
  if (isImageAttachmentContentType(att.contentType)) {
    return <AoAttachmentThumb att={att} />;
  }
  return <AoAttachmentBadge att={att} />;
}

type AoComposeAttachmentsProps = {
  pending: AoMsgAttachment[];
  onRemove: (storagePath: string) => void;
  className?: string;
};

export function AoComposeAttachments({ pending, onRemove, className }: AoComposeAttachmentsProps) {
  if (pending.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {pending.map((att) => (
        <div key={att.storagePath} className="relative">
          <AoAttachmentPreview att={att} />
          <button
            type="button"
            aria-label="添付を削除"
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#3d2810] text-[9px] leading-none text-[#f5e6c8]"
            onClick={() => onRemove(att.storagePath)}
          >
            ×
          </button>
        </div>
      ))}
      <span className="text-[10px] text-[#6A3F0A]/70">
        {pending.length}/{AO_ATTACHMENT_MAX_COUNT}
      </span>
    </div>
  );
}

export function AoMessageAttachments({ attachments }: { attachments: AoMsgAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {attachments.map((att) => (
        <AoAttachmentPreview key={att.storagePath} att={att} />
      ))}
    </div>
  );
}

export async function uploadChatAttachment(
  file: File,
  clientThreadId: string,
): Promise<AoMsgAttachment> {
  const normalized = await normalizeAttachmentFile(file);
  if (!normalized) throw new Error("unsupported file type");

  const form = new FormData();
  form.set("file", normalized);
  form.set("clientThreadId", clientThreadId);
  const res = await fetch("/api/attachments/upload", { method: "POST", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "upload failed");
  }
  const data = (await res.json()) as { attachment?: AoMsgAttachment };
  if (!data.attachment?.storagePath) throw new Error("upload failed");
  return data.attachment;
}
