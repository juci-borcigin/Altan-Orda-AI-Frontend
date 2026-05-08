import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { basicAuthGate } from "@/lib/basic-auth-gate";

/** Vercel で OAuth を有効にするための3環境変数がそろっているか */
export const oauthConfigured =
  Boolean(process.env.AUTH_SECRET?.trim()) &&
  Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

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
        return basicAuthGate(request);
      }

      if (pathname.startsWith("/api/auth")) return true;
      if (pathname.startsWith("/api/ao-login")) return true;
      if (pathname.startsWith("/api/ao-logout")) return true;
      if (pathname.startsWith("/sign-in")) return true;

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
