import type { OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";
import { decryptPayload, encryptPayload } from "@/lib/session-crypto";
import { getOAuth2Client } from "@/lib/google-oauth";

const COOKIE_RT = "ao_google_rt";
const COOKIE_STATE = "ao_oauth_state";

export async function setOAuthStateCookie(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_STATE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export async function getOAuthStateCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE_STATE)?.value;
}

export async function clearOAuthStateCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_STATE);
}

export async function setRefreshTokenCookie(refreshToken: string): Promise<void> {
  const secret = process.env.AO_SESSION_SECRET;
  if (!secret) throw new Error("AO_SESSION_SECRET is not set");
  const payload = encryptPayload(
    JSON.stringify({ refresh_token: refreshToken }),
    secret,
  );
  const jar = await cookies();
  jar.set(COOKIE_RT, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

export async function getRefreshTokenFromCookies(): Promise<string | null> {
  const secret = process.env.AO_SESSION_SECRET;
  if (!secret) return null;
  const jar = await cookies();
  const enc = jar.get(COOKIE_RT)?.value;
  if (!enc) return null;
  const json = decryptPayload(enc, secret);
  if (!json) return null;
  try {
    const o = JSON.parse(json) as { refresh_token?: string };
    return o.refresh_token ?? null;
  } catch {
    return null;
  }
}

export async function clearRefreshTokenCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_RT);
}

/** Cookie に保存した refresh_token で認可済みクライアントを返す */
export async function getAuthorizedOAuth2Client(): Promise<OAuth2Client | null> {
  const oauth2 = getOAuth2Client();
  if (!oauth2) return null;
  const rt = await getRefreshTokenFromCookies();
  if (!rt) return null;
  oauth2.setCredentials({ refresh_token: rt });
  return oauth2;
}
