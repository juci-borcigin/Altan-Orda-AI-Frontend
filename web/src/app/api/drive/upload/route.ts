import { NextResponse } from "next/server";
import { getAuthorizedOAuth2Client } from "@/lib/google-auth-session";
import { uploadOrUpdateJsonInLogFolder } from "@/lib/google-drive-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getAuthorizedOAuth2Client();
  if (!auth) {
    return NextResponse.json(
      { error: "Google Drive に接続されていません。" },
      { status: 401 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body as { backupJson?: string; fileName?: string };
  if (typeof o.backupJson !== "string" || !o.backupJson.trim()) {
    return NextResponse.json({ error: "backupJson が必要です。" }, { status: 400 });
  }
  if (typeof o.fileName !== "string" || !/\.json$/i.test(o.fileName)) {
    return NextResponse.json(
      { error: "fileName は .json で終わる必要があります。" },
      { status: 400 },
    );
  }
  try {
    const parsed = JSON.parse(o.backupJson) as { schema?: string };
    if (
      parsed.schema !== "altan-orda-thread-backup-v1" &&
      parsed.schema !== "altan-orda-backup-v1"
    ) {
      return NextResponse.json(
        {
          error:
            "schema は altan-orda-thread-backup-v1 または altan-orda-backup-v1 である必要があります。",
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "backupJson が有効な JSON ではありません。" },
      { status: 400 },
    );
  }
  try {
    const result = await uploadOrUpdateJsonInLogFolder(
      auth,
      o.fileName,
      o.backupJson,
    );
    return NextResponse.json({
      ok: true,
      fileId: result.id,
      webViewLink: result.webViewLink ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
