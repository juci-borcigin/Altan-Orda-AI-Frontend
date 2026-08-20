"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { copy, type Locale } from "./copy";

const TOKENS = [
  { key: "ink", hex: "#111111", ja: "墨 · メイン" },
  { key: "ink-soft", hex: "#2a2a2a", ja: "薄墨 · サブ" },
  { key: "paper", hex: "#eae6e0", ja: "和紙 · ベース" },
  { key: "paper-lift", hex: "#f4f4f0", ja: "白紙 · 浮き面" },
  { key: "seal", hex: "#a84430", ja: "朱印 · アクセント" },
] as const;

function useLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocale] = useState<Locale>("ja");

  useEffect(() => {
    const saved = window.localStorage.getItem("ksif-locale");
    if (saved === "ja" || saved === "en") setLocale(saved);
  }, []);

  const set = (l: Locale) => {
    setLocale(l);
    window.localStorage.setItem("ksif-locale", l);
    document.documentElement.lang = l === "ja" ? "ja" : "en";
  };

  return [locale, set];
}

function useReveal(locale: Locale) {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const mark = (el: Element) => el.classList.add("is-in");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            mark(e.target);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    for (const n of nodes) {
      n.classList.remove("is-in");
      const rect = n.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) mark(n);
      else io.observe(n);
    }

    return () => io.disconnect();
  }, [locale]);
}

const NAV_IDS = [
  { key: "experience" as const, id: "experience" },
  { key: "flow" as const, id: "flow" },
  { key: "instructor" as const, id: "instructor" },
  { key: "details" as const, id: "details" },
  { key: "book" as const, id: "book" },
];

export function KamakuraInkFieldSite() {
  const [locale, setLocale] = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = copy[locale];
  useReveal(locale);

  useEffect(() => {
    if (!menuOpen) return;

    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    html.style.overflow = "hidden";

    const lab = document.querySelector<HTMLElement>(
      "div.flex.min-h-0.flex-1.flex-col.overflow-y-auto",
    );
    const prevLab = lab?.style.overflowY ?? "";
    if (lab) lab.style.overflowY = "hidden";

    return () => {
      html.style.overflow = prevHtml;
      if (lab) lab.style.overflowY = prevLab;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`ksif${menuOpen ? " is-menu-open" : ""}`} data-locale={locale}>
      <div className="ksif-noise" aria-hidden />

      <aside className="ksif-labbar" aria-label="実験室メタ">
        <p>
          <Link href="/lab">← 実験室</Link>
          <span> · </span>
          <Link href="/lab/kamakura-shodo-design">3案比較</Link>
        </p>
        <p className="ksif-labbar-note">
          正本Docから掲載候補を反映 · ヒーローはPC/スマホ別画像 · 仮説注記あり
        </p>
        <div className="ksif-tokens">
          {TOKENS.map((tok) => (
            <div key={tok.key} className="ksif-token" title={tok.hex}>
              <span className="ksif-swatch" style={{ background: tok.hex }} />
              <span className="ksif-token-name">
                <code>{tok.key}</code> {tok.ja}
              </span>
            </div>
          ))}
        </div>
      </aside>

      <div className="ksif-site">
        <header className="ksif-top">
          <a className="ksif-logo" href="#top" onClick={closeMenu}>
            <span className="ksif-logo-mark" aria-hidden />
            <span className="ksif-logo-text">
              Kamakura
              <em>Culture Studio</em>
            </span>
          </a>
          <nav className="ksif-nav ksif-nav-desktop" aria-label="Primary">
            {NAV_IDS.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {t.nav[item.key]}
              </a>
            ))}
          </nav>
          <div className="ksif-top-actions">
            <div className="ksif-lang" role="group" aria-label={t.langLabel}>
              <button
                type="button"
                className={locale === "ja" ? "is-active" : undefined}
                onClick={() => setLocale("ja")}
                aria-pressed={locale === "ja"}
              >
                JP
              </button>
              <button
                type="button"
                className={locale === "en" ? "is-active" : undefined}
                onClick={() => setLocale("en")}
                aria-pressed={locale === "en"}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              className="ksif-burger"
              aria-expanded={menuOpen}
              aria-controls="ksif-mobile-panel"
              aria-label={menuOpen ? t.menuClose : t.menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </header>

        <div
          id="ksif-mobile-panel"
          className="ksif-mobile-panel"
          hidden={!menuOpen}
          aria-hidden={!menuOpen}
        >
          <nav className="ksif-nav-mobile" aria-label="Mobile">
            {NAV_IDS.map((item) => (
              <a key={item.id} href={`#${item.id}`} onClick={closeMenu}>
                {t.nav[item.key]}
              </a>
            ))}
          </nav>
          <a className="ksif-cta ksif-cta-mobile-menu" href="#book" onClick={closeMenu}>
            {t.hero.cta}
          </a>
        </div>
        {menuOpen ? (
          <button type="button" className="ksif-scrim" aria-label={t.menuClose} onClick={closeMenu} />
        ) : null}

        <section id="top" className="ksif-hero">
          <picture className="ksif-hero-picture">
            <source
              media="(max-width: 859px)"
              srcSet="/lab/kamakura-shodo/hero-mobile.jpg"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="ksif-hero-photo"
              src="/lab/kamakura-shodo/hero-desktop.jpg"
              alt={t.hero.photoAlt}
              width={1536}
              height={1024}
              fetchPriority="high"
            />
          </picture>
          <div className="ksif-hero-veil" aria-hidden />
          <p className="ksif-tategaki" aria-hidden>
            {t.hero.vertical}
          </p>
          <div className="ksif-hero-main">
            <p className="ksif-eyebrow">{t.hero.eyebrow}</p>
            <h1 className="ksif-brand">
              <span>Kamakura</span>
              <span>Culture Studio</span>
            </h1>
            <p className="ksif-headline">{t.hero.headline}</p>
            <p className="ksif-lead">{t.hero.lead}</p>
            <div className="ksif-hero-actions">
              <a className="ksif-cta" href="#book">
                {t.hero.cta}
              </a>
              <a className="ksif-ghost" href="#experience">
                {t.hero.secondary}
              </a>
            </div>
          </div>
          <div className="ksif-hero-meta" aria-hidden>
            <span>Kamakura</span>
            <span className="ksif-meta-line" />
            <span>Shodō</span>
          </div>
        </section>

        <div className="ksif-marquee" aria-hidden>
          <div className="ksif-marquee-track">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i}>
                {t.marquee} <i>/</i>
              </span>
            ))}
          </div>
        </div>

        <section id="experience" className="ksif-section ksif-experience" data-reveal>
          <div className="ksif-section-head">
            <p className="ksif-kicker">{t.experience.kicker}</p>
            <h2>{t.experience.title}</h2>
          </div>
          <p className="ksif-body">{t.experience.body}</p>
          <ul className="ksif-values">
            {t.experience.values.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </section>

        <section className="ksif-section ksif-audience" data-reveal>
          <div className="ksif-audience-grid">
            <div className="ksif-audience-visual" aria-hidden>
              <div className="ksif-ink-orb" />
              <div className="ksif-ink-slash" />
            </div>
            <div>
              <p className="ksif-kicker">{t.audience.kicker}</p>
              <h2>{t.audience.title}</h2>
              <ul className="ksif-points">
                {t.audience.points.map((p) => (
                  <li key={p}>
                    <span className="ksif-dot" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="flow" className="ksif-section ksif-flow" data-reveal>
          <p className="ksif-kicker">{t.flow.kicker}</p>
          <h2>{t.flow.title}</h2>
          <p className="ksif-body">{t.flow.lead}</p>
          <ol className="ksif-steps ksif-steps-timed">
            {t.flow.steps.map((step, i) => (
              <li key={step.text}>
                <span className="ksif-step-num">0{i + 1}</span>
                <div>
                  <p className="ksif-step-time">{step.time}</p>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ksif-section ksif-includes" data-reveal>
          <p className="ksif-kicker">{t.includes.kicker}</p>
          <h2>{t.includes.title}</h2>
          <ul className="ksif-include-list">
            {t.includes.items.map((item) => (
              <li key={item}>
                <span className="ksif-dot" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <ul className="ksif-include-notes">
            {t.includes.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>

        <section id="instructor" className="ksif-section ksif-instructor" data-reveal>
          <p className="ksif-kicker">{t.instructor.kicker}</p>
          <h2>{t.instructor.title}</h2>
          <p className="ksif-body">{t.instructor.body}</p>
          <ul className="ksif-points">
            {t.instructor.points.map((p) => (
              <li key={p}>
                <span className="ksif-dot" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <p className="ksif-footnote">{t.instructor.note}</p>
        </section>

        <section id="online" className="ksif-section ksif-online" data-reveal>
          <p className="ksif-online-badge">{t.online.badge}</p>
          <p className="ksif-kicker">{t.online.kicker}</p>
          <h2>{t.online.title}</h2>
          <p className="ksif-body">{t.online.body}</p>
          <ul className="ksif-points">
            {t.online.points.map((p) => (
              <li key={p}>
                <span className="ksif-dot" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section id="details" className="ksif-section ksif-details" data-reveal>
          <p className="ksif-kicker">{t.details.kicker}</p>
          <h2>{t.details.title}</h2>
          <dl className="ksif-facts">
            {t.details.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="ksif-footnote">{t.details.note}</p>
        </section>

        <section id="book" className="ksif-section ksif-book" data-reveal>
          <div className="ksif-book-panel">
            <p className="ksif-kicker ksif-kicker-light">{t.book.kicker}</p>
            <h2>{t.book.title}</h2>
            <p className="ksif-body ksif-body-light">{t.book.body}</p>
            <a className="ksif-cta ksif-cta-lift" href="#book">
              {t.book.cta}
            </a>
          </div>
        </section>

        <footer className="ksif-footer">
          <p className="ksif-brand-foot">Kamakura Culture Studio</p>
          <p>{t.footer}</p>
        </footer>

        <div className="ksif-dock">
          <a className="ksif-dock-cta" href="#book">
            {t.hero.cta}
          </a>
        </div>
      </div>
    </div>
  );
}
