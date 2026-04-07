import { NextResponse } from "next/server";
import {
  clearOAuthStateCookie,
  getOAuthStateCookie,
  getRefreshTokenFromCookies,
  setRefreshTokenCookie,
} from "@/lib/google-auth-session";
import { getOAuth2Client } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const base = new URL(request.url);
  const { searchParams } = base;
  const err = searchParams.get("error");
  if (err) {
    await clearOAuthStateCookie();
    return NextResponse.redirect(
      new URL(`/?drive=error&reason=${encodeURIComponent(err)}`, base.origin),
    );
  }
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?drive=error&reason=missing_code", base.origin),
    );
  }
  const saved = await getOAuthStateCookie();
  await clearOAuthStateCookie();
  if (!saved || saved !== state) {
    return NextResponse.redirect(
      new URL("/?drive=error&reason=bad_state", base.origin),
    );
  }
  const oauth2 = getOAuth2Client();
  if (!oauth2) {
    return NextResponse.redirect(
      new URL("/?drive=error&reason=config", base.origin),
    );
  }
  let tokens;
  try {
    const r = await oauth2.getToken(code);
    tokens = r.tokens;
  } catch {
    return NextResponse.redirect(
      new URL("/?drive=error&reason=token_exchange", base.origin),
    );
  }
  const refreshToken =
    tokens.refresh_token ?? (await getRefreshTokenFromCookies());
  if (!refreshToken) {
    return NextResponse.redirect(
      new URL("/?drive=error&reason=no_refresh_token", base.origin),
    );
  }
  await setRefreshTokenCookie(refreshToken);
  return NextResponse.redirect(new URL("/?drive=connected", base.origin));
}
