import Link from "next/link";
import { networkInterfaces } from "os";
import "./lab.css";

export const dynamic = "force-dynamic";

type LabItem = {
  href: string;
  title: string;
  note: string;
};

type LabSection = {
  id: string;
  title: string;
  blurb: string;
  items: LabItem[];
};

const SECTIONS: LabSection[] = [
  {
    id: "ao-core",
    title: "AO 本体アーカイブ",
    blurb:
      "チャットUI・部品・典籍まわりの試作。見た目の正本はテンプレ台帳（`/lab/template-tokens`）。",
    items: [
      {
        href: "/lab/template-tokens",
        title: "テンプレ・トークン台帳",
        note: "視覚 SSOT。ガイド線、9-slice 部品（角・辺）、大枠/中枠/顔グラ/名札の組み合わせ。数値正本は ao-frame-tokens.ts。旧 /phase5-preview はここへ寄せた。",
      },
      {
        href: "/lab/frame-inset-lab",
        title: "枠インセット診断ラボ",
        note: "大枠 AL・中枠 AS・顔グラ Frame_D の slice/border/装飾内端を 1px ガイドで可視化。本番同等コンポーネント。",
      },
      {
        href: "/phase5-preview/notebook-sources",
        title: "典籍ソース仮UI",
        note: "ノートブック／典籍取り込みまわりのプレビュー。",
      },
      {
        href: "/ao-shin-icon-samples.html",
        title: "アイコン SVG 候補",
        note: "新規アイコン案の静的プレビュー（HTML）。",
      },
    ],
  },
  {
    id: "ops",
    title: "運用・プレビュー",
    blurb: "生成の進行確認や、受講UIの見た目確認。課金を伴わない確認に使う。",
    items: [
      {
        href: "/lab/course-run-tracker",
        title: "講義生成トラッキング",
        note: "進行中の生成、成果物、料金・時間を追跡するたたき台。",
      },
      {
        href: "/lab/learn-preview",
        title: "受講画面プレビュー（Format v2）",
        note: "静的プレビュー。課金なし。受講者が見るUIの確認用。",
      },
    ],
  },
  {
    id: "course-maker",
    title: "講義メーカー実験",
    blurb: "講義メーカーの構成・知識パイプラインの PoC。課金実行は許可後。",
    items: [
      {
        href: "/lab/course-foundation-poc",
        title: "構成フェーズ拡張 PoC",
        note: "知識ドラフト → 監査 → 確定。型・見積もり・実行。",
      },
    ],
  },
  {
    id: "models",
    title: "モデル比較アーカイブ（講義メーカー）",
    blurb: "本文・構成・画像のモデル選定に使った比較場。結論は講義メーカーのドキュメントへ。",
    items: [
      {
        href: "/lab/session1-visual-lab",
        title: "第1回 · 文章＋画像比較",
        note: "Luna / Terra × Image2 Low&Mid。画像の下に本文。",
      },
      {
        href: "/lab/gpt-5-6-lab",
        title: "GPT-5.6 講義生成テスト",
        note: "講義設計（Terra）と全5回本文の比較。",
      },
      {
        href: "/lab/text-lab",
        title: "本文・構成モデル比較",
        note: "Sonnet / Luna / Terra の文章比較。",
      },
      {
        href: "/lab/image-lab",
        title: "画像プロンプト比較",
        note: "プロンプト案 A / B / B' / C の画像比較。",
      },
    ],
  },
  {
    id: "kamakura",
    title: "鎌倉書道（外部）",
    blurb: "海外顧客向け書道体験サイトの見た目検証。本文コピーは後回し。",
    items: [
      {
        href: "/lab/kamakura-shodo-design",
        title: "ホームページ デザイン3案",
        note: "Coastal Mist / Garden Light / Ink Field。競合比較つき。",
      },
      {
        href: "/lab/kamakura-shodo-ink-field",
        title: "Ink Field 試作（HP）",
        note: "正本Doc掲載案を反映。JP/EN・スマホ対応。",
      },
    ],
  },
];

function lanIpv4(): string | null {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

export default function LabIndexPage() {
  const lan = lanIpv4();

  return (
    <main className="ao-lab">
      <header className="ao-lab-hero">
        <p className="ao-lab-kicker">Altan Orda</p>
        <h1 className="ao-lab-brand">実験室</h1>
        <p className="ao-lab-lead">
          開発・比較・PoC の公式エリア。講義メーカーと AO 本体の試作をここに集約する。旧{" "}
          <code>/sample</code> は <code>/lab</code> へ移した。
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.id} className="ao-lab-section" aria-labelledby={`lab-${section.id}`}>
          <h2 id={`lab-${section.id}`}>{section.title}</h2>
          <p className="ao-lab-section-blurb">{section.blurb}</p>
          <ul className="ao-lab-list">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="ao-lab-card">
                  <span className="ao-lab-card-title">{item.title}</span>
                  <span className="ao-lab-card-note">{item.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="ao-lab-section" aria-labelledby="lab-access">
        <h2 id="lab-access">閲覧・運用</h2>
        <p className="ao-lab-section-blurb">
          Preview では <code>AO_LAB_PUBLIC=1</code>（互換: <code>AO_SAMPLE_PUBLIC</code>
          ）。生成 POST は秘密ヘッダか無効化フラグで閉じる。詳細は{" "}
          <code>docs/lab/README.md</code>。
        </p>
        <ol className="ao-lab-ol">
          <li>
            <strong>Vercel Preview</strong> — ブランチの Preview URL で <code>/lab</code>
          </li>
          <li>
            同一 Wi-Fi（Mac 起動中）:{" "}
            {lan ? (
              <a href={`http://${lan}:3000/lab`}>http://{lan}:3000/lab</a>
            ) : (
              <code>http://&lt;MacのLAN IP&gt;:3000/lab</code>
            )}
          </li>
          <li>
            オフライン成果物:{" "}
            <a href="/lab/session1-visual-lab-offline.zip">session1 zip</a>
            {" · "}
            <Link href="/lab/session1-visual-lab/static.html">static.html</Link>
            {" · "}
            <Link href="/lab/index.html">静的ハブ</Link>
          </li>
        </ol>
      </section>
    </main>
  );
}
