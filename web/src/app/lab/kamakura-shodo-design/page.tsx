import Link from "next/link";
import "./kamakura-design.css";

export const metadata = {
  title: "鎌倉書道 · デザイン3案 | 実験室",
  description: "海外向け書道体験ホームページのビジュアル案と競合比較",
};

type ConceptId = "a" | "b" | "c";

const CONCEPTS: Array<{
  id: ConceptId;
  name: string;
  en: string;
  pitch: string;
  palette: string[];
  type: string;
}> = [
  {
    id: "a",
    name: "Coastal Mist",
    en: "海霧と墨",
    pitch: "鎌倉の海と霧を全面ビジュアルに。ブランド名を第一視認、CTAは一つだけ。",
    palette: ["#0c1c28", "#4a6a7a", "#c8d6de", "#f2f5f7", "#8fa8a0"],
    type: "Shippori Mincho + DM Sans",
  },
  {
    id: "b",
    name: "Garden Light",
    en: "庭の光",
    pitch: "寺社の緑陰と石畳の明るさ。静かだが旅行商品として予約しやすい構成。",
    palette: ["#1a2e24", "#3d5c4a", "#a8b89a", "#e8ebe4", "#5c6b8a"],
    type: "Zen Maru Gothic + Fraunces",
  },
  {
    id: "c",
    name: "Ink Field",
    en: "墨の地",
    pitch: "大きな筆致をヒーロー面そのものに。余白と朱印で現代美術寄りの印象。",
    palette: ["#111111", "#2a2a2a", "#eae6df", "#f7f4ef", "#b83a2a"],
    type: "Noto Serif JP + Syne",
  },
];

const COMPETITORS = [
  {
    name: "Kamakura Experience\n（Meditative Calligraphy）",
    type: "インバウンド体験",
    price: "¥22,000 /人",
    duration: "2.5h",
    cap: "最大4名",
    channel: "自社サイト",
    angle: "マインドフルネス・禅",
    site: "英文サイト、写真中心、予約フォーム",
    note: "価格帯が近い上位競合。HPは説明文が長く、ブランドより「体験説明」が前面。",
  },
  {
    name: "Airbnb\n古民家ヒーリング書道",
    type: "インバウンド体験",
    price: "¥5,000〜 /人",
    duration: "短〜中",
    cap: "最大2名",
    channel: "Airbnb",
    angle: "古民家・癒し・創作",
    site: "OTAカード型（独自HP弱）",
    note: "評価高・低価格で入口を取る。独自ブランドサイトでの差別化余地が大きい。",
  },
  {
    name: "Wabunka\n旧村上邸・白石雪妃",
    type: "ラグジュアリー体験",
    price: "¥26,000〜 /人",
    duration: "プライベート",
    cap: "1〜4名",
    channel: "Wabunka",
    angle: "百年邸宅・著名書家",
    site: "高級プラットフォームUI",
    note: "会場とネームバリューで上位価格。自社は名跡非公開方針のため、会場・空気感で対抗。",
  },
  {
    name: "Airbnb\nカフェ書道",
    type: "カジュアル体験",
    price: "¥3,000 /人",
    duration: "短時間",
    cap: "少人数",
    channel: "Airbnb",
    angle: "漢字で名前・手軽",
    site: "OTAのみ",
    note: "価格帯が違う市場。自社想定¥15,000とは直接競合しにくい。",
  },
  {
    name: "篠原遙己 / 玉風会 等\n地域教室",
    type: "地域教室（月謝）",
    price: "月¥6,000台〜",
    duration: "継続",
    cap: "生徒制",
    channel: "自社HP・口コミ",
    angle: "通いの習い事",
    site: "和風・教室案内型",
    note: "事業計画どおり教室市場は見送り。HPの参照対象は体験系に絞る。",
  },
];

function ConceptFrame({ id }: { id: ConceptId }) {
  if (id === "a") {
    return (
      <div className="ksd-frame ksd-a" aria-label="Coastal Mist mock">
        <div className="ksd-a-hero">
          <div className="ksd-a-mist" aria-hidden />
          <nav className="ksd-a-nav">
            <span className="ksd-ph ksd-ph-sm" style={{ width: "3.5rem" }} />
            <span className="ksd-ph ksd-ph-sm" style={{ width: "2.5rem" }} />
          </nav>
          <div className="ksd-a-brand-block">
            <p className="ksd-a-brand-jp">鎌倉書</p>
            <p className="ksd-a-brand-en">KAMAKURA SHODO</p>
            <div className="ksd-ph ksd-ph-line" style={{ width: "42%", marginTop: "1.1rem" }} />
            <div className="ksd-ph ksd-ph-line" style={{ width: "28%", marginTop: "0.55rem" }} />
            <div className="ksd-a-cta">
              <span className="ksd-ph ksd-ph-btn" />
            </div>
          </div>
          <div className="ksd-a-ink-stroke" aria-hidden />
        </div>
        <section className="ksd-a-band">
          <div className="ksd-ph ksd-ph-line" style={{ width: "30%" }} />
          <div className="ksd-a-strip">
            <div className="ksd-a-strip-cell" />
            <div className="ksd-a-strip-cell" />
            <div className="ksd-a-strip-cell" />
          </div>
        </section>
      </div>
    );
  }

  if (id === "b") {
    return (
      <div className="ksd-frame ksd-b" aria-label="Garden Light mock">
        <div className="ksd-b-hero">
          <div className="ksd-b-photo" aria-hidden />
          <div className="ksd-b-overlay">
            <p className="ksd-b-brand">Kamakura Shodo</p>
            <div className="ksd-ph ksd-ph-line ksd-b-head" style={{ width: "55%" }} />
            <div className="ksd-ph ksd-ph-line" style={{ width: "38%", marginTop: "0.65rem" }} />
            <div className="ksd-b-ctas">
              <span className="ksd-ph ksd-ph-btn" />
              <span className="ksd-ph ksd-ph-btn ksd-ph-btn-ghost" />
            </div>
          </div>
        </div>
        <section className="ksd-b-section">
          <div className="ksd-ph ksd-ph-line" style={{ width: "22%" }} />
          <div className="ksd-b-row">
            <div className="ksd-b-media" />
            <div className="ksd-b-copy">
              <div className="ksd-ph ksd-ph-line" style={{ width: "70%" }} />
              <div className="ksd-ph ksd-ph-line" style={{ width: "90%", marginTop: "0.5rem" }} />
              <div className="ksd-ph ksd-ph-line" style={{ width: "60%", marginTop: "0.5rem" }} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="ksd-frame ksd-c" aria-label="Ink Field mock">
      <div className="ksd-c-hero">
        <svg className="ksd-c-stroke" viewBox="0 0 800 520" aria-hidden>
          <path
            d="M120 80 C180 200 140 320 210 420 M240 60 C200 180 280 260 250 400 M420 40 C380 160 460 280 400 460 M560 90 C620 200 540 300 600 430 M680 50 C640 170 720 290 670 450"
            fill="none"
            stroke="currentColor"
            strokeWidth="28"
            strokeLinecap="round"
            opacity="0.92"
          />
        </svg>
        <div className="ksd-c-content">
          <div className="ksd-c-seal" aria-hidden />
          <p className="ksd-c-brand">KAMAKURA</p>
          <p className="ksd-c-brand-sub">SHODO EXPERIENCE</p>
          <div className="ksd-ph ksd-ph-line ksd-c-line" style={{ width: "36%" }} />
          <div className="ksd-c-cta">
            <span className="ksd-ph ksd-ph-btn ksd-c-btn" />
          </div>
        </div>
      </div>
      <section className="ksd-c-foot">
        <div className="ksd-ph ksd-ph-line" style={{ width: "18%" }} />
        <div className="ksd-c-grid">
          <div />
          <div />
          <div />
          <div />
        </div>
      </section>
    </div>
  );
}

export default function KamakuraShodoDesignPage() {
  return (
    <main className="ksd">
      <header className="ksd-top">
        <p className="ksd-kicker">
          <Link href="/lab">← 実験室</Link>
          <span> · 鎌倉書道</span>
        </p>
        <h1>ホームページ デザイン3案</h1>
        <p className="ksd-lead">
          本文は入れていない。構成・色・余白・第一ビューの印象だけを比較するサンプル。
          想定は海外顧客向け書道体験（主柱）の英語サイト。
        </p>
      </header>

      <nav className="ksd-jump" aria-label="案へのジャンプ">
        {CONCEPTS.map((c) => (
          <a key={c.id} href={`#concept-${c.id}`}>
            {c.id.toUpperCase()}. {c.name}
          </a>
        ))}
        <a href="#competitors">競合比較</a>
      </nav>

      {CONCEPTS.map((c) => (
        <section key={c.id} id={`concept-${c.id}`} className="ksd-concept">
          <div className="ksd-concept-meta">
            <p className="ksd-concept-id">案 {c.id.toUpperCase()}</p>
            <h2>
              {c.name}
              <span>{c.en}</span>
            </h2>
            <p>{c.pitch}</p>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{c.type}</dd>
              </div>
              <div>
                <dt>Palette</dt>
                <dd className="ksd-swatches">
                  {c.palette.map((hex) => (
                    <span key={hex} title={hex} style={{ background: hex }} />
                  ))}
                </dd>
              </div>
            </dl>
          </div>
          <ConceptFrame id={c.id} />
        </section>
      ))}

      <section id="competitors" className="ksd-comp">
        <h2>有力競合との比較</h2>
        <p className="ksd-comp-lead">
          自社の主戦場は「鎌倉×外国人向け書道体験」。教室（月謝）ではなく体験商品として並べる。
          想定価格の検証軸は <strong>¥15,000 /人</strong>。
        </p>

        <div className="ksd-table-wrap">
          <table className="ksd-table">
            <thead>
              <tr>
                <th>競合</th>
                <th>種別</th>
                <th>価格目安</th>
                <th>時間 / 定員</th>
                <th>販路</th>
                <th>訴求</th>
                <th>サイト印象</th>
                <th>示唆</th>
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((row) => (
                <tr key={row.name}>
                  <td className="ksd-td-name">{row.name}</td>
                  <td>{row.type}</td>
                  <td>{row.price}</td>
                  <td>
                    {row.duration}
                    <br />
                    {row.cap}
                  </td>
                  <td>{row.channel}</td>
                  <td>{row.angle}</td>
                  <td>{row.site}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
              <tr className="ksd-td-ours">
                <td className="ksd-td-name">自社（想定）</td>
                <td>インバウンド体験</td>
                <td>¥15,000 /人（検証中）</td>
                <td>未確定</td>
                <td>自社HP + OTA</td>
                <td>本物の書・鎌倉の空気</td>
                <td>今回の3案で検証</td>
                <td>
                  低価格Airbnbより上、¥22k〜26kより手が届く中位。独自HPで「空気感」と予約導線を握るのが差別化。
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ksd-takeaways">
          <h3>デザインへの示唆</h3>
          <ul>
            <li>
              <strong>案A Coastal Mist</strong> — Airbnb低価格帯との差を「場所の格」で見せる。海・霧のフルブリードで旅行前の期待感を作る。
            </li>
            <li>
              <strong>案B Garden Light</strong> — Kamakura Experience系の英文体験サイトに近い読みやすさ。予約CTAをはっきり出し、OTA依存を下げる。
            </li>
            <li>
              <strong>案C Ink Field</strong> — Wabunka級の「アート体験」印象を会場なしでも出す。名跡を出さない前提で、筆致そのものが看板になる。
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
