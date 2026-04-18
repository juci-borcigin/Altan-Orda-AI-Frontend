#!/usr/bin/env node
/**
 * Step 5: Supabase の threads / messages を JSON にまとめ、GDrive フォルダへアップロード（上書き）。
 * 依存: Node 18+（fetch のみ）。GitHub Actions の `node scripts/backup-to-gdrive.mjs` で実行。
 *
 * 必須環境変数:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN, GDRIVE_BACKUP_FOLDER_ID
 */

const jsonHeaders = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

async function fetchAllRows(baseUrl, key, table) {
  const out = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const url = `${baseUrl}/rest/v1/${table}?select=*&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, { headers: jsonHeaders(key) });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${table} fetch ${res.status}: ${text.slice(0, 400)}`);
    }
    const rows = JSON.parse(text);
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return out;
}

async function refreshAccessToken() {
  const clientId = process.env.GDRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, or GDRIVE_REFRESH_TOKEN");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`oauth token ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("No access_token in oauth response");
  return data.access_token;
}

async function findFileInFolder(accessToken, folderId, fileName) {
  const q = `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`drive list ${res.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  return data.files?.[0]?.id ?? null;
}

async function uploadJson(accessToken, folderId, fileName, jsonBody) {
  const boundary = "altanorda_boundary_" + Math.random().toString(16).slice(2);
  const metadata = { name: fileName, parents: [folderId] };
  const media = typeof jsonBody === "string" ? jsonBody : JSON.stringify(jsonBody, null, 2);
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${media}\r\n` +
    `--${boundary}--`;

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`drive upload ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

async function updateFileMedia(accessToken, fileId, jsonBody) {
  const media = typeof jsonBody === "string" ? jsonBody : JSON.stringify(jsonBody, null, 2);
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: media,
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`drive patch media ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

async function main() {
  const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const folderId = process.env.GDRIVE_BACKUP_FOLDER_ID?.trim();

  if (!baseUrl || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  if (!folderId) {
    throw new Error("GDRIVE_BACKUP_FOLDER_ID is required");
  }

  console.error("Fetching threads…");
  const threads = await fetchAllRows(baseUrl, key, "threads");
  console.error("Fetching messages…");
  const messages = await fetchAllRows(baseUrl, key, "messages");

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `altan-orda-backup-${stamp}.json`;
  const payload = {
    schema: "altan-orda-supabase-backup-v1",
    exportedAt: new Date().toISOString(),
    threads,
    messages,
  };

  const accessToken = await refreshAccessToken();
  console.error("Uploading to Google Drive…", fileName);

  const existingId = await findFileInFolder(accessToken, folderId, fileName);
  if (existingId) {
    await updateFileMedia(accessToken, existingId, payload);
    console.error("Updated existing file:", existingId);
  } else {
    const created = await uploadJson(accessToken, folderId, fileName, payload);
    console.error("Created file:", created.id);
  }
  console.error("Backup OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
