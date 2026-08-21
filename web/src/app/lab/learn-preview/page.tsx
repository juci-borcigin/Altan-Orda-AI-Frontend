"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@/app/courses/courses.css";

type Section = {
  section_no: number;
  role: "intro" | "content" | "outro" | string;
  heading: string;
  markdown: string;
  image_url?: string | null;
  image_attribution?: string | null;
};

type Session = {
  session_no: number;
  title: string;
  objectives: string[];
  hero_image_url?: string | null;
  sections: Section[];
};

type CourseDummy = {
  title: string;
  theme: string;
  session_count: number;
  target_chars_per_session: number;
  sessions: Session[];
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function readingMinutes(chars: number) {
  return Math.max(1, Math.round(chars / 250));
}

export default function LearnPreviewPage() {
  const [course, setCourse] = useState<CourseDummy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionNo, setSessionNo] = useState(1);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/lab/learn-preview/course.json")
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as CourseDummy;
      })
      .then(setCourse)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const session = useMemo(
    () => course?.sessions.find((s) => s.session_no === sessionNo) ?? null,
    [course, sessionNo],
  );
  const sections = useMemo(
    () => [...(session?.sections ?? [])].sort((a, b) => a.section_no - b.section_no),
    [session],
  );
  const readySessions = course?.sessions ?? [];
  const readyIdx = readySessions.findIndex((s) => s.session_no === sessionNo);
  const prevReady = readyIdx > 0 ? readySessions[readyIdx - 1] : null;
  const nextReady =
    readyIdx >= 0 && readyIdx < readySessions.length - 1 ? readySessions[readyIdx + 1] : null;

  function goSession(n: number) {
    setSessionNo(n);
    setChatMsgs([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    setChatMsgs((m) => [
      ...m,
      { role: "user", content: q },
      {
        role: "assistant",
        content:
          "（ダミー応答）受講画面UI確認用です。本番では講師AIが第" +
          sessionNo +
          "回の本文を踏まえて答えます。",
      },
    ]);
  }

  if (error) return <div className="cm-error" style={{ padding: "1.5rem" }}>{error}</div>;
  if (!course || !session) {
    return <p className="cm-muted" style={{ padding: "1.5rem" }}>読み込み中…</p>;
  }

  return (
    <div className="cm-shell" style={{ minHeight: "100vh", background: "#f7f5f1" }}>
      <div className="cm-learn-wrap">
        <aside className={`cm-learn-drawer ${outlineOpen ? "open" : ""}`} aria-hidden={!outlineOpen}>
          <div className="cm-learn-drawer-head">
            <strong>講義全体構成</strong>
            <button type="button" className="cm-btn" onClick={() => setOutlineOpen(false)}>
              閉じる
            </button>
          </div>
          <nav className="cm-learn-outline">
            {course.sessions.map((s) => (
              <div key={s.session_no} className="cm-learn-outline-session">
                <button
                  type="button"
                  className={`cm-learn-outline-session-btn ${sessionNo === s.session_no ? "active" : ""}`}
                  onClick={() => {
                    goSession(s.session_no);
                    setOutlineOpen(false);
                  }}
                >
                  第{s.session_no}回 {s.title}
                </button>
                <ul>
                  {s.sections.map((sec) => (
                    <li key={sec.section_no}>
                      <a
                        href={`#sec-${sec.section_no}`}
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
        </aside>
        {outlineOpen && (
          <button
            type="button"
            className="cm-learn-drawer-backdrop"
            aria-label="構成を閉じる"
            onClick={() => setOutlineOpen(false)}
          />
        )}

        <div className="cm-learn-main">
          <div className="cm-learn-topbar">
            <button type="button" className="cm-btn" onClick={() => setOutlineOpen(true)}>
              構成
            </button>
            <Link href="/lab" className="cm-btn">
              ← 実験室トップ
            </Link>
          </div>

          <p
            className="cm-muted"
            style={{
              margin: "0 0 0.75rem",
              padding: "0.55rem 0.75rem",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 6,
              fontSize: "0.8rem",
            }}
          >
            UI確認用ダミー。本文は foundation PoC の最新5回。ヒーロー／セクション画像はプレースホルダ。チャットはダミー応答。
          </p>

          <p className="cm-learn-course-title">{course.title}</p>

          <div className="cm-session-tabs">
            {readySessions.map((s) => (
              <button
                key={s.session_no}
                type="button"
                className={`cm-session-tab ${sessionNo === s.session_no ? "active" : ""}`}
                onClick={() => goSession(s.session_no)}
              >
                第{s.session_no}回
              </button>
            ))}
          </div>

          <header className="cm-learn-article-head">
            <h1 className="cm-learn-session-title">
              第{sessionNo}回 {session.title}
            </h1>
            <p className="cm-muted">
              読了目安 約{readingMinutes(course.target_chars_per_session)}分
              {session.objectives.length > 0 ? ` · ${session.objectives.join(" · ")}` : ""}
            </p>
          </header>

          <div className="cm-learn-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cm-learn-hero-img"
              src={session.hero_image_url || "/lab/learn-preview/hero-placeholder.svg"}
              alt={`第${sessionNo}回メイン画像`}
            />
          </div>

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

          <article className="cm-learn-article">
            {sections.map((sec) => (
              <section key={sec.section_no} id={`sec-${sec.section_no}`} className="cm-learn-block">
                <h2 className="cm-learn-section-title">{sec.heading}</h2>
                {sec.role === "content" && sec.image_url ? (
                  <figure className="cm-learn-section-figure">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sec.image_url} alt="" width={200} height={150} />
                    {sec.image_attribution ? <figcaption>{sec.image_attribution}</figcaption> : null}
                  </figure>
                ) : null}
                <div className="cm-body cm-learn-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{sec.markdown}</ReactMarkdown>
                </div>
              </section>
            ))}
          </article>

          <div className="cm-learn-nav">
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
              className="cm-btn cm-btn-primary"
              disabled={!nextReady}
              onClick={() => nextReady && goSession(nextReady.session_no)}
            >
              次回
            </button>
          </div>

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
                    <p className="cm-muted">講義内容について質問できます（この画面はダミー応答）。</p>
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
                  />
                  <button type="submit" className="cm-btn cm-btn-primary">
                    送信
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
