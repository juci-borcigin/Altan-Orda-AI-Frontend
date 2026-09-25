import Link from "next/link";
import type { Metadata } from "next";
import "./research.css";

export const metadata: Metadata = {
  title: "Kamakura LP Research | Lab",
  description: "気品・格調に寄せた文化事業LPの研究とサンプル",
};

const samples = [
  {
    href: "/lab/kamakura-lp-a-ma",
    code: "A",
    name: "間 — Ma",
    one: "余白が主役。章で読む鎌倉。",
    fit: "気品・格調との相性が最も高い。速さより滞在。",
    risk: "情報量が少なく見える。予約導線は後半に置く必要あり。",
  },
  {
    href: "/lab/kamakura-lp-b-editorial",
    code: "B",
    name: "Editorial Gallery",
    one: "雑誌／美術館のキュレーション歩き。",
    fit: "将来の観光案内・複数柱（教室／オンライン／物販）を並べやすい。",
    risk: "カード過多になるとSaaS感が出る。グリッドは最小限に。",
  },
  {
    href: "/lab/kamakura-lp-c-monument",
    code: "C",
    name: "Ink Monument",
    one: "墨の面と朱印。書の実力を沈黙で示す。",
    fit: "書道コアの権威感。既存Ink Fieldの発展形。",
    risk: "暗すぎると重くなる。写真と墨面のバランスが要。",
  },
];

export default function KamakuraLpResearchPage() {
  return (
    <main className="klr">
      <header className="klr-hero">
        <p className="klr-kicker">LAB · RESEARCH</p>
        <h1>鎌倉文化事業 LP — 研究ノート</h1>
        <p className="klr-lede">
          アプリUI（AO / Yellowback / Praxia）は参考にしていません。対象は文系・アーティスティックな
          ランディングで、キーワードは<strong>気品</strong>と<strong>格調</strong>、舞台は
          <strong>鎌倉</strong>です。
        </p>
        <p className="klr-back">
          <Link href="/lab">← Lab 一覧</Link>
        </p>
      </header>

      <section className="klr-section">
        <h2>1. いま「かっこいい」文化系サイトの傾向</h2>
        <ul>
          <li>
            <strong>文化プラットフォーム化</strong>
            — 高級ブランドはEC本体とは別に、商品を並べない「知と美のハブ」を持つ。第一画面は在庫ではなく世界観。
          </li>
          <li>
            <strong>章立てスクロール</strong>
            — 博物館・デジタル展覧会型。章・停留・遷移で物語を読む（Balenciaga Museum 系の chaptered UX）。
          </li>
          <li>
            <strong>編集・ギャラリー優先</strong>
            — 検索よりキュレーション。作品／場／技法を「神聖なオブジェクト」として扱う。
          </li>
          <li>
            <strong>Museumcore × 触覚</strong>
            — 紙・インク・余白・セリフ書体。派手なドーパミン色やネオンは避ける方向と相性が良い。
          </li>
          <li>
            <strong>抑制されたモーション</strong>
            — 遅いフェード、パララックス最小、prefers-reduced-motion 尊重。速さより品位。
          </li>
        </ul>
      </section>

      <section className="klr-section">
        <h2>2. 「かっこよく見せる」実務ルール（本事業向け）</h2>
        <ol>
          <li>第一ビューはブランド名＋一句＋一つの視覚面。価格・柱の羅列は置かない。</li>
          <li>「間」をデザイン素材にする。余白を埋めないことが格調になる。</li>
          <li>書道家の固有名・師系は出さない。方向性（実力・鎌倉・丁寧な指導）だけ。</li>
          <li>縦書きはアクセントに限る。長文は横書きで可読性を守る。</li>
          <li>桜・鳥居・「Zen体験」のキッチュを避ける。鎌倉は海・石・寺社の光と影で示す。</li>
          <li>カード・角丸・影の層を増やさない。境界は線か余白で。</li>
          <li>朱は一点。インクは面。紙は空気。</li>
          <li>将来柱（インバウンド対面／ローカル大人／海外オンライン／作品物販）は「門」として後段に。</li>
        </ol>
      </section>

      <section className="klr-section">
        <h2>3. テイスト適合</h2>
        <p>
          文化事業の大きな括りを先に示し、現在のコアは書道、将来はインバウンド観光案内などへ広がる余白を残す。
          英語UIは事業上必要だが、サンプルではまず日本語で世界観を固め、切替は本番設計時に載せる想定です。
        </p>
      </section>

      <section className="klr-section">
        <h2>4. 画像サイズ・色彩・スマホ（今回の改修根拠）</h2>
        <ul>
          <li>
            <strong>画像が「巨大」に見える原因</strong>
            — ファイル容量だけでなく、全面カバー切り抜き（object-fit: cover）で作品が画面を占有し、比率もバラバラだったこと。美術館サイトでは作品はマット内に contain、雰囲気写真だけ高さを制限する。
          </li>
          <li>
            <strong>配信サイズ</strong>
            — ヒーロー／素材 ≤1600px・作品 ≤1200px に再圧縮（合計 roughly 10MB → 約4MB台）。遅延読込（lazy）と width/height 指定でレイアウトシフトを抑制。
          </li>
          <li>
            <strong>色彩の統一</strong>
            — ギャラリー系はニュートラル（紙・墨）＋一点アクセントが定石。3案とも同一トークン（ink / paper / mat / seal）に揃え、緑アクセント等の別系統を廃止。写真は軽く desaturate して紙墨へ寄せる。
          </li>
          <li>
            <strong>スマホ</strong>
            — 文化系サイトはモバイル比率が高い。1カラム、作品は横幅86%以内、雰囲気写真は高さ上限、下部ドック（問い合わせ／章ジャンプ）、safe-area 対応。PCは720px以上で2カラム復帰。
          </li>
        </ul>
      </section>

      <section className="klr-section klr-samples">
        <h2>5. サンプル三方向</h2>
        <p className="klr-note">
          仮ブランド「Kamakura Culture Studio」。作品は額装マット表示、素材は高さ制限。作者名・会名は出していません。共通CSS:{" "}
          <code>lab/_kamakura/tokens.css</code>
        </p>
        <div className="klr-grid">
          {samples.map((s) => (
            <Link key={s.href} href={s.href} className="klr-card">
              <span className="klr-code">{s.code}</span>
              <h3>{s.name}</h3>
              <p className="klr-one">{s.one}</p>
              <p>
                <span className="klr-label">適合</span>
                {s.fit}
              </p>
              <p>
                <span className="klr-label">注意</span>
                {s.risk}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="klr-foot">
        <p>次の一歩：殿下にご選択いただいた方向を、コピーと写真方針ごと本制作へ進めます。</p>
      </footer>
    </main>
  );
}
