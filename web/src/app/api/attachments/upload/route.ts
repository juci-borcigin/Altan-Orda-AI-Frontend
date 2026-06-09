import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  AO_ATTACHMENT_BUCKET,
  AO_ATTACHMENT_MAX_BYTES,
  AO_ATTACHMENT_MAX_COUNT,
  attachmentExtForContentType,
  resolveAttachmentContentType,
  sanitizeAttachmentThreadKey,
  type AoMsgAttachment,
} from "@/lib/ao-attachments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const contentType = resolveAttachmentContentType(file);
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > AO_ATTACHMENT_MAX_BYTES) {
    const maxMb = (AO_ATTACHMENT_MAX_BYTES / (1024 * 1024)).toFixed(1);
    return NextResponse.json({ error: `File too large (max ${maxMb}MB)` }, { status: 400 });
  }

  const ext = attachmentExtForContentType(contentType);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const threadKey = sanitizeAttachmentThreadKey(String(form.get("clientThreadId") ?? "ephemeral"));
  const storagePath = `chat/${threadKey}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await supa.storage.from(AO_ATTACHMENT_BUCKET).upload(storagePath, buf, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.error("[attachments/upload]", error.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const attachment: AoMsgAttachment = {
    storagePath,
    contentType,
    fileName: file.name?.trim() || undefined,
    sizeBytes: file.size,
  };
  return NextResponse.json({ attachment, maxCount: AO_ATTACHMENT_MAX_COUNT });
}
