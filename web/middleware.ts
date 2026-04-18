import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i += 1) out |= aa[i] ^ bb[i];
  return out === 0;
}

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Altan Orda"' },
  });
}

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER || "";
  const pass = process.env.BASIC_AUTH_PASS || "";

  // 未設定なら無効（ローカル開発など）
  if (!user || !pass) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Next.js / 静的・内部系は除外
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname === "/favicon.ico") return NextResponse.next();

  const header = req.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  const idx = decoded.indexOf(":");
  if (idx < 0) return unauthorized();
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);

  if (!timingSafeEqual(u, user) || !timingSafeEqual(p, pass)) return unauthorized();
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

