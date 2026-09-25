import Link from "next/link";
import type { Metadata } from "next";
import "./monument.css";

export const metadata: Metadata = {
  title: "Ink Monument — Kamakura Culture Studio (Sample C)",
  description: "墨の記念碑LP（色・画像・モバイル調整）",
};

export default function SampleMonumentPage() {
  return (
    <div className="mn">
      <div className="mn-frame">
        <header className="mn-hero">
          <div className="mn-hero-bg" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lab/kamakura-lp/materials/tools-dark.jpg"
              alt=""
              width={1600}
              height={1067}
            />
          </div>
          <div className="mn-hero-inner">
            <p className="mn-kicker">Kamakura Culture Studio</p>
            <div className="mn-seal" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/lab/kamakura-lp/materials/atmosphere-a.jpg"
                alt=""
                width={400}
                height={300}
              />
            </div>
            <h1>
              沈黙の
              <br />
              実力
            </h1>
            <p className="mn-sub">
              名前を掲げず、一筆で語る。鎌倉を拠点とする文化事業の、いまの核は書。
            </p>
            <Link className="mn-ghost" href="/lab/kamakura-lp-research">
              Research hub
            </Link>
          </div>
        </header>

        <section className="mn-feature">
          <figure className="mn-feature-work">
            <div className="kcs-work__mat mn-feature-mat">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/lab/kamakura-lp/works/kamakura.jpg"
                alt="書作品：鎌倉"
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
          <div className="mn-feature-copy">
            <h2>墨は、権威ではなく密度</h2>
            <p>
              画面の大半を黒で占めるのは威圧のためではない。余白を切り取るための面。
              作品は広告素材ではなく、マットの中に収めて展示する対象です。
            </p>
          </div>
        </section>

        <section className="mn-pillars">
          <article>
            <div className="kcs-atmos__frame mn-pillar-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/lab/kamakura-lp/materials/process-kama.jpg"
                alt=""
                width={1200}
                height={2134}
                loading="lazy"
              />
            </div>
            <h3>Experience</h3>
            <p>インバウンドと地元大人のための対面。90分前後の、丁寧な時間。</p>
          </article>
          <article>
            <div className="kcs-atmos__frame mn-pillar-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/lab/kamakura-lp/materials/brush-writing.jpg"
                alt=""
                width={1200}
                height={1714}
                loading="lazy"
              />
            </div>
            <h3>Continuity</h3>
            <p>海外向けオンラインは準備中。距離を超えて続く稽古へ。</p>
          </article>
          <article>
            <div className="kcs-work__mat mn-pillar-mat">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/lab/kamakura-lp/works/kakuju.jpg"
                alt="書作品：鶴寿千歳"
                width={1200}
                height={900}
                loading="lazy"
              />
            </div>
            <h3>Object</h3>
            <p>書を物として届ける。暮らしに置く格調。</p>
          </article>
        </section>

        <section className="mn-quote">
          <blockquote>
            気品とは、足すことではなく、引いたあとに残るもの。
          </blockquote>
        </section>

        <section className="mn-cta-block" id="inquiry">
          <p>ご予約・ご相談は、公開時にここに導線を置きます。</p>
          <span className="mn-btn" aria-disabled>
            Inquire · soon
          </span>
        </section>

        <footer className="mn-foot">
          <span>Sample C · Ink Monument</span>
          <Link href="/lab/kamakura-lp-b-editorial">← Editorial</Link>
          <Link href="/lab">Lab</Link>
        </footer>
      </div>

      <div className="mn-dock">
        <a href="#inquiry">お問い合わせ</a>
      </div>
    </div>
  );
}
