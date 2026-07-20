"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CourseMaster } from "@/lib/course-maker/course-master-schema";
import {
  getSectionMarkdown,
  visualForSection,
  visualHasArtifact,
  type VisualRow,
} from "@/lib/course-maker/course-admin-view";
import { LazyCourseVisual } from "../../_components/LazyCourseVisual";

type Session = {
  session_no: number;
  status: string;
  markdown_body: string | null;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function SectionBody({ text }: { text: string }) {
  return (
    <div className="cm-body cm-learn-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

export default function CourseLearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [title, setTitle] = useState("");
  const [master, setMaster] = useState<CourseMaster | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [visuals, setVisuals] = useState<VisualRow[]>([]);
  const [sessionNo, setSessionNo] = useState(1);
  const [sectionNo, setSectionNo] = useState(1);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`);
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
      setSectionNo(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetch(`/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_opened_session_no: sessionNo }),
    });
  }, [courseId, sessionNo]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const readySessions = useMemo(
    () => sessions.filter((s) => s.status === "ready").sort((a, b) => a.session_no - b.session_no),
    [sessions],
  );

  const sessionMaster = master?.sessions.find((s) => s.session_no === sessionNo);
  const sections = sessionMaster?.sections ?? [];
  const currentSession = sessions.find((s) => s.session_no === sessionNo);
  const sectionPlan = sections.find((s) => s.section_no === sectionNo);
  const sectionMd = getSectionMarkdown(currentSession?.markdown_body ?? null, sectionNo);
  const visual = visualForSection(visuals, sessionNo, sectionNo);

  const pageIndex = useMemo(() => {
    let idx = 0;
    const pages: Array<{ session_no: number; section_no: number }> = [];
    for (const s of readySessions) {
      const sm = master?.sessions.find((x) => x.session_no === s.session_no);
      const secs = [...(sm?.sections ?? [])].sort((a, b) => a.section_no - b.section_no);
      for (const sec of secs) {
        pages.push({ session_no: s.session_no, section_no: sec.section_no });
        if (s.session_no === sessionNo && sec.section_no === sectionNo) idx = pages.length - 1;
      }
    }
    return { pages, idx };
  }, [readySessions, master, sessionNo, sectionNo]);

  function goTo(session_no: number, section_no: number) {
    setSessionNo(session_no);
    setSectionNo(section_no);
    setChatMsgs([]);
  }

  function goRelative(delta: number) {
    const next = pageIndex.pages[pageIndex.idx + delta];
    if (!next) return;
    goTo(next.session_no, next.section_no);
  }

  function goFirst() {
    const first = pageIndex.pages[0];
    if (first) goTo(first.session_no, first.section_no);
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
      const res = await fetch(`/api/courses/${courseId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_no: sessionNo,
          section_no: sectionNo,
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

  if (loading) return <p className="cm-muted">読み込み中…</p>;
  if (error) return <div className="cm-error">{error}</div>;

  return (
    <div className="cm-learn-wrap">
      <aside className={`cm-learn-drawer ${outlineOpen ? "open" : ""}`} aria-hidden={!outlineOpen}>
        <div className="cm-learn-drawer-head">
          <strong>講座全体構成</strong>
          <button type="button" className="cm-btn" onClick={() => setOutlineOpen(false)}>
            閉じる
          </button>
        </div>
        <nav className="cm-learn-outline">
          {(master?.sessions ?? []).map((s) => (
            <div key={s.session_no} className="cm-learn-outline-session">
              <button
                type="button"
                className={`cm-learn-outline-session-btn ${sessionNo === s.session_no ? "active" : ""}`}
                onClick={() => {
                  goTo(s.session_no, 1);
                  setOutlineOpen(false);
                }}
              >
                第{s.session_no}回 {s.title}
              </button>
              <ul>
                {s.sections.map((sec) => (
                  <li key={sec.section_no}>
                    <button
                      type="button"
                      className={
                        sessionNo === s.session_no && sectionNo === sec.section_no ? "active" : ""
                      }
                      onClick={() => {
                        goTo(s.session_no, sec.section_no);
                        setOutlineOpen(false);
                      }}
                    >
                      {sec.section_no}. {sec.heading}
                    </button>
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
          <Link href={`/courses/${courseId}`} className="cm-btn">
            ← 管理画面
          </Link>
        </div>

        <h1 className="cm-page-title">{title}</h1>
        <p className="cm-page-sub">検証用受講ビュー</p>

        <div className="cm-session-tabs">
          {readySessions.map((s) => (
            <button
              key={s.session_no}
              type="button"
              className={`cm-session-tab ${sessionNo === s.session_no ? "active" : ""}`}
              onClick={() => goTo(s.session_no, 1)}
            >
              第{s.session_no}回
            </button>
          ))}
        </div>

        {sections.length > 0 && (
          <div className="cm-section-tabs">
            {sections.map((sec) => (
              <button
                key={sec.section_no}
                type="button"
                className={`cm-section-tab ${sectionNo === sec.section_no ? "active" : ""}`}
                onClick={() => goTo(sessionNo, sec.section_no)}
              >
                {sec.section_no}
              </button>
            ))}
          </div>
        )}

        {sessionMaster && (
          <div className="cm-learn-session-meta">
            <h2>
              第{sessionNo}回 {sessionMaster.title}
            </h2>
            {sessionMaster.objectives.length > 0 && (
              <p className="cm-muted">{sessionMaster.objectives.join(" · ")}</p>
            )}
          </div>
        )}

        <article className="cm-learn-page">
          <h3 className="cm-learn-section-title">{sectionPlan?.heading ?? `セクション${sectionNo}`}</h3>

          <div className="cm-learn-visual">
            <LazyCourseVisual
              key={`${sessionNo}-${sectionNo}`}
              courseId={courseId}
              sessionNo={sessionNo}
              sectionNo={sectionNo}
              hasArtifact={visualHasArtifact(visual)}
              alt={sectionPlan?.heading ?? "セクション画"}
              eager
              emptyLabel={
                visual?.status === "pending"
                  ? "セクション画（プロンプト準備済み・未生成）"
                  : visual?.status === "skipped"
                    ? "セクション画なし"
                    : "セクション画はまだありません"
              }
            />
          </div>

          {!currentSession || currentSession.status !== "ready" ? (
            <p className="cm-muted">この回の本文はまだ生成されていません。</p>
          ) : sectionMd ? (
            <SectionBody key={`${sessionNo}-${sectionNo}`} text={sectionMd} />
          ) : (
            <p className="cm-muted">このセクションの本文がありません。</p>
          )}
        </article>

        <div className="cm-learn-nav">
          <button
            type="button"
            className="cm-btn"
            disabled={pageIndex.idx <= 0}
            onClick={() => goRelative(-1)}
          >
            戻る
          </button>
          <button type="button" className="cm-btn" onClick={goFirst}>
            最初へ
          </button>
          <button
            type="button"
            className="cm-btn cm-btn-primary"
            disabled={pageIndex.idx >= pageIndex.pages.length - 1}
            onClick={() => goRelative(1)}
          >
            進む
          </button>
          <span className="cm-muted">
            {pageIndex.pages.length > 0 ? pageIndex.idx + 1 : 0} / {pageIndex.pages.length}
          </span>
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
                  <p className="cm-muted">講義内容について質問できます（v1: 簡易応答）。</p>
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
      </div>
    </div>
  );
}
