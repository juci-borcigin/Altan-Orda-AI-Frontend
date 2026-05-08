import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const zenOldMincho = localFont({
  src: [
    { path: "../fonts/zen_old_mincho/ZenOldMincho-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/zen_old_mincho/ZenOldMincho-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/zen_old_mincho/ZenOldMincho-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/zen_old_mincho/ZenOldMincho-Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/zen_old_mincho/ZenOldMincho-Black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-zen-old-mincho",
  display: "swap",
});

const hakushuReishoNenga = localFont({
  src: [{ path: "../fonts/hakushu_reisho/HakushuReisho.otf", weight: "400", style: "normal" }],
  variable: "--font-hakushu-reisho-nenga",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Altan Orda",
  description: "Altan Orda — Jochi Ulus UI",
};

/** iPhone Chrome 等でレイアウト幅をデバイスに合わせる */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /** ノッチ下まで塗り、env(safe-area-inset-*) を有効化（16 Pro 等） */
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${zenOldMincho.variable} ${hakushuReishoNenga.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col overflow-x-hidden overflow-y-auto"
      >
        {children}
      </body>
    </html>
  );
}
