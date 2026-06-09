import { NextResponse } from "next/server";
import { AO_ATTACHMENT_BUCKET } from "@/lib/ao-attachments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const SIGNED_URL_TTL_SEC = 3600;

export async function POST(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  let body: { storagePath?: string };
  try {
    body = (await req.json()) as { storagePath?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storagePath = String(body.storagePath ?? "").trim();
  if (!storagePath.startsWith("chat/")) {
    return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
  }

  const { data, error } = await supa.storage
    .from(AO_ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    console.error("[attachments/signed-url]", error?.message ?? storagePath);
    return NextResponse.json({ error: "Signed URL failed" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, expiresIn: SIGNED_URL_TTL_SEC });
}
