import { NextResponse } from "next/server";
import { clearRefreshTokenCookie } from "@/lib/google-auth-session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearRefreshTokenCookie();
  return NextResponse.json({ ok: true });
}
