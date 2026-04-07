import { NextResponse } from "next/server";
import { getAuthorizedOAuth2Client } from "@/lib/google-auth-session";
import { getDriveFileText } from "@/lib/google-drive-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getAuthorizedOAuth2Client();
  if (!auth) {
    return NextResponse.json(
      { error: "Google Drive に接続されていません。" },
      { status: 401 },
    );
  }
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId")?.trim();
  if (!fileId) {
    return NextResponse.json({ error: "fileId が必要です。" }, { status: 400 });
  }
  try {
    const text = await getDriveFileText(auth, fileId);
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
