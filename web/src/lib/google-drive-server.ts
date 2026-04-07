import type { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import { google } from "googleapis";

/** マイドライブからの相対: Projects / Altan-Orda-AI-Frontend / Archives / Logs */
export const DRIVE_LOG_FOLDER_SEGMENTS = [
  "Projects",
  "Altan-Orda-AI-Frontend",
  "Archives",
  "Logs",
] as const;

function qEsc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function ensureFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string> {
  const parentQuery =
    parentId === "root"
      ? "'root' in parents"
      : `'${parentId}' in parents`;
  const q = `name='${qEsc(name)}' and mimeType='application/vnd.google-apps.folder' and ${parentQuery} and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id)",
    pageSize: 2,
    supportsAllDrives: false,
  });
  const id = res.data.files?.[0]?.id;
  if (id) return id;
  const cr = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  if (!cr.data.id) throw new Error("Drive: folder create failed");
  return cr.data.id;
}

/** 環境変数で末尾フォルダ ID を直指定すると、パス探索をスキップできる */
function resolveLogFolderIdFromEnv(): string | null {
  const id = process.env.GOOGLE_DRIVE_LOGS_FOLDER_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export async function ensureDriveLogFolder(
  auth: OAuth2Client,
): Promise<string> {
  const direct = resolveLogFolderIdFromEnv();
  if (direct) return direct;
  const drive = google.drive({ version: "v3", auth: auth as never });
  let parentId = "root";
  for (const seg of DRIVE_LOG_FOLDER_SEGMENTS) {
    parentId = await ensureFolder(drive, seg, parentId);
  }
  return parentId;
}

async function findJsonFileInFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string | null> {
  const q = `name='${qEsc(name)}' and '${parentId}' in parents and mimeType='application/json' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id)",
    pageSize: 2,
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function uploadOrUpdateJsonInLogFolder(
  auth: OAuth2Client,
  fileName: string,
  jsonBody: string,
): Promise<{ id: string; webViewLink: string | null | undefined }> {
  const drive = google.drive({ version: "v3", auth: auth as never });
  const folderId = await ensureDriveLogFolder(auth);
  const existingId = await findJsonFileInFolder(drive, fileName, folderId);
  /** googleapis の multipart は Stream を想定。Buffer 直渡しだと pipe エラーになる */
  const media = {
    mimeType: "application/json",
    body: Readable.from(Buffer.from(jsonBody, "utf8")),
  };

  if (existingId) {
    const up = await drive.files.update({
      fileId: existingId,
      media,
      fields: "id, webViewLink",
    });
    return {
      id: up.data.id!,
      webViewLink: up.data.webViewLink,
    };
  }

  const cr = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media,
    fields: "id, webViewLink",
  });
  return {
    id: cr.data.id!,
    webViewLink: cr.data.webViewLink,
  };
}

export type DriveListItem = {
  id: string;
  name: string;
  modifiedTime: string | null;
};

export async function listJsonFilesInLogFolder(
  auth: OAuth2Client,
): Promise<DriveListItem[]> {
  const folderId = await ensureDriveLogFolder(auth);
  const drive = google.drive({ version: "v3", auth: auth as never });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
    fields: "files(id, name, modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 200,
    supportsAllDrives: false,
  });
  const files = res.data.files ?? [];
  return files.map((f) => ({
    id: f.id!,
    name: f.name ?? "(無名)",
    modifiedTime: f.modifiedTime ?? null,
  }));
}

export async function getDriveFileText(
  auth: OAuth2Client,
  fileId: string,
): Promise<string> {
  const r = await auth.getAccessToken();
  const accessToken =
    typeof r === "string" ? r : (r as { token?: string | null })?.token;
  if (!accessToken) {
    throw new Error("Drive: access token unavailable");
  }
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Drive file read: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.text();
}
