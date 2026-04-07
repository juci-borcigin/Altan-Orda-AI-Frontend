import { NextResponse } from "next/server";
import { getRefreshTokenFromCookies } from "@/lib/google-auth-session";
import { googleOAuthConfigured } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const oauthConfigured = googleOAuthConfigured();
  const connected = oauthConfigured && !!(await getRefreshTokenFromCookies());
  return NextResponse.json({ connected, oauthConfigured });
}
