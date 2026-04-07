import { NextResponse } from "next/server";
import { parseThreadBackupJson } from "@/lib/ao-state";
import { getAuthorizedOAuth2Client } from "@/lib/google-auth-session";
import {
  getDriveFileText,
  listJsonFilesInLogFolder,
} from "@/lib/google-drive-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await getAuthorizedOAuth2Client();
  if (!auth) {
    return NextResponse.json(
      { error: "Google Drive に接続されていません。" },
      { status: 401 },
    );
  }
  try {
    const raw = await listJsonFilesInLogFolder(auth);
    const files = await Promise.all(
      raw.map(async (f) => {
        try {
          const text = await getDriveFileText(auth, f.id);
          const thread = parseThreadBackupJson(text);
          if (!thread) {
            return {
              id: f.id,
              name: f.name,
              modifiedTime: f.modifiedTime,
              threadTitle: null as string | null,
              projectId: null as string | null,
              parseError: true as const,
            };
          }
          return {
            id: f.id,
            name: f.name,
            modifiedTime: f.modifiedTime,
            threadTitle: thread.title,
            projectId: thread.projectId,
            parseError: false as const,
          };
        } catch {
          return {
            id: f.id,
            name: f.name,
            modifiedTime: f.modifiedTime,
            threadTitle: null as string | null,
            projectId: null as string | null,
            parseError: true as const,
          };
        }
      }),
    );
    return NextResponse.json({ files });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
