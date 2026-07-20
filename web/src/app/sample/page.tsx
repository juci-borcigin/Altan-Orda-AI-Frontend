import Link from "next/link";
import { networkInterfaces } from "os";

export const dynamic = "force-dynamic";

const LABS = [
  {
    href: "/sample/course-foundation-poc",
    title: "構成フェーズ拡張 PoC",
    note: "知識ドラフト→監査→確定（型・見積もり）。課金実行は許可後。",
  },
  {
    href: "/sample/session1-visual-lab",
    title: "第1回 · 文章＋画像比較",
    note: "Luna / Terra × Image2 Low&Mid。画像の下に本文。料金・時間・プロンプト付き。",
  },
  {
    href: "/sample/gpt-5-6-lab",
    title: "GPT-5.6 講座生成テスト",
    note: "講座設計（Terra）と全5回本文（Sonnet / Luna / Terra）。",
  },
  {
    href: "/sample/text-lab",
    title: "本文・構成モデル比較",
    note: "Sonnet 4.6 / Luna / Terra の文章比較。",
  },
  {
    href: "/sample/image-lab",
    title: "画像プロンプト比較ラボ",
    note: "A / B / B' / C の画像比較。",
  },
] as const;

function lanIpv4(): string | null {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

export default function SampleIndexPage() {
  const lan = lanIpv4();

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 820,
        margin: "0 auto",
        padding: "1.5rem 1rem 3rem",
        boxSizing: "border-box",
        minHeight: "100%",
        background: "linear-gradient(180deg,#f4f0e8,#e7edf2)",
        color: "#172033",
        fontFamily: "ui-sans-serif,system-ui,sans-serif",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", opacity: 0.7 }}>
        LOCAL SAMPLE HUB
      </p>
      <h1 style={{ margin: "0.35rem 0 0.5rem", fontSize: "1.7rem" }}>講習メーカー試験場</h1>
      <p style={{ margin: "0 0 1.2rem", lineHeight: 1.55, maxWidth: 640 }}>
        各種比較ラボの入口。スマホでも同じURLで閲覧できます。
      </p>

      <div style={{ display: "grid", gap: "0.7rem" }}>
        {LABS.map((lab) => (
          <Link
            key={lab.href}
            href={lab.href}
            style={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
              background: "rgba(255,255,255,0.86)",
              borderTop: "3px solid #173f5f",
              padding: "0.9rem 1rem",
            }}
          >
            <strong style={{ fontSize: "1.02rem" }}>{lab.title}</strong>
            <div style={{ marginTop: "0.3rem", fontSize: "0.82rem", color: "#475569" }}>
              {lab.note}
            </div>
          </Link>
        ))}
      </div>

      <section style={{ marginTop: "1.6rem", padding: "0.9rem", background: "#fff7" }}>
        <h2 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>スマホ閲覧</h2>
        <ol style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", lineHeight: 1.65 }}>
          <li>
            <strong>本命: Vercel Preview</strong> — ブランチの Preview URL で{" "}
            <code>/sample</code>。Preview env に <code>AO_SAMPLE_PUBLIC=1</code>、生成は{" "}
            <code>AO_SAMPLE_API_DISABLED=1</code> または{" "}
            <code>AO_SAMPLE_API_SECRET</code>。
          </li>
          <li>
            同一Wi-Fi（Mac 起動中）:{" "}
            {lan ? (
              <a href={`http://${lan}:3000/sample`}>
                http://{lan}:3000/sample
              </a>
            ) : (
              <code>http://&lt;MacのLAN IP&gt;:3000/sample</code>
            )}
          </li>
          <li>
            Mac オフ・オフライン:{" "}
            <a href="/sample/session1-visual-lab-offline.zip">
              session1-visual-lab-offline.zip（約89MB）
            </a>
            {" · "}
            <Link href="/sample/session1-visual-lab/static.html">static.html</Link>
            {" · "}
            <Link href="/sample/index.html">静的ハブ</Link>
          </li>
        </ol>
      </section>
    </main>
  );
}
