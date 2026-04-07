import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { setOAuthStateCookie } from "@/lib/google-auth-session";
import { getOAuth2Client, GOOGLE_DRIVE_SCOPE, googleOAuthConfigured } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const oauth2 = getOAuth2Client();
  if (!oauth2 || !googleOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google OAuth が未設定です。GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI / AO_SESSION_SECRET を設定してください。",
      },
      { status: 503 },
    );
  }
  const state = randomBytes(32).toString("base64url");
  await setOAuthStateCookie(state);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: [GOOGLE_DRIVE_SCOPE],
    prompt: "consent",
    state,
  });
  return NextResponse.redirect(url);
}
