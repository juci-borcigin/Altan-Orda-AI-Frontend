import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lab | Altan Orda",
  description: "内部検証用ラボ",
};

const sections = [
  {
    title: "鎌倉文化事業（外部）",
    items: [
      {
        href: "/lab/kamakura-lp-research",
        label: "LP研究ハブ — 気品・格調サンプル",
        note: "トレンド整理 + 3方向の試作",
      },
      {
        href: "/lab/kamakura-lp-a-ma",
        label: "A · 間（Ma）",
        note: "余白と章立てのスクロール物語",
      },
      {
        href: "/lab/kamakura-lp-b-editorial",
        label: "B · Editorial Gallery",
        note: "雑誌／美術館キュレーション調",
      },
      {
        href: "/lab/kamakura-lp-c-monument",
        label: "C · Ink Monument",
        note: "墨の記念碑・格調重視",
      },
    ],
  },
];

export default function LabIndexPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "3rem 1.5rem 4rem",
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#1a1a1a",
        background: "#f7f7f5",
      }}
    >
      <p style={{ fontSize: 12, letterSpacing: "0.12em", opacity: 0.55, marginBottom: 8 }}>
        INTERNAL LAB
      </p>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 600, marginBottom: 8 }}>Lab</h1>
      <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.7, marginBottom: 40 }}>
        検証用ページ一覧です。本番アプリのデザイン言語とは切り離しています。
      </p>

      {sections.map((section) => (
        <section key={section.title} style={{ marginBottom: 36 }}>
          <h2
            style={{
              fontSize: 13,
              letterSpacing: "0.08em",
              marginBottom: 14,
              borderBottom: "1px solid #ddd",
              paddingBottom: 8,
            }}
          >
            {section.title}
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "14px 16px",
                    background: "#fff",
                    border: "1px solid #e5e5e2",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ display: "block", fontWeight: 560, marginBottom: 4 }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 13, opacity: 0.6 }}>{item.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
