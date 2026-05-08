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

/** Basic が未設定ならスキップ。設定されていればヘッダを検証し、ダメなら 401 を返す。 */
export function basicAuthGate(request: NextRequest): true | NextResponse {
  const user = process.env.BASIC_AUTH_USER || "";
  const pass = process.env.BASIC_AUTH_PASS || "";

  if (!user || !pass) return true;

  const header = request.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Altan Orda"' },
    });
  }

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Altan Orda"' },
    });
  }

  const idx = decoded.indexOf(":");
  if (idx < 0) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Altan Orda"' },
    });
  }
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);

  if (!timingSafeEqual(u, user) || !timingSafeEqual(p, pass)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Altan Orda"' },
    });
  }

  return true;
}
