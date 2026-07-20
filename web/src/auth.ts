import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { basicAuthGate } from "@/lib/basic-auth-gate";

/** Vercel で OAuth を有効にするための3環境変数がそろっているか */
export const oauthConfigured =
  Boolean(process.env.AUTH_SECRET?.trim()) &&
  Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

function samplePublicEnabled(): boolean {
  const v = (process.env.AO_SAMPLE_PUBLIC ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Sample 閲覧を OAuth / Basic 外に出す（AO_SAMPLE_PUBLIC=1）。
 * - `/sample` ページ・静的成果物
 * - `/api/sample/*` の GET のみ（POST は認証＋ route 内ガード）
 */
function isSamplePublicPath(pathname: string, method?: string): boolean {
  if (!samplePublicEnabled()) return false;
  if (pathname === "/sample" || pathname.startsWith("/sample/")) return true;
  if (pathname.startsWith("/api/sample/")) {
    const m = (method ?? "GET").toUpperCase();
    return m === "GET" || m === "HEAD";
  }
  return false;
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
      if (pathname === "/favicon.ico") return true;

      if (!oauthConfigured) {
        if (isSamplePublicPath(pathname, request.method)) return true;
        return basicAuthGate(request);
      }

      if (pathname.startsWith("/api/auth")) return true;
      if (pathname.startsWith("/api/ao-login")) return true;
      if (pathname.startsWith("/api/ao-logout")) return true;
      if (pathname.startsWith("/sign-in")) return true;

      // Preview スマホ閲覧用: AO_SAMPLE_PUBLIC=1 で /sample と読取 GET のみ公開
      if (isSamplePublicPath(pathname, request.method)) return true;

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
