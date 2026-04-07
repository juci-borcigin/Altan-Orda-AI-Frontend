import { OAuth2Client } from "google-auth-library";

/**
 * マイドライブ上の既存フォルダ（手作りの Projects/...）を一覧で見つけるには
 * `drive.file` では不足な場合があるため、`drive` を使う。
 * 再接続（Drive 切断 → Drive に接続）でスコープが更新される。
 */
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export function getOAuth2Client(): OAuth2Client | null {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!id || !secret || !redirect) return null;
  return new OAuth2Client(id, secret, redirect);
}

export function googleOAuthConfigured(): boolean {
  return !!getOAuth2Client() && !!process.env.AO_SESSION_SECRET;
}
