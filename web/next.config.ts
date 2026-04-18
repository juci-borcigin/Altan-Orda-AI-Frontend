import type { NextConfig } from "next";

/** 開発時のみ: LAN の http://<IP>:3000 などで開くとき HMR がブロックされないようホストを許可する（カンマ区切り） */
const allowedDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  output: "standalone",
  /** モノレポ化したリポジトリ直下の package-lock がある場合の警告抑止（npm run は web/ で実行） */
  turbopack: {
    root: ".",
  },
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
