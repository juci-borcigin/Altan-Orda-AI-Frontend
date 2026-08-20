"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CourseMaster } from "@/lib/course-maker/course-master-schema";
import {
  getSectionMarkdown,
  visualForHero,
  visualHasArtifact,
  type VisualRow,
} from "@/lib/course-maker/course-admin-view";
import { fetchVisualBySlot } from "@/lib/course-maker/course-visual-client";
import { readingMinutesForSession } from "@/lib/course-maker/course-master-schema";
import { IcoArrowLeft } from "@/components/ao-action-icons";
import { AoTemplateFrame } from "@/components/ao-phase5/AoTemplateFrame";
import {
  AO_BTN_CLASS,
  AO_BTN_SELECTED_CLASS,
  AO_NAV_BACK_BTN_CLASS,
} from "@/lib/template/ao-chrome";

export type CourseLearnVariant = "admin" | "public";
export type CourseLearnUi = "generic" | "ao";

type CourseLearnViewProps = {
  courseId: string;
  variant: CourseLearnVariant;
  /** false で文末チャットを隠す（AO シェル第1弾など） */
  showSessionChat?: boolean;
  /**
   * generic＝Generic CSS（`/courses`・`/l`）。
   * ao＝AO テンプレ部品のみ（シェル内ナレッジ）。本文データは同じ。
   */
  ui?: CourseLearnUi;
  /** AO 使用面：親（巻物）から全体構成の開閉を制御するとき渡す */
  outlineOpen?: boolean;
  onOutlineOpenChange?: (open: boolean) => void;
};

type Session = {
  session_no: number;
  status: string;
  markdown_body: string | null;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

/** 画面側で h2 を出すため、本文先頭の ## 見出しを落とす */
function stripLeadingHeading(md: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return md
    .replace(new RegExp(`^##\\s+${escaped}\\s*\\n+`, "m"), "")
    .replace(/^##\s+.+\n+/, "")
    .trim();
}

function SectionBody({ text }: { text: string }) {
  return (
    <div className="cm-body cm-learn-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function SectionFigure({
  url,
  attribution,
  pageUrl,
  alt,
  side,
  frameD,
}: {
  url: string;
  attribution?: string | null;
  pageUrl?: string | null;
  alt: string;
  side: "left" | "right";
  frameD?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  if (broken) return null;
  const hasCredit = Boolean(attribution || pageUrl);
  return (
    <>
      <figure
        className={`cm-learn-section-figure${side === "right" ? " is-right" : ""}`}
      >
        <button
          type="button"
          className="cm-learn-section-figure-btn"
          onClick={() => setExpanded(true)}
          aria-label={`${alt}を拡大表示`}
        >
          {frameD ? (
            <AoTemplateFrame
              preset="frame_D"
              style={{ width: 212, height: 162, display: "block" }}
              contentClassName="relative overflow-hidden p-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={alt}
                width={200}
                height={150}
                onError={() => setBroken(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </AoTemplateFrame>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={alt}
                width={200}
                height={150}
                onError={() => setBroken(true)}
              />
            </>
          )}
        </button>
        {hasCredit && (
          <details className="cm-learn-attr-tip">
            <summary title="出典">i</summary>
            <div className="cm-learn-attr-panel">
              {attribution ? <div>{attribution}</div> : null}
              {pageUrl ? (
                <div style={{ marginTop: attribution ? "0.35rem" : 0 }}>
                  <a href={pageUrl} target="_blank" rel="noreferrer">
                    Wikimedia で見る
                  </a>
                </div>
              ) : null}
            </div>
          </details>
        )}
      </figure>
      {expanded ? (
        <div
          className="cm-learn-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${alt}の拡大表示`}
          onClick={() => setExpanded(false)}
        >
          <div
            className="cm-learn-lightbox-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="cm-learn-lightbox-close"
              onClick={() => setExpanded(false)}
              aria-label="閉じる"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cm-learn-lightbox-img" src={url} alt={alt} />
            {hasCredit ? (
              <div className="cm-learn-lightbox-credit">
                {attribution ? <p>{attribution}</p> : null}
                {pageUrl ? (
                  <p>
                    <a href={pageUrl} target="_blank" rel="noreferrer">
                      Wikimedia で見る
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function HeroImage({
  courseId,
  sessionNo,
  hasArtifact,
  alt,
  apiBase,
}: {
  courseId: string;
  sessionNo: number;
  hasArtifact: boolean;
  alt: string;
  apiBase: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasArtifact) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void fetchVisualBySlot(courseId, sessionNo, `hero_s${sessionNo}`, { apiBase }).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, sessionNo, hasArtifact, apiBase]);

  if (!hasArtifact) {
    return <div className="cm-learn-hero-empty">回メイン画像はまだありません</div>;
  }
  if (!url) return <div className="cm-learn-hero-empty">画像を読み込み中…</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="cm-learn-hero-img" src={url} alt={alt} />;
}

export function CourseLearnView({
  courseId,
  variant,
  showSessionChat = true,
  ui = "generic",
  outlineOpen: outlineOpenProp,
  onOutlineOpenChange,
}: CourseLearnViewProps) {
  const apiBase =
    variant === "public" ? `/api/l/${courseId}` : `/api/courses/${courseId}`;
  const [title, setTitle] = useState("");
  const [master, setMaster] = useState<CourseMaster | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [visuals, setVisuals] = useState<VisualRow[]>([]);
  const [sessionNo, setSessionNo] = useState(1);
  const [outlineOpenInner, setOutlineOpenInner] = useState(false);
  const outlineControlled = outlineOpenProp !== undefined;
  const outlineOpen = outlineControlled ? outlineOpenProp : outlineOpenInner;
  const setOutlineOpen = onOutlineOpenChange ?? setOutlineOpenInner;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [progressReady, setProgressReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setProgressReady(false);
    try {
      const res = await fetch(apiBase);
      const json = (await res.json()) as {
        course?: {
          title: string;
          course_master: CourseMaster | null;
          last_opened_session_no: number | null;
        };
        sessions?: Session[];
        visuals?: VisualRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setTitle(json.course?.title ?? "");
      setMaster(json.course?.course_master ?? null);
      setSessions(json.sessions ?? []);
      setVisuals(json.visuals ?? []);
      const start = json.course?.last_opened_session_no ?? 1;
      setSessionNo(start);
      setProgressReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!progressReady) return;
    const progressUrl =
      variant === "public" ? `${apiBase}/progress` : apiBase;
    void fetch(progressUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_opened_session_no: sessionNo }),
    });
  }, [apiBase, sessionNo, variant, progressReady]);

  useEffect(() => {
    // 回切替で履歴を空にしたときは動かさない（文末へ飛んでしまう）
    if (chatMsgs.length === 0) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  useEffect(() => {
    if (!outlineOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOutlineOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [outlineOpen, setOutlineOpen]);

  const readySessions = useMemo(
    () => sessions.filter((s) => s.status === "ready").sort((a, b) => a.session_no - b.session_no),
    [sessions],
  );

  const sessionMaster = master?.sessions.find((s) => s.session_no === sessionNo);
  const sections = useMemo(
    () => [...(sessionMaster?.sections ?? [])].sort((a, b) => a.section_no - b.section_no),
    [sessionMaster],
  );
  /** content 画像の出現順で左右を交代（左→右→左…） */
  const sectionImageSide = useMemo(() => {
    const map = new Map<number, "left" | "right">();
    let i = 0;
    for (const sec of sections) {
      if (sec.role === "content" && sec.image_url) {
        map.set(sec.section_no, i % 2 === 0 ? "left" : "right");
        i += 1;
      }
    }
    return map;
  }, [sections]);
  const currentSession = sessions.find((s) => s.session_no === sessionNo);
  const hero = visualForHero(visuals, sessionNo);

  const readyIdx = readySessions.findIndex((s) => s.session_no === sessionNo);
  const prevReady = readyIdx > 0 ? readySessions[readyIdx - 1] : null;
  const nextReady =
    readyIdx >= 0 && readyIdx < readySessions.length - 1 ? readySessions[readyIdx + 1] : null;

  function goSession(n: number) {
    setSessionNo(n);
    setChatMsgs([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q || chatBusy) return;
    setChatInput("");
    const history = chatMsgs.map((m) => ({ role: m.role, content: m.content }));
    setChatMsgs((m) => [...m, { role: "user", content: q }]);
    setChatBusy(true);
    try {
      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_no: sessionNo,
          section_no: sections[sections.length - 1]?.section_no ?? 1,
          message: q,
          history,
        }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      setChatMsgs((m) => [...m, { role: "assistant", content: json.reply ?? json.error ?? "（応答なし）" }]);
    } catch (err) {
      setChatMsgs((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  const ao = ui === "ao";
  const btn = ao ? AO_BTN_CLASS : "cm-btn";
  const btnPrimary = ao ? AO_BTN_CLASS : "cm-btn cm-btn-primary";
  const tabClass = (on: boolean) =>
    ao
      ? `${AO_BTN_CLASS}${on ? ` ${AO_BTN_SELECTED_CLASS}` : ""}`
      : `cm-session-tab ${on ? "active" : ""}`;

  if (loading) return <p className="cm-muted">読み込み中…</p>;
  if (error) return <div className="cm-error">{error}</div>;

  const outlineNav = (tone: "generic" | "ao") => (
    <nav
      className={
        tone === "ao" ? "min-h-0 flex-1 overflow-y-auto px-1 py-1" : "cm-learn-outline"
      }
    >
      {(master?.sessions ?? []).map((s) => (
        <div
          key={s.session_no}
          className={tone === "ao" ? "mb-3" : "cm-learn-outline-session"}
        >
          <button
            type="button"
            className={
              tone === "ao"
                ? `w-full border-0 bg-transparent text-left font-ao-serif text-ao-heading-2 text-ao-ink ${
                    sessionNo === s.session_no ? "font-semibold" : "font-normal"
                  }`
                : `cm-learn-outline-session-btn ${sessionNo === s.session_no ? "active" : ""}`
            }
            onClick={() => {
              goSession(s.session_no);
              setOutlineOpen(false);
            }}
          >
            第{s.session_no}回 {s.title}
          </button>
          <ul className={tone === "ao" ? "mt-1 list-none pl-2" : undefined}>
            {s.sections.map((sec) => (
              <li key={sec.section_no}>
                <a
                  href={`#sec-${sec.section_no}`}
                  className={
                    tone === "ao"
                      ? "block py-0.5 font-ao-serif text-ao-label text-ao-ink-muted no-underline hover:text-ao-ink"
                      : undefined
                  }
                  onClick={() => {
                    if (sessionNo !== s.session_no) goSession(s.session_no);
                    setOutlineOpen(false);
                  }}
                >
                  {sec.section_no}. {sec.heading}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className={`cm-learn-wrap${ao ? " relative" : ""}`}>
      {!ao ? (
        <>
          <aside className={`cm-learn-drawer ${outlineOpen ? "open" : ""}`} aria-hidden={!outlineOpen}>
            <div className="cm-learn-drawer-head">
              <strong>講義全体構成</strong>
              <button type="button" className={btn} onClick={() => setOutlineOpen(false)}>
                閉じる
              </button>
            </div>
            {outlineNav("generic")}
          </aside>
          {outlineOpen ? (
            <button
              type="button"
              className="cm-learn-drawer-backdrop"
              aria-label="構成を閉じる"
              onClick={() => setOutlineOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      {ao && outlineOpen ? (
        <div className="cm-learn-main">
          <AoTemplateFrame
            preset="frame_AS"
            className="w-full"
            contentClassName="flex flex-col"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-2">
              <p className="m-0 font-ao-serif text-ao-heading-3 font-semibold">
                講義全体構成
              </p>
              <button
                type="button"
                className={AO_NAV_BACK_BTN_CLASS}
                aria-label="戻る"
                onClick={() => setOutlineOpen(false)}
              >
                <IcoArrowLeft size={14} className="shrink-0" />
              </button>
            </div>
            {outlineNav("ao")}
          </AoTemplateFrame>
        </div>
      ) : null}

      <div className={`cm-learn-main${ao && outlineOpen ? " hidden" : ""}`}>
        {!ao ? (
          <div className="cm-learn-topbar">
            <button type="button" className={btn} onClick={() => setOutlineOpen(true)}>
              構成
            </button>
            {variant === "admin" ? (
              <Link href={`/courses/${courseId}`} className="cm-btn">
                ← 管理画面
              </Link>
            ) : null}
          </div>
        ) : null}

        <p
          className={
            ao
              ? "cm-learn-course-title font-ao-serif text-ao-heading-1 font-bold text-ao-ink"
              : "cm-learn-course-title"
          }
        >
          {title}
        </p>

        <div className={`cm-session-tabs${ao ? " flex flex-wrap gap-1" : ""}`}>
          {readySessions.map((s) => (
            <button
              key={s.session_no}
              type="button"
              className={tabClass(sessionNo === s.session_no)}
              onClick={() => goSession(s.session_no)}
            >
              第{s.session_no}回
            </button>
          ))}
        </div>

        {sessionMaster && (
          <header className="cm-learn-article-head">
            <h1
              className={
                ao
                  ? "font-ao-serif text-ao-heading-1 font-normal text-ao-ink"
                  : "cm-learn-session-title"
              }
            >
              第{sessionNo}回 {sessionMaster.title}
            </h1>
            <p className="cm-muted">
              読了目安 約{readingMinutesForSession(master?.meta.target_chars_per_session)}分
              {sessionMaster.objectives.length > 0
                ? ` · ${sessionMaster.objectives.join(" · ")}`
                : ""}
            </p>
          </header>
        )}

        <div className="cm-learn-hero">
          {ao ? (
            <AoTemplateFrame
              preset="frame_AS"
              className="w-full max-w-[820px]"
              contentClassName="overflow-hidden p-0"
            >
              <HeroImage
                courseId={courseId}
                sessionNo={sessionNo}
                hasArtifact={visualHasArtifact(hero)}
                alt={sessionMaster?.title ?? `第${sessionNo}回`}
                apiBase={apiBase}
              />
            </AoTemplateFrame>
          ) : (
            <HeroImage
              courseId={courseId}
              sessionNo={sessionNo}
              hasArtifact={visualHasArtifact(hero)}
              alt={sessionMaster?.title ?? `第${sessionNo}回`}
              apiBase={apiBase}
            />
          )}
        </div>

        {sections.length > 0 && (
          ao ? (
            <AoTemplateFrame
              preset="frame_C"
              className="mb-4 w-full max-w-[820px]"
              contentClassName="px-1 py-1"
            >
              <nav className="cm-learn-toc" aria-label="この回の目次" style={{ margin: 0 }}>
                <strong className="font-ao-serif text-ao-heading-3 text-ao-ink">この回の目次</strong>
                <ol className="font-ao-serif text-ao-label text-ao-ink">
                  {sections.map((sec) => (
                    <li key={sec.section_no}>
                      <a href={`#sec-${sec.section_no}`}>{sec.heading}</a>
                    </li>
                  ))}
                </ol>
                <div className="cm-learn-toc-nav">
                  <button
                    type="button"
                    className={btn}
                    disabled={!prevReady}
                    onClick={() => prevReady && goSession(prevReady.session_no)}
                  >
                    前回
                  </button>
                  <button
                    type="button"
                    className={btn}
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  >
                    この回の先頭
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={!nextReady}
                    onClick={() => nextReady && goSession(nextReady.session_no)}
                  >
                    次回
                  </button>
                </div>
              </nav>
            </AoTemplateFrame>
          ) : (
          <nav className="cm-learn-toc" aria-label="この回の目次">
            <strong>この回の目次</strong>
            <ol>
              {sections.map((sec) => (
                <li key={sec.section_no}>
                  <a href={`#sec-${sec.section_no}`}>{sec.heading}</a>
                </li>
              ))}
            </ol>
            <div className="cm-learn-toc-nav">
              <button
                type="button"
                className="cm-btn"
                disabled={!prevReady}
                onClick={() => prevReady && goSession(prevReady.session_no)}
              >
                前回
              </button>
              <button
                type="button"
                className="cm-btn"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                この回の先頭
              </button>
              <button
                type="button"
                className="cm-btn"
                disabled={!nextReady}
                onClick={() => nextReady && goSession(nextReady.session_no)}
              >
                次回
              </button>
            </div>
          </nav>
          )
        )}

        <article className="cm-learn-article">
          {!currentSession || currentSession.status !== "ready" ? (
            <p className="cm-muted">この回の本文はまだ生成されていません。</p>
          ) : (
            sections.map((sec) => {
              const raw = getSectionMarkdown(currentSession.markdown_body, sec.section_no);
              const md = raw ? stripLeadingHeading(raw, sec.heading) : null;
              return (
                <section
                  key={sec.section_no}
                  id={`sec-${sec.section_no}`}
                  className="cm-learn-block"
                >
                  <h2
                    className={
                      ao
                        ? "font-ao-serif text-ao-heading-2 font-semibold text-ao-ink"
                        : "cm-learn-section-title"
                    }
                  >
                    {sec.heading}
                  </h2>
                  {sec.role === "content" && sec.image_url ? (
                    <SectionFigure
                      url={sec.image_url}
                      attribution={sec.image_attribution}
                      pageUrl={sec.image_page_url}
                      alt={sec.heading}
                      side={sectionImageSide.get(sec.section_no) ?? "left"}
                      frameD={ao}
                    />
                  ) : null}
                  {md ? (
                    <SectionBody text={md} />
                  ) : (
                    <p className="cm-muted">このセクションの本文がありません。</p>
                  )}
                </section>
              );
            })
          )}
        </article>

        <div className="cm-learn-nav">
          <button
            type="button"
            className={btn}
            disabled={!prevReady}
            onClick={() => prevReady && goSession(prevReady.session_no)}
          >
            前回
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            この回の先頭
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!nextReady}
            onClick={() => nextReady && goSession(nextReady.session_no)}
          >
            次回
          </button>
        </div>

        {showSessionChat ? (
        <div className="cm-card cm-chat">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>講師とチャット</h2>
            <button
              type="button"
              className="cm-btn"
              style={{ fontSize: "0.75rem" }}
              onClick={() => setChatOpen((o) => !o)}
            >
              {chatOpen ? "折りたたむ" : "開く"}
            </button>
          </div>
          {chatOpen && (
            <>
              <div className="cm-chat-messages">
                {chatMsgs.length === 0 && (
                  <p className="cm-muted">講義内容について質問できます。</p>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`cm-chat-bubble ${m.role}`}>
                    {m.content}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="質問を入力…"
                  style={{ flex: 1, marginBottom: 0 }}
                  disabled={chatBusy}
                />
                <button type="submit" className="cm-btn cm-btn-primary" disabled={chatBusy}>
                  送信
                </button>
              </form>
            </>
          )}
        </div>
        ) : null}
      </div>
    </div>
  );
}
