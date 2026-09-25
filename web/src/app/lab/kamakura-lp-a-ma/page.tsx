import Link from "next/link";
import type { Metadata } from "next";
import "./ma.css";

export const metadata: Metadata = {
  title: "間 — Kamakura Culture Studio (Sample A)",
  description: "余白と章立てのLPサンプル（色・画像・モバイル調整）",
};

export default function SampleMaPage() {
  return (
    <div className="ma">
      <nav className="ma-nav" aria-label="Sample navigation">
        <Link href="/lab/kamakura-lp-research">Research</Link>
        <span>A · 間</span>
      </nav>

      <header className="ma-hero">
        <div className="ma-hero-media" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lab/kamakura-lp/materials/brush-ink.jpg"
            alt=""
            width={1600}
            height={1067}
          />
          <div className="ma-hero-veil" />
        </div>
        <div className="ma-hero-copy">
          <p className="ma-brand-en">Kamakura Culture Studio</p>
          <h1 className="ma-brand-ja" lang="ja">
            <span>鎌</span>
            <span>倉</span>
            <span>文</span>
            <span>化</span>
          </h1>
          <p className="ma-line">気品は、急がない。</p>
        </div>
        <div className="ma-scroll" aria-hidden>
          <span />
        </div>
      </header>

      <section className="ma-chapter">
        <p className="ma-num">01</p>
        <h2>場</h2>
        <p>
          海と石と、寺社の影。鎌倉という土地そのものが、書と対話の背景になる。
          私たちは文化を「見せる」より、「滞在させる」。
        </p>
      </section>

      <figure className="kcs-work kcs-work--portrait ma-block">
        <div className="kcs-work__mat">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lab/kamakura-lp/works/kamakura.jpg"
            alt="書作品：鎌倉の二字"
            width={1200}
            height={2134}
            loading="lazy"
          />
        </div>
        <figcaption>
          <span className="kcs-tag">Work</span>
          鎌倉
        </figcaption>
      </figure>

      <section className="ma-chapter ma-chapter-ink">
        <p className="ma-num">02</p>
        <h2>書</h2>
        <p>
          いまの芯は書道。対面の教室、海を越えたオンライン、そして一枚の作品として手元に残る書。
          指導にあたるのは、名を誇示しない実力の持ち主です。
        </p>
      </section>

      <div className="kcs-atmos ma-block" aria-hidden>
        <div className="kcs-atmos__frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lab/kamakura-lp/materials/tools-dark.jpg"
            alt=""
            width={1600}
            height={1067}
            loading="lazy"
          />
        </div>
      </div>

      <section className="ma-chapter">
        <p className="ma-num">03</p>
        <h2>門</h2>
        <ul className="ma-gates">
          <li>
            <strong>Inbound</strong>
            <span>旅の記憶としての対面書道</span>
          </li>
          <li>
            <strong>Local</strong>
            <span>鎌倉の大人のための教室</span>
          </li>
          <li>
            <strong>Online</strong>
            <span>海外から続く稽古（準備中）</span>
          </li>
          <li>
            <strong>Works</strong>
            <span>書を、生活の格に</span>
          </li>
        </ul>
      </section>

      <figure className="kcs-work kcs-work--portrait ma-block">
        <div className="kcs-work__mat">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lab/kamakura-lp/works/kohodenhi.jpg"
            alt="書作品：皇甫誕碑を臨書した縦書き四字"
            width={1200}
            height={1470}
            loading="lazy"
          />
        </div>
        <figcaption>
          <span className="kcs-tag">Work</span>
          臨書 · 皇甫誕碑
        </figcaption>
      </figure>

      <figure className="kcs-work ma-block">
        <div className="kcs-work__mat">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lab/kamakura-lp/works/single.jpg"
            alt="書作品：色紙の単字"
            width={1200}
            height={900}
            loading="lazy"
          />
        </div>
        <figcaption>
          <span className="kcs-tag">Work</span>
          色紙
        </figcaption>
      </figure>

      <section className="ma-chapter ma-close">
        <p className="ma-num">04</p>
        <h2>格調</h2>
        <p>
          派手さではなく、間。喧噪ではなく、一筆。ここから、文化事業は静かに拡がる。
        </p>
        <a className="ma-cta" href="#inquiry">
          お問い合わせ（仮）
        </a>
      </section>

      <footer className="ma-foot" id="inquiry">
        <p>Sample A · 作品は額装表示／素材は高さ制限</p>
        <p>
          <Link href="/lab/kamakura-lp-b-editorial">次へ：Editorial →</Link>
        </p>
      </footer>

      <div className="ma-dock" aria-hidden="false">
        <a href="#inquiry">お問い合わせ</a>
      </div>
    </div>
  );
}
