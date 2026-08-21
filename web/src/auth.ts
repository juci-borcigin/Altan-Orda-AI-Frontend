import { basicAuthGate } from "@/lib/basic-auth-gate";
import { isPublicLearnHeroAssetPath } from "@/lib/course-maker/course-public-learn";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/** Vercel で OAuth を有効にするための3環境変数がそろっているか */
export const oauthConfigured =
  Boolean(process.env.AUTH_SECRET?.trim()) &&
  Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

function envFlagTrue(...keys: string[]): boolean {
  for (const key of keys) {
    const v = (process.env[key] ?? "").trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes") return true;
  }
  return false;
}

function labPublicEnabled(): boolean {
  return envFlagTrue("AO_LAB_PUBLIC", "AO_SAMPLE_PUBLIC");
}

/**
 * Lab（実験室）閲覧を OAuth / Basic 外に出す（AO_LAB_PUBLIC=1、互換 AO_SAMPLE_PUBLIC）。
 * - `/lab`・旧 `/sample`（redirect 用）と静的成果物
 * - `/api/lab/*`（および旧 `/api/sample/*`）の GET のみ（POST は認証＋ route 内ガード）
 */
function isLabPublicPath(pathname: string, method?: string): boolean {
  if (!labPublicEnabled()) return false;
  if (pathname === "/lab" || pathname.startsWith("/lab/")) return true;
  if (pathname === "/sample" || pathname.startsWith("/sample/")) return true;
  if (pathname.startsWith("/api/lab/") || pathname.startsWith("/api/sample/")) {
    const m = (method ?? "GET").toUpperCase();
    return m === "GET" || m === "HEAD";
  }
  return false;
}

/** 講義公開受講（/l/*）。実データは route 内 allowlist で制限 */
function isPublicLearnPath(pathname: string): boolean {
  if (pathname === "/l" || pathname.startsWith("/l/")) return true;
  if (pathname.startsWith("/api/l/")) return true;
  // 受講画面の回メイン画像（静的 PNG）。allowlist の講義のみ
  if (isPublicLearnHeroAssetPath(pathname)) return true;
  return false;
}

/** iOS のホーム画面追加は Cookie なしでアイコン／manifest を取りに来る */
function isPublicPwaChromePath(pathname: string): boolean {
  return (
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/apple-touch-icon-precomposed.png" ||
    pathname === "/icon" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon" ||
    pathname === "/apple-icon.png"
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // middleware が常に Auth を通すため、ローカルではフォールバックを用意する（本番では必ず AUTH_SECRET を設定すること）
  secret: process.env.AUTH_SECRET || "dev-only-insecure-auth-secret",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      if (pathname.startsWith("/_next")) return true;
      if (isPublicPwaChromePath(pathname)) return true;

      if (isPublicLearnPath(pathname)) return true;

      if (!oauthConfigured) {
        if (isLabPublicPath(pathname, request.method)) return true;
        return basicAuthGate(request);
      }

      if (pathname.startsWith("/api/auth")) return true;
      if (pathname.startsWith("/api/ao-login")) return true;
      if (pathname.startsWith("/api/ao-logout")) return true;
      if (pathname.startsWith("/sign-in")) return true;

      // Preview スマホ閲覧用: AO_LAB_PUBLIC（互換 AO_SAMPLE_PUBLIC）で /lab と読取 GET のみ公開
      if (isLabPublicPath(pathname, request.method)) return true;

      return Boolean(auth?.user);
    },
    async signIn({ user }) {
      const raw = process.env.ALLOWED_GOOGLE_EMAILS?.trim();
      if (!raw) {
        return process.env.NODE_ENV !== "production";
      }
      const allowed = raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const email = user.email?.toLowerCase();
      return Boolean(email && allowed.includes(email));
    },
  },
});
