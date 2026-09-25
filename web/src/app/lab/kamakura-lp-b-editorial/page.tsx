import Link from "next/link";
import type { Metadata } from "next";
import "./editorial.css";

export const metadata: Metadata = {
  title: "Editorial — Kamakura Culture Studio (Sample B)",
  description: "雑誌／ギャラリー調LP（色・画像・モバイル調整）",
};

const works = [
  {
    src: "/lab/kamakura-lp/works/kamakura.jpg",
    title: "鎌倉",
    note: "揮毫",
    w: 1200,
    h: 2134,
    portrait: true,
  },
  {
    src: "/lab/kamakura-lp/works/kakuju.jpg",
    title: "鶴寿千歳",
    note: "色紙 · 表装",
    w: 1200,
    h: 900,
    portrait: false,
  },
  {
    src: "/lab/kamakura-lp/works/ju.jpg",
    title: "寿",
    note: "色紙",
    w: 1200,
    h: 900,
    portrait: false,
  },
  {
    src: "/lab/kamakura-lp/works/single.jpg",
    title: "単字",
    note: "色紙 · 表装",
    w: 1200,
    h: 900,
    portrait: false,
  },
  {
    src: "/lab/kamakura-lp/works/kohodenhi.jpg",
    title: "皇甫誕碑",
    note: "臨書",
    w: 1200,
    h: 1470,
    portrait: true,
  },
];

export default function SampleEditorialPage() {
  return (
    <div className="ed">
      <header className="ed-top">
        <Link href="/lab/kamakura-lp-research" className="ed-mark">
          KCS
        </Link>
        <nav className="ed-nav-desk">
          <a href="#culture">Culture</a>
          <a href="#gallery">Works</a>
          <a href="#doors">Doors</a>
        </nav>
        <span className="ed-badge">Sample B</span>
      </header>

      <section className="ed-masthead">
        <div className="ed-mast-copy">
          <p className="ed-issue">Vol. 00 · Prototype</p>
          <h1>
            <span className="ed-title-ja">鎌倉という編集</span>
            <span className="ed-title-en">Kamakura, curated</span>
          </h1>
          <p className="ed-dek">
            文化を商品棚にしない。土地・書・人のあいだを、一冊の雑誌のようにめくるランディング。
          </p>
        </div>
        <div className="ed-mast-visual">
          <div className="kcs-work__mat ed-mast-mat">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lab/kamakura-lp/works/kamakura.jpg"
              alt="書作品：鎌倉"
              width={1200}
              height={2134}
            />
          </div>
        </div>
      </section>

      <section className="ed-spread" id="culture">
        <div className="ed-col ed-col-text">
          <p className="ed-label">Essay</p>
          <h2>気品は、選択の結果である</h2>
          <p>
            大きな括りは文化事業。いまのコアは書道。やがてインバウンドの案内や、土地の読み解きへと門が増える。
            ただし第一画面に柱を並べない。最初に渡すのは、空気と視点だけ。
          </p>
        </div>
        <div className="ed-col ed-col-visual">
          <div className="kcs-atmos__frame ed-col-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lab/kamakura-lp/materials/tools-03.jpg"
              alt=""
              width={1600}
              height={1067}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="ed-gallery" id="gallery">
        <div className="ed-gallery-head">
          <p className="ed-label">Collection</p>
          <h2>作品</h2>
          <p className="ed-gallery-note">
            先生の実作です。額装マット内に収めて展示しています。作者名は掲載しません。
          </p>
        </div>
        <div className="ed-gallery-grid">
          {works.map((w) => (
            <figure
              key={w.src}
              className={`kcs-work${w.portrait ? " kcs-work--portrait" : ""}`}
            >
              <div className="kcs-work__mat">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w.src}
                  alt={`書作品：${w.title}`}
                  width={w.w}
                  height={w.h}
                  loading="lazy"
                />
              </div>
              <figcaption>
                <span className="kcs-tag">Work</span>
                <strong>{w.title}</strong>
                <span className="ed-piece-note">{w.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="ed-index" id="doors">
        <p className="ed-label">Contents</p>
        <h2>四つの門</h2>
        <ol>
          <li>
            <span className="ed-idx">01</span>
            <div>
              <h3>対面 · 旅人</h3>
              <p>鎌倉で、筆を持つ時間を旅の核にする。</p>
            </div>
          </li>
          <li>
            <span className="ed-idx">02</span>
            <div>
              <h3>対面 · 地元</h3>
              <p>大人のための、静かな稽古場。</p>
            </div>
          </li>
          <li>
            <span className="ed-idx">03</span>
            <div>
              <h3>オンライン</h3>
              <p>海の向こうからの継続（Coming soon）。</p>
            </div>
          </li>
          <li>
            <span className="ed-idx">04</span>
            <div>
              <h3>作品</h3>
              <p>書を、暮らしの格調として届ける。</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="ed-place" id="place">
        <div className="ed-place-media">
          <div className="kcs-atmos__frame ed-place-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lab/kamakura-lp/materials/process-kama.jpg"
              alt=""
              width={1200}
              height={2134}
              loading="lazy"
            />
          </div>
        </div>
        <div className="ed-place-inner">
          <p className="ed-label">Geography</p>
          <h2>なぜ鎌倉か</h2>
          <p>
            観光地としての記号ではなく、距離感と影の質。書の余白に似た都市の間合いが、ここにはある。
          </p>
          <p className="ed-aside">
            指導者の氏名は公開しません。実力は作品と時間で示す方針です。
          </p>
        </div>
      </section>

      <footer className="ed-foot">
        <p>Kamakura Culture Studio · Editorial</p>
        <p className="ed-links">
          <Link href="/lab/kamakura-lp-a-ma">← 間</Link>
          <Link href="/lab/kamakura-lp-c-monument">Monument →</Link>
        </p>
      </footer>

      <nav className="ed-dock" aria-label="Mobile sections">
        <a href="#gallery">作品</a>
        <a href="#doors">門</a>
        <a href="#place">鎌倉</a>
      </nav>
    </div>
  );
}
