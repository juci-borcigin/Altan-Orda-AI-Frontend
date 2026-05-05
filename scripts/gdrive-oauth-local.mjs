#!/usr/bin/env node
/**
 * OAuth Playground を使わず、127.0.0.1 の一時 HTTP サーバで認可し
 * リフレッシュトークンを取得する（手元の Mac 等で 1 回だけ実行）。
 *
 * 事前準備:
 *   - Google Cloud で Drive API を有効化し、OAuth 同意画面を設定
 *   - OAuth クライアント（下記いずれか）
 *   - web/.env に GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET を設定
 *
 * 使い方（リポジトリルート）:
 *   npm run gdrive-oauth-local
 *
 * 環境変数（任意）:
 *   OAUTH_LOCAL_PORT   既定 8765（ポートが使用中なら変更）
 *   GDRIVE_OAUTH_SCOPE 既定 https://www.googleapis.com/auth/drive
 *
 * Web アプリケーション型のクライアントを使う場合:
 *   GCP の「承認済みのリダイレクト URI」に、起動時に表示される URI を一字一句追加して保存すること。
 *
 * デスクトップ型のクライアントの場合:
 *   多くの環境ではループバック URI がそのまま使える。redirect_uri_mismatch になる場合は
 *   Web 型クライアントを別途作成し、上記リダイレクトを登録する方が確実。
 */

import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../web/.env") });

const PORT = Number(process.env.OAUTH_LOCAL_PORT || 8765, 10) || 8765;
const REDIRECT_PATH = "/oauth2callback";
const REDIRECT_URI = `http://127.0.0.1:${PORT}${REDIRECT_PATH}`;

const clientId = process.env.GDRIVE_CLIENT_ID?.trim();
const clientSecret = process.env.GDRIVE_CLIENT_SECRET?.trim();
const scope =
  process.env.GDRIVE_OAUTH_SCOPE?.trim() || "https://www.googleapis.com/auth/drive";

if (!clientId || !clientSecret) {
  console.error("GDRIVE_CLIENT_ID と GDRIVE_CLIENT_SECRET が必要です（web/.env 等）。");
  process.exit(1);
}

function authUrl() {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`トークン交換 ${res.status}: ${text.slice(0, 800)}`);
  }
  return JSON.parse(text);
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  } catch {
    res.writeHead(400);
    res.end("bad url");
    return;
  }

  if (url.pathname !== REDIRECT_PATH) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const err = url.searchParams.get("error");
  const desc = url.searchParams.get("error_description");
  if (err) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<!DOCTYPE html><meta charset="utf-8"><p>認可エラー: <code>${err}</code></p><p>${desc || ""}</p>`,
    );
    console.error("認可エラー:", err, desc || "");
    server.close();
    process.exit(1);
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!DOCTYPE html><meta charset=\"utf-8\"><p>code がありません。</p>");
    server.close();
    process.exit(1);
    return;
  }

  try {
    const tokens = await exchangeCode(code);
    const rt = tokens.refresh_token;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<!DOCTYPE html><meta charset=\"utf-8\"><body style=\"font-family:sans-serif\">" +
        "<p>取得完了。ターミナルに <strong>GDRIVE_REFRESH_TOKEN</strong> が表示されています。</p>" +
        "<p>このウィンドウは閉じて構いません。</p></body>",
    );

    console.log("\n======== 結果（GitHub Actions の Secret に GDRIVE_REFRESH_TOKEN として登録）========\n");
    if (rt) {
      console.log(rt);
    } else {
      console.log(
        "(refresh_token が返りませんでした。Google アカウントの「サードパーティのアプリにアクセスできるアカウント」から該当アプリのアクセスを削除し、本スクリプトを再実行するか、別ブラウザプロファイルで試してください。)",
      );
      console.log("\n応答 JSON（参考・外部に貼らない）:\n", JSON.stringify(tokens, null, 2));
    }
    console.log("\n================================================================================\n");

    res.on("finish", () => {
      server.close(() => process.exit(rt ? 0 : 1));
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html><meta charset="utf-8"><pre>${msg}</pre>`);
    console.error(msg);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = authUrl();
  console.log("\n次のリダイレクト URI を OAuth クライアント（Web 型の場合は必須）に登録してください:\n");
  console.log(`  ${REDIRECT_URI}\n`);
  console.log("ブラウザで次の URL を開き、Google にログインして許可してください:\n");
  console.log(url);
  console.log("\n待機中（127.0.0.1:" + PORT + "）… Ctrl+C で中止\n");

  if (process.platform === "darwin") {
    const child = spawn("open", [url], { stdio: "ignore", detached: true });
    child.unref();
  }
});
