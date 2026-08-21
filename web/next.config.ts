import type { NextConfig } from "next";
import os from "node:os";

/** 開発時のみ: LAN の http://<IP>:3000 などで開くとき HMR がブロックされないようホストを許可する（カンマ区切り） */
const allowedDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

function detectLocalIpv4Hosts(): string[] {
  const out = new Set<string>();
  const nets = os.networkInterfaces();
  for (const vals of Object.values(nets)) {
    for (const v of vals ?? []) {
      if (v.family === "IPv4" && !v.internal) out.add(v.address);
    }
  }
  return [...out];
}

const mergedAllowedDevOrigins = [...new Set([...allowedDevOrigins, ...detectLocalIpv4Hosts()])];

const nextConfig: NextConfig = {
  output: "standalone",
  /** モノレポ化したリポジトリ直下の package-lock がある場合の警告抑止（npm run は web/ で実行） */
  turbopack: {
    root: ".",
  },
  ...(mergedAllowedDevOrigins.length > 0 ? { allowedDevOrigins: mergedAllowedDevOrigins } : {}),
  /** 旧 Sample（/sample）→ Lab（/lab）。ブックマーク・ドキュメント互換 */
  async redirects() {
    return [
      { source: "/sample", destination: "/lab", permanent: true },
      { source: "/sample/:path*", destination: "/lab/:path*", permanent: true },
      { source: "/api/sample/:path*", destination: "/api/lab/:path*", permanent: true },
      { source: "/phase5-preview", destination: "/lab/template-tokens", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/apple-touch-icon-precomposed.png",
        destination: "/apple-touch-icon.png",
      },
    ];
  },
  /** 静的アセットのブラウザキャッシュ（HTML/API は対象外） */
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/template/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/personas/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/apple-touch-icon.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, must-revalidate" }],
      },
      {
        source: "/apple-touch-icon-precomposed.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, must-revalidate" }],
      },
      {
        source: "/icon.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, must-revalidate" }],
      },
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, immutable" }],
      },
    ];
  },
};

export default nextConfig;
